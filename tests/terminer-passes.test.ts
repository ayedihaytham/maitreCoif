// Test d'intégration (base locale requise) : les rendez-vous dont l'heure de fin est passée
// deviennent « Terminé » tout seuls ; les autres ne bougent pas.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { prisma } from '@/lib/prisma'
import { maintenantSalon, minutesToTime } from '@/lib/slots'
import { terminerRendezVousPasses } from '@/lib/terminer-passes'
import { assertLocalDatabase } from './assert-local-db'

assertLocalDatabase()

const suffixe = Date.now()
let coiffeurId: string
let serviceId: string
const ids: Record<string, string> = {}

const rdv = (cle: string, date: string, debut: string, fin: string, statut: 'CONFIRME' | 'EN_ATTENTE' | 'ANNULE' | 'TERMINE') =>
  prisma.rendezVous
    .create({
      data: {
        codeSuivi: `MC-TP${cle}${suffixe}`,
        coiffeurId,
        serviceId,
        clientNom: 'Client',
        clientTelephone: '20000000',
        date: new Date(`${date}T00:00:00Z`),
        heureDebut: debut,
        heureFin: fin,
        statut,
      },
    })
    .then((r) => (ids[cle] = r.id))

beforeAll(async () => {
  coiffeurId = (await prisma.user.create({ data: { nom: 'Test', prenom: 'Fin', email: `fin-${suffixe}@example.com`, motDePasseHash: 'x', role: 'COIFFEUR' } })).id
  serviceId = (await prisma.service.create({ data: { nom: `Fin ${suffixe}`, prix: 10, duree: 20 } })).id

  const { dateISO, minutes } = maintenantSalon()
  const hier = new Date(`${dateISO}T00:00:00Z`)
  hier.setUTCDate(hier.getUTCDate() - 1)
  const hierISO = hier.toISOString().slice(0, 10)

  await rdv('passe', '2020-01-06', '10:00', '10:30', 'CONFIRME') // jour passé
  await rdv('attente', hierISO, '10:00', '10:30', 'EN_ATTENTE') // hier, en attente
  await rdv('annule', '2020-01-07', '10:00', '10:30', 'ANNULE') // annulé : reste annulé
  await rdv('futur', '2099-01-05', '10:00', '10:30', 'CONFIRME') // futur : ne bouge pas
  // Aujourd'hui : fini il y a une minute (si on est après minuit) / finit dans une heure
  if (minutes >= 2) await rdv('finiAujourdhui', dateISO, '00:00', minutesToTime(minutes - 1), 'CONFIRME')
  if (minutes <= 22 * 60) await rdv('enCours', dateISO, minutesToTime(Math.max(0, minutes - 5)), minutesToTime(minutes + 60), 'CONFIRME')
})

afterAll(async () => {
  await prisma.rendezVous.deleteMany({ where: { coiffeurId } })
  await prisma.service.delete({ where: { id: serviceId } })
  await prisma.user.delete({ where: { id: coiffeurId } })
  await prisma.$disconnect()
})

const statut = async (cle: string) => (await prisma.rendezVous.findUnique({ where: { id: ids[cle] } }))?.statut

describe('terminerRendezVousPasses', () => {
  it('termine les rendez-vous passés et laisse les autres', async () => {
    const n = await terminerRendezVousPasses({ forcer: true })
    expect(n).toBeGreaterThanOrEqual(2)
    expect(await statut('passe')).toBe('TERMINE')
    expect(await statut('attente')).toBe('TERMINE')
    expect(await statut('annule')).toBe('ANNULE')
    expect(await statut('futur')).toBe('CONFIRME')
    if (ids.finiAujourdhui) expect(await statut('finiAujourdhui')).toBe('TERMINE')
    if (ids.enCours) expect(await statut('enCours')).toBe('CONFIRME')
  })

  it('ne repasse pas deux fois dans les 30 secondes', async () => {
    await terminerRendezVousPasses({ forcer: true })
    expect(await terminerRendezVousPasses()).toBe(0)
  })
})
