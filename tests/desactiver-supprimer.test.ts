// Test d'intégration (base locale requise) : désactiver, réactiver et supprimer un membre de
// l'équipe ou un service depuis le back-office, y compris la suppression en cascade avec ses
// rendez-vous. L'authentification et l'envoi des emails sont simulés.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { prisma } from '@/lib/prisma'
import { assertLocalDatabase } from './assert-local-db'

assertLocalDatabase()

const m = vi.hoisted(() => ({ annulation: vi.fn(async (..._a: unknown[]) => ({ sent: true })) }))
const gerant = { user: { id: 'gerant-test', email: 'gerant@example.com', name: 'Gérant Test', role: 'ADMIN' } }
vi.mock('@/lib/auth', () => ({ auth: async () => gerant }))
vi.mock('@/lib/staff', () => ({ oublierPersonnel: () => {} }))
vi.mock('@/lib/notifications', async (original) => ({ ...(await original<typeof import('@/lib/notifications')>()), envoyerAnnulationEmail: m.annulation }))

const equipeRoute = () => import('@/app/api/admin/equipe/[id]/route')
const serviceRoute = () => import('@/app/api/services/[id]/route')
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const patch = (corps: unknown) => new Request('http://test/x', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
const del = (cascade = false) => new Request(`http://test/x${cascade ? '?cascade=1' : ''}`, { method: 'DELETE' })

const suffixe = Date.now()
let compteur = 0
const ids: Record<string, string> = {}

async function creerRdv(cle: string, o: { coiffeurId: string; serviceIds: string[]; date: string; statut: 'CONFIRME' | 'TERMINE' | 'ANNULE'; email?: string | null; avis?: boolean }) {
  const r = await prisma.rendezVous.create({
    data: {
      codeSuivi: `MC-DS${String(++compteur).padStart(2, '0')}${String(suffixe).slice(-5)}`,
      coiffeurId: o.coiffeurId,
      serviceId: o.serviceIds[0],
      clientNom: `Client ${cle}`,
      clientTelephone: '20000000',
      clientEmail: o.email === undefined ? null : o.email,
      date: new Date(`${o.date}T00:00:00Z`),
      heureDebut: '10:00',
      heureFin: '10:20',
      statut: o.statut,
      lignes: { create: o.serviceIds.map((serviceId, ordre) => ({ serviceId, ordre, nom: `Prestation ${ordre}`, prix: 10, duree: 20 })) },
      ...(o.avis ? { avis: { create: { note: 5, commentaire: 'Très bien' } } } : {}),
    },
  })
  ids[cle] = r.id
}

beforeAll(async () => {
  const creer = (n: string) => prisma.user.create({ data: { nom: 'Test', prenom: n, email: `${n}-${suffixe}@example.com`, motDePasseHash: 'x', role: 'COIFFEUR' } })
  ids.libre = (await creer('Libre')).id
  ids.occupe = (await creer('Occupe')).id
  ids.autre = (await creer('Autre')).id
  const service = (nom: string) => prisma.service.create({ data: { nom: `${nom} ${suffixe}`, prix: 10, duree: 20 } }).then((s) => s.id)
  ids.serviceLibre = await service('Libre')
  ids.serviceA = await service('A')
  ids.serviceB = await service('B')

  // Membre occupé : un rendez-vous à venir (client prévenable) et un rendez-vous terminé avec un avis.
  await creerRdv('c1', { coiffeurId: ids.occupe, serviceIds: [ids.serviceB], date: '2099-08-04', statut: 'CONFIRME', email: `client-${suffixe}@example.com` })
  await creerRdv('c2', { coiffeurId: ids.occupe, serviceIds: [ids.serviceB], date: '2020-01-06', statut: 'TERMINE', avis: true })
  // Service A : un rendez-vous à venir qui contient aussi le service B, et un rendez-vous annulé.
  await creerRdv('s1', { coiffeurId: ids.autre, serviceIds: [ids.serviceA, ids.serviceB], date: '2099-08-05', statut: 'CONFIRME', email: `client-s1-${suffixe}@example.com` })
  await creerRdv('s2', { coiffeurId: ids.autre, serviceIds: [ids.serviceA], date: '2020-02-03', statut: 'ANNULE' })
})

beforeEach(() => m.annulation.mockClear())

afterAll(async () => {
  await prisma.rendezVous.deleteMany({ where: { coiffeurId: { in: [ids.occupe, ids.autre, ids.libre] } } })
  await prisma.service.deleteMany({ where: { id: { in: [ids.serviceLibre, ids.serviceA, ids.serviceB] } } })
  await prisma.user.deleteMany({ where: { id: { in: [ids.libre, ids.occupe, ids.autre] } } })
  await prisma.$disconnect()
})

const existeUser = async (id: string) => (await prisma.user.findUnique({ where: { id } })) !== null
const existeService = async (id: string) => (await prisma.service.findUnique({ where: { id } })) !== null
const existeRdv = async (id: string) => (await prisma.rendezVous.findUnique({ where: { id } })) !== null

describe("membres de l'équipe", () => {
  it('se désactive puis se réactive', async () => {
    const { PATCH } = await equipeRoute()
    expect((await PATCH(patch({ actif: false }), ctx(ids.libre))).status).toBe(200)
    expect((await prisma.user.findUnique({ where: { id: ids.libre } }))?.actif).toBe(false)
    expect((await PATCH(patch({ actif: true }), ctx(ids.libre))).status).toBe(200)
    expect((await prisma.user.findUnique({ where: { id: ids.libre } }))?.actif).toBe(true)
  })

  it('refuse de se supprimer soi-même', async () => {
    const { DELETE } = await equipeRoute()
    expect((await DELETE(del(true), ctx('gerant-test'))).status).toBe(400)
  })

  it('sans confirmation, refuse de supprimer un membre qui a des rendez-vous et dit ce qui serait effacé', async () => {
    const { DELETE } = await equipeRoute()
    const res = await DELETE(del(), ctx(ids.occupe))
    expect(res.status).toBe(409)
    expect((await res.json()).rendezVous).toEqual({ total: 2, aVenir: 1, passes: 1 })
    expect(await existeUser(ids.occupe)).toBe(true)
    expect(await existeRdv(ids.c1)).toBe(true)
    expect(m.annulation).not.toHaveBeenCalled()
  })

  it('avec confirmation, supprime le membre, ses rendez-vous et leurs avis, et prévient le client à venir', async () => {
    const { DELETE } = await equipeRoute()
    const res = await DELETE(del(true), ctx(ids.occupe))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ supprime: true, rendezVousSupprimes: 2, clientsPrevenus: 1 })
    expect(await existeUser(ids.occupe)).toBe(false)
    expect(await existeRdv(ids.c1)).toBe(false)
    expect(await existeRdv(ids.c2)).toBe(false)
    expect(await prisma.avis.count({ where: { rendezVousId: ids.c2 } })).toBe(0)
    expect(m.annulation).toHaveBeenCalledTimes(1)
    expect(m.annulation.mock.calls[0][0]).toMatchObject({ to: `client-${suffixe}@example.com`, parLeSalon: true })
  })

  it('supprime un membre sans rendez-vous, sans prévenir personne', async () => {
    const { DELETE } = await equipeRoute()
    const res = await DELETE(del(), ctx(ids.libre))
    expect(res.status).toBe(200)
    expect(await existeUser(ids.libre)).toBe(false)
    expect(m.annulation).not.toHaveBeenCalled()
  })
})

describe('services', () => {
  it('se désactive puis se réactive', async () => {
    const { PATCH } = await serviceRoute()
    expect((await PATCH(patch({ actif: false }), ctx(ids.serviceLibre))).status).toBe(200)
    expect((await prisma.service.findUnique({ where: { id: ids.serviceLibre } }))?.actif).toBe(false)
    expect((await PATCH(patch({ actif: true }), ctx(ids.serviceLibre))).status).toBe(200)
    expect((await prisma.service.findUnique({ where: { id: ids.serviceLibre } }))?.actif).toBe(true)
  })

  it('sans confirmation, refuse de supprimer un service déjà réservé et dit ce qui serait effacé', async () => {
    const { DELETE } = await serviceRoute()
    const res = await DELETE(del(), ctx(ids.serviceA))
    expect(res.status).toBe(409)
    expect((await res.json()).rendezVous).toEqual({ total: 2, aVenir: 1, passes: 1 })
    expect(await existeService(ids.serviceA)).toBe(true)
    expect(m.annulation).not.toHaveBeenCalled()
  })

  it('avec confirmation, supprime le service et les rendez-vous qui le contiennent (en entier), et prévient le client à venir', async () => {
    const { DELETE } = await serviceRoute()
    const res = await DELETE(del(true), ctx(ids.serviceA))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ supprime: true, rendezVousSupprimes: 2, clientsPrevenus: 1 })
    expect(await existeService(ids.serviceA)).toBe(false)
    expect(await existeRdv(ids.s1)).toBe(false) // contenait aussi le service B : supprimé en entier
    expect(await existeRdv(ids.s2)).toBe(false)
    expect(await existeService(ids.serviceB)).toBe(true) // l'autre service n'est pas touché
    expect(m.annulation).toHaveBeenCalledTimes(1)
    expect(m.annulation.mock.calls[0][0]).toMatchObject({ to: `client-s1-${suffixe}@example.com`, parLeSalon: true })
  })

  it('supprime un service jamais réservé', async () => {
    const { DELETE } = await serviceRoute()
    expect((await DELETE(del(), ctx(ids.serviceLibre))).status).toBe(200)
    expect(await existeService(ids.serviceLibre)).toBe(false)
  })
})
