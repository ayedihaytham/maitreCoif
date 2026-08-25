// Test d'intégration : nécessite une base PostgreSQL accessible via
// DATABASE_URL (docker-compose.yml en local). Vérifie la règle de gestion
// centrale du cahier des charges : « un coiffeur ne peut avoir deux
// rendez-vous qui se chevauchent sur le même créneau ».
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { prisma } from '@/lib/prisma'
import { creneauEstLibre, getCreneauxDisponibles } from '@/lib/slots'

const DATE = '2099-06-16' // un mardi, loin dans le futur pour ne jamais collisionner avec de vraies données

let coiffeurId: string
let serviceId: string
let rendezVousId: string

beforeAll(async () => {
  const coiffeur = await prisma.user.create({
    data: {
      nom: 'Test',
      prenom: 'Overlap',
      email: `overlap-test-${Date.now()}@example.com`,
      motDePasseHash: 'x',
      role: 'COIFFEUR',
    },
  })
  coiffeurId = coiffeur.id

  const service = await prisma.service.create({
    data: { nom: 'Service test', prix: 10, duree: 30, actif: true },
  })
  serviceId = service.id

  await prisma.disponibilite.create({
    data: { coiffeurId, jourSemaine: new Date(`${DATE}T00:00:00Z`).getUTCDay(), heureDebut: '09:00', heureFin: '18:00' },
  })

  const rdv = await prisma.rendezVous.create({
    data: {
      codeSuivi: `MC-TEST${Date.now()}`,
      coiffeurId,
      serviceId,
      clientNom: 'Client Test',
      clientTelephone: '20000000',
      date: new Date(`${DATE}T00:00:00Z`),
      heureDebut: '10:00',
      heureFin: '10:30',
      statut: 'EN_ATTENTE',
    },
  })
  rendezVousId = rdv.id
})

afterAll(async () => {
  await prisma.rendezVous.delete({ where: { id: rendezVousId } }).catch(() => {})
  await prisma.disponibilite.deleteMany({ where: { coiffeurId } })
  await prisma.service.delete({ where: { id: serviceId } })
  await prisma.user.delete({ where: { id: coiffeurId } })
  await prisma.$disconnect()
})

describe('creneauEstLibre', () => {
  it('refuse un créneau qui chevauche un rendez-vous existant, même EN_ATTENTE', async () => {
    expect(await creneauEstLibre(coiffeurId, DATE, '10:15', '10:45')).toBe(false)
  })

  it('refuse un créneau strictement identique', async () => {
    expect(await creneauEstLibre(coiffeurId, DATE, '10:00', '10:30')).toBe(false)
  })

  it('accepte un créneau adjacent qui ne chevauche pas', async () => {
    expect(await creneauEstLibre(coiffeurId, DATE, '10:30', '11:00')).toBe(true)
    expect(await creneauEstLibre(coiffeurId, DATE, '09:30', '10:00')).toBe(true)
  })
})

describe('getCreneauxDisponibles', () => {
  it("exclut le créneau réservé de la liste des créneaux libres", async () => {
    const creneaux = await getCreneauxDisponibles(coiffeurId, serviceId, DATE)
    expect(creneaux).not.toContain('10:00')
    expect(creneaux).not.toContain('10:15') // chevaucherait le RDV de 10:00-10:30
    expect(creneaux).toContain('09:00')
    expect(creneaux).toContain('10:30')
  })
})
