// Test d'intégration (base locale requise) : quels emails partent, et à qui, quand un rendez-vous
// change de statut, est annulé ou modifié. L'envoi lui-même (Resend) est simulé.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { prisma } from '@/lib/prisma'
import { maintenantSalon, minutesToTime } from '@/lib/slots'
import { assertLocalDatabase } from './assert-local-db'

assertLocalDatabase()

const m = vi.hoisted(() => ({
  confirmation: vi.fn(async (..._a: unknown[]) => ({ sent: true })),
  annulation: vi.fn(async (..._a: unknown[]) => ({ sent: true })),
  termine: vi.fn(async (..._a: unknown[]) => ({ sent: true })),
  coiffeur: vi.fn(async (..._a: unknown[]) => ({ sent: true })),
  simple: vi.fn(async (..._a: unknown[]) => ({ sent: true })),
}))

vi.mock('@/lib/auth', () => ({ auth: async () => ({ user: { id: 'gerant-test', role: 'ADMIN', email: 'g@example.com', name: 'Gérant' } }) }))
vi.mock('@/lib/notifications', async (original) => ({
  ...(await original<typeof import('@/lib/notifications')>()),
  envoyerConfirmationEmail: m.confirmation,
  envoyerAnnulationEmail: m.annulation,
  envoyerTermineEmail: m.termine,
  envoyerNotificationCoiffeurEmail: m.coiffeur,
  envoyerEmailSimple: m.simple,
}))

const suffixe = Date.now()
const IP = `198.51.100.${Math.floor(Math.random() * 200) + 1}`
let compteur = 0
const ids: Record<string, string> = {}
const codes: Record<string, string> = {}
let coiffeurId: string
let serviceId: string
const EMAIL_COIFFEUR = `coiffeur-${suffixe}@example.com`

const requete = (corps: unknown, methode = 'POST') =>
  new Request('http://test/api', { method: methode, headers: { 'Content-Type': 'application/json', 'x-real-ip': IP }, body: JSON.stringify(corps) })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

async function creerRdv(cle: string, o: { date: string; debut?: string; fin?: string; statut: 'CONFIRME' | 'EN_ATTENTE'; email?: string | null }) {
  codes[cle] = `MC-ZE${String(++compteur).padStart(2, '0')}${String(suffixe).slice(-5)}`
  const r = await prisma.rendezVous.create({
    data: {
      codeSuivi: codes[cle],
      coiffeurId,
      serviceId,
      clientNom: `Client ${cle}`,
      clientTelephone: '20000000',
      clientEmail: o.email === undefined ? `client-${cle}-${suffixe}@example.com` : o.email,
      date: new Date(`${o.date}T00:00:00Z`),
      heureDebut: o.debut ?? '10:00',
      heureFin: o.fin ?? '10:30',
      statut: o.statut,
      lignes: { create: [{ serviceId, ordre: 0, nom: 'Coupe test', prix: 10, duree: 30 }] },
    },
  })
  ids[cle] = r.id
}

beforeAll(async () => {
  vi.stubEnv('TURNSTILE_SECRET_KEY', '')
  vi.stubEnv('SALON_NOTIFY_EMAIL', '')
  coiffeurId = (await prisma.user.create({ data: { nom: 'Test', prenom: 'Mail', email: EMAIL_COIFFEUR, motDePasseHash: 'x', role: 'COIFFEUR' } })).id
  serviceId = (await prisma.service.create({ data: { nom: `Mail ${suffixe}`, prix: 10, duree: 30 } })).id

  await creerRdv('termine', { date: '2099-03-02', statut: 'CONFIRME' })
  await creerRdv('attente', { date: '2099-03-03', statut: 'EN_ATTENTE' })
  await creerRdv('annule', { date: '2099-03-04', statut: 'CONFIRME' })
  await creerRdv('client', { date: '2099-03-05', statut: 'CONFIRME' })
  await creerRdv('modif', { date: '2099-03-06', statut: 'CONFIRME' })
  await creerRdv('sansmail', { date: '2099-03-07', statut: 'CONFIRME', email: null })

  const { dateISO, minutes } = maintenantSalon()
  if (minutes >= 2) await creerRdv('recent', { date: dateISO, debut: '00:00', fin: minutesToTime(minutes - 1), statut: 'CONFIRME' })
  await creerRdv('ancien', { date: '2020-01-06', statut: 'CONFIRME' })
})

beforeEach(() => Object.values(m).forEach((f) => f.mockClear()))

afterAll(async () => {
  vi.unstubAllEnvs()
  await prisma.rendezVous.deleteMany({ where: { coiffeurId } })
  await prisma.rateLimitHit.deleteMany({ where: { key: { contains: IP } } })
  await prisma.service.delete({ where: { id: serviceId } })
  await prisma.user.delete({ where: { id: coiffeurId } })
  await prisma.$disconnect()
})

const appelsPour = (f: typeof m.termine, code: string) => f.mock.calls.filter((c) => (c[0] as { codeSuivi?: string })?.codeSuivi === code)

describe('changement de statut par le salon → email au client', () => {
  it('confirmé → terminé : remerciement', async () => {
    const { PATCH } = await import('@/app/api/rendez-vous/[id]/route')
    expect((await PATCH(requete({ statut: 'TERMINE' }, 'PATCH'), ctx(ids.termine))).status).toBe(200)
    const [appel] = appelsPour(m.termine, codes.termine)
    expect(appel?.[0]).toMatchObject({ to: `client-termine-${suffixe}@example.com`, serviceNom: 'Coupe test' })
  })

  it('en attente → confirmé : confirmation avec QR code', async () => {
    const { PATCH } = await import('@/app/api/rendez-vous/[id]/route')
    await PATCH(requete({ statut: 'CONFIRME' }, 'PATCH'), ctx(ids.attente))
    expect(appelsPour(m.confirmation, codes.attente)).toHaveLength(1)
  })

  it('annulé par le salon : email d’annulation « parLeSalon »', async () => {
    const { PATCH } = await import('@/app/api/rendez-vous/[id]/route')
    await PATCH(requete({ statut: 'ANNULE' }, 'PATCH'), ctx(ids.annule))
    expect(appelsPour(m.annulation, codes.annule)[0]?.[0]).toMatchObject({ parLeSalon: true })
  })

  it('un client sans email ne reçoit rien', async () => {
    const { PATCH } = await import('@/app/api/rendez-vous/[id]/route')
    expect((await PATCH(requete({ statut: 'TERMINE' }, 'PATCH'), ctx(ids.sansmail))).status).toBe(200)
    expect(m.termine).not.toHaveBeenCalled()
  })

  it('une transition invalide ne notifie personne', async () => {
    const { PATCH } = await import('@/app/api/rendez-vous/[id]/route')
    expect((await PATCH(requete({ statut: 'CONFIRME' }, 'PATCH'), ctx(ids.termine))).status).toBe(400)
    expect(m.confirmation).not.toHaveBeenCalled()
  })
})

describe('le client annule ou demande une modification → le coiffeur choisi est prévenu', () => {
  it('annulation : email au coiffeur, et au client', async () => {
    const { POST } = await import('@/app/api/rendez-vous/suivi/route')
    expect((await POST(requete({ id: ids.client, codeSuivi: codes.client }))).status).toBe(200)
    expect(m.coiffeur).toHaveBeenCalledTimes(1)
    expect(m.coiffeur.mock.calls[0][0]).toMatchObject({ to: EMAIL_COIFFEUR, coiffeurPrenom: 'Mail', evenement: 'annulation', clientNom: 'Client client', serviceNom: 'Coupe test', date: '2099-03-05' })
    expect(appelsPour(m.annulation, codes.client)[0]?.[0]).toMatchObject({ parLeSalon: false })
  })

  it('demande de modification : email au coiffeur avec le message', async () => {
    const { POST } = await import('@/app/api/rendez-vous/modification/route')
    expect((await POST(requete({ id: ids.modif, codeSuivi: codes.modif, message: 'Pouvez-vous décaler à 15h ?' }))).status).toBe(200)
    expect(m.coiffeur).toHaveBeenCalledTimes(1)
    expect(m.coiffeur.mock.calls[0][0]).toMatchObject({ to: EMAIL_COIFFEUR, evenement: 'modification', message: 'Pouvez-vous décaler à 15h ?' })
  })

  it('un coiffeur désactivé n’est pas prévenu', async () => {
    await prisma.user.update({ where: { id: coiffeurId }, data: { actif: false } })
    await creerRdv('inactif', { date: '2099-03-08', statut: 'CONFIRME' })
    const { POST } = await import('@/app/api/rendez-vous/suivi/route')
    expect((await POST(requete({ id: ids.inactif, codeSuivi: codes.inactif }))).status).toBe(200)
    expect(m.coiffeur).not.toHaveBeenCalled()
    await prisma.user.update({ where: { id: coiffeurId }, data: { actif: true } })
  })

  it('pas de doublon si l’alerte du salon va déjà à la même adresse', async () => {
    vi.stubEnv('SALON_NOTIFY_EMAIL', EMAIL_COIFFEUR.toUpperCase())
    await creerRdv('doublon', { date: '2099-03-09', statut: 'CONFIRME' })
    const { POST } = await import('@/app/api/rendez-vous/suivi/route')
    await POST(requete({ id: ids.doublon, codeSuivi: codes.doublon }))
    expect(m.coiffeur).not.toHaveBeenCalled()
    expect(m.simple.mock.calls.some((c) => c[0] === EMAIL_COIFFEUR.toUpperCase())).toBe(true)
    vi.stubEnv('SALON_NOTIFY_EMAIL', '')
  })
})

describe('passage automatique en « Terminé » → remerciement', () => {
  it('envoyé une seule fois pour un rendez-vous qui vient de finir, jamais pour un ancien', async () => {
    const { terminerRendezVousPasses } = await import('@/lib/terminer-passes')
    await terminerRendezVousPasses({ forcer: true })
    if (codes.recent) expect(appelsPour(m.termine, codes.recent)).toHaveLength(1)
    expect(appelsPour(m.termine, codes.ancien)).toHaveLength(0)
    expect((await prisma.rendezVous.findUnique({ where: { id: ids.ancien } }))?.statut).toBe('TERMINE')

    m.termine.mockClear()
    await terminerRendezVousPasses({ forcer: true })
    expect(m.termine.mock.calls.filter((c) => [codes.recent, codes.ancien].includes((c[0] as { codeSuivi: string }).codeSuivi))).toHaveLength(0)
  })
})
