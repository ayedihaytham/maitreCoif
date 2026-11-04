// Test d'intégration (base locale requise) : fermetures/congés et
// déplacement de rendez-vous par le salon.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { creerRendezVousConfirme, deplacerRendezVous } from '@/lib/booking'
import { prisma } from '@/lib/prisma'
import { creneauEstLibre, creneauEstProposable, estFerme, getCreneauxDisponibles } from '@/lib/slots'
import { assertLocalDatabase } from './assert-local-db'

assertLocalDatabase()

const JOUR = '2099-07-14' // un mardi, loin dans le futur
const JOUR_FERME = '2099-07-15'
const JOUR_CONGE = '2099-07-16'
const JOUR_DEST = '2099-07-17'

let coiffeurId: string
let autreCoiffeurId: string
let serviceId: string
let fermetureSalonId: string
let fermetureCongeId: string

const dispo = (jour: string) => ({ jourSemaine: new Date(`${jour}T00:00:00Z`).getUTCDay(), heureDebut: '09:00', heureFin: '18:00' })

beforeAll(async () => {
  const suffixe = Date.now()
  const [a, b] = await Promise.all(
    ['A', 'B'].map((n) =>
      prisma.user.create({
        data: { nom: 'Test', prenom: `Ferm${n}`, email: `ferm-${n}-${suffixe}@example.com`, motDePasseHash: 'x', role: 'COIFFEUR' },
      }),
    ),
  )
  coiffeurId = a.id
  autreCoiffeurId = b.id
  serviceId = (await prisma.service.create({ data: { nom: 'Service ferm', prix: 10, duree: 30, actif: true } })).id

  for (const id of [coiffeurId, autreCoiffeurId]) {
    await prisma.disponibilite.createMany({ data: [JOUR, JOUR_FERME, JOUR_CONGE, JOUR_DEST].map((j) => ({ ...dispo(j), coiffeurId: id })) })
  }

  fermetureSalonId = (
    await prisma.fermeture.create({ data: { coiffeurId: null, dateDebut: new Date(`${JOUR_FERME}T00:00:00Z`), dateFin: new Date(`${JOUR_FERME}T00:00:00Z`), motif: 'Férié' } })
  ).id
  fermetureCongeId = (
    await prisma.fermeture.create({ data: { coiffeurId, dateDebut: new Date(`${JOUR_CONGE}T00:00:00Z`), dateFin: new Date(`${JOUR_CONGE}T00:00:00Z`) } })
  ).id
})

afterAll(async () => {
  await prisma.rendezVous.deleteMany({ where: { coiffeurId: { in: [coiffeurId, autreCoiffeurId] } } })
  await prisma.fermeture.deleteMany({ where: { id: { in: [fermetureSalonId, fermetureCongeId] } } })
  await prisma.disponibilite.deleteMany({ where: { coiffeurId: { in: [coiffeurId, autreCoiffeurId] } } })
  await prisma.service.delete({ where: { id: serviceId } })
  await prisma.user.deleteMany({ where: { id: { in: [coiffeurId, autreCoiffeurId] } } })
  await prisma.$disconnect()
})

describe('fermetures', () => {
  it('une fermeture du salon bloque tous les coiffeurs', async () => {
    expect(await estFerme(coiffeurId, JOUR_FERME)).toBe(true)
    expect(await estFerme(autreCoiffeurId, JOUR_FERME)).toBe(true)
    expect(await getCreneauxDisponibles(coiffeurId, serviceId, JOUR_FERME)).toEqual([])
  })

  it("un congé ne bloque que le coiffeur concerné", async () => {
    expect(await getCreneauxDisponibles(coiffeurId, serviceId, JOUR_CONGE)).toEqual([])
    expect((await getCreneauxDisponibles(autreCoiffeurId, serviceId, JOUR_CONGE)).length).toBeGreaterThan(0)
  })

  it('refuse un créneau sur un jour fermé, même en appel direct', async () => {
    expect(await creneauEstLibre(coiffeurId, JOUR_FERME, '10:00', '10:30')).toBe(false)
  })

  it("n'affecte pas un jour ordinaire", async () => {
    expect(await estFerme(coiffeurId, JOUR)).toBe(false)
  })
})

describe('créneau proposable', () => {
  it('refuse un horaire hors des disponibilités du coiffeur', async () => {
    expect(await creneauEstProposable(coiffeurId, serviceId, JOUR, '03:00')).toBe(false)
    expect(await creneauEstProposable(coiffeurId, serviceId, JOUR, '10:00')).toBe(true)
  })
})

describe('déplacement par le salon', () => {
  const base = {
    clientUserId: null,
    clientNom: 'Client',
    clientTelephone: '20000002',
    clientEmail: null,
    notes: null,
  }

  it('déplace un rendez-vous, libère l’ancien créneau et traite les demandes en attente', async () => {
    const rdv = await creerRendezVousConfirme({ ...base, codeSuivi: `MC-MV${Date.now()}`, coiffeurId, serviceId, dureeService: 30, date: JOUR, heureDebut: '10:00' })
    expect(rdv).not.toBeNull()
    await prisma.demandeModification.create({ data: { rendezVousId: rdv!.id, message: 'plus tard svp' } })

    const deplace = await deplacerRendezVous(rdv!, { coiffeurId: autreCoiffeurId, date: JOUR_DEST, heureDebut: '14:00' })
    expect(deplace).toMatchObject({ coiffeurId: autreCoiffeurId, heureDebut: '14:00', heureFin: '14:30', statut: 'CONFIRME' })

    expect(await creneauEstLibre(coiffeurId, JOUR, '10:00', '10:30')).toBe(true)
    expect(await prisma.demandeModification.count({ where: { rendezVousId: rdv!.id, traitee: false } })).toBe(0)
  })

  it('refuse un déplacement vers un créneau occupé ou un jour fermé', async () => {
    const a = await creerRendezVousConfirme({ ...base, codeSuivi: `MC-MA${Date.now()}`, coiffeurId, serviceId, dureeService: 30, date: JOUR, heureDebut: '11:00' })
    const b = await creerRendezVousConfirme({ ...base, codeSuivi: `MC-MB${Date.now()}`, coiffeurId, serviceId, dureeService: 30, date: JOUR, heureDebut: '12:00' })

    expect(await deplacerRendezVous(b!, { coiffeurId, date: JOUR, heureDebut: '11:00' })).toBeNull()
    expect(await deplacerRendezVous(a!, { coiffeurId, date: JOUR_FERME, heureDebut: '11:00' })).toBeNull()
  })

  it("permet de décaler un rendez-vous sur un créneau qui chevauche l'ancien (il ne se bloque pas lui-même)", async () => {
    const rdv = await creerRendezVousConfirme({ ...base, codeSuivi: `MC-MS${Date.now()}`, coiffeurId, serviceId, dureeService: 30, date: JOUR, heureDebut: '15:00' })
    const deplace = await deplacerRendezVous(rdv!, { coiffeurId, date: JOUR, heureDebut: '15:15' })
    expect(deplace?.heureDebut).toBe('15:15')
  })
})
