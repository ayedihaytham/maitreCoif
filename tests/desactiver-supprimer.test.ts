// Test d'intégration (base locale requise) : désactiver, réactiver et supprimer un membre de
// l'équipe ou un service depuis le back-office. L'authentification est simulée (gérant).
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { prisma } from '@/lib/prisma'
import { assertLocalDatabase } from './assert-local-db'

assertLocalDatabase()

const gerant = { user: { id: 'gerant-test', email: 'gerant@example.com', name: 'Gérant Test', role: 'ADMIN' } }
vi.mock('@/lib/auth', () => ({ auth: async () => gerant }))
vi.mock('@/lib/staff', () => ({ oublierPersonnel: () => {} }))

const equipeRoute = () => import('@/app/api/admin/equipe/[id]/route')
const serviceRoute = () => import('@/app/api/services/[id]/route')
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const patch = (corps: unknown) => new Request('http://test/x', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
const del = () => new Request('http://test/x', { method: 'DELETE' })

const suffixe = Date.now()
let libreId: string
let occupeId: string
let serviceLibreId: string
let serviceUtiliseId: string
let rdvId: string

beforeAll(async () => {
  const creer = (n: string) => prisma.user.create({ data: { nom: 'Test', prenom: n, email: `${n}-${suffixe}@example.com`, motDePasseHash: 'x', role: 'COIFFEUR' } })
  libreId = (await creer('Libre')).id
  occupeId = (await creer('Occupe')).id
  serviceLibreId = (await prisma.service.create({ data: { nom: `Libre ${suffixe}`, prix: 10, duree: 20 } })).id
  const utilise = await prisma.service.create({ data: { nom: `Utilise ${suffixe}`, prix: 10, duree: 20 } })
  serviceUtiliseId = utilise.id
  const rdv = await prisma.rendezVous.create({
    data: {
      codeSuivi: `MC-DS${suffixe}`,
      coiffeurId: occupeId,
      serviceId: serviceUtiliseId,
      clientNom: 'Client',
      clientTelephone: '20000000',
      date: new Date('2099-08-04T00:00:00Z'),
      heureDebut: '10:00',
      heureFin: '10:20',
      statut: 'CONFIRME',
      lignes: { create: [{ serviceId: serviceUtiliseId, ordre: 0, nom: 'Utilise', prix: 10, duree: 20 }] },
    },
  })
  rdvId = rdv.id
})

afterAll(async () => {
  await prisma.rendezVous.deleteMany({ where: { id: rdvId } })
  await prisma.service.deleteMany({ where: { id: { in: [serviceLibreId, serviceUtiliseId] } } })
  await prisma.user.deleteMany({ where: { id: { in: [libreId, occupeId] } } })
  await prisma.$disconnect()
})

describe('membres de l\'équipe', () => {
  it('se désactive puis se réactive', async () => {
    const { PATCH } = await equipeRoute()
    expect((await PATCH(patch({ actif: false }), ctx(libreId))).status).toBe(200)
    expect((await prisma.user.findUnique({ where: { id: libreId } }))?.actif).toBe(false)
    expect((await PATCH(patch({ actif: true }), ctx(libreId))).status).toBe(200)
    expect((await prisma.user.findUnique({ where: { id: libreId } }))?.actif).toBe(true)
  })

  it("refuse de supprimer un membre qui a des rendez-vous, et le garde", async () => {
    const { DELETE } = await equipeRoute()
    const res = await DELETE(del(), ctx(occupeId))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/Désactivez-le/)
    expect(await prisma.user.findUnique({ where: { id: occupeId } })).not.toBeNull()
  })

  it('supprime un membre sans rendez-vous', async () => {
    const { DELETE } = await equipeRoute()
    expect((await DELETE(del(), ctx(libreId))).status).toBe(200)
    expect(await prisma.user.findUnique({ where: { id: libreId } })).toBeNull()
  })
})

describe('services', () => {
  it('se désactive puis se réactive', async () => {
    const { PATCH } = await serviceRoute()
    expect((await PATCH(patch({ actif: false }), ctx(serviceLibreId))).status).toBe(200)
    expect((await prisma.service.findUnique({ where: { id: serviceLibreId } }))?.actif).toBe(false)
    expect((await PATCH(patch({ actif: true }), ctx(serviceLibreId))).status).toBe(200)
    expect((await prisma.service.findUnique({ where: { id: serviceLibreId } }))?.actif).toBe(true)
  })

  it('refuse de supprimer un service déjà réservé, et le garde', async () => {
    const { DELETE } = await serviceRoute()
    const res = await DELETE(del(), ctx(serviceUtiliseId))
    expect(res.status).toBe(409)
    expect(await prisma.service.findUnique({ where: { id: serviceUtiliseId } })).not.toBeNull()
  })

  it('supprime un service jamais réservé', async () => {
    const { DELETE } = await serviceRoute()
    expect((await DELETE(del(), ctx(serviceLibreId))).status).toBe(200)
    expect(await prisma.service.findUnique({ where: { id: serviceLibreId } })).toBeNull()
  })
})
