// Test d'intégration (base locale requise) : pause déjeuner des coiffeurs, et accès du personnel lié au
// compte Clerk (modifier l'email d'un membre ne coupe plus son accès).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { prisma } from '@/lib/prisma'
import { creneauEstLibre, getGrilleJour, getJoursDisponibles } from '@/lib/slots'
import { oublierPersonnel, staffDepuisClerk } from '@/lib/staff'
import { erreurPause } from '@/lib/validators'
import { assertLocalDatabase } from './assert-local-db'

assertLocalDatabase()

const suffixe = Date.now()
const DATE = '2099-06-16' // un mardi, loin dans le futur
let coiffeurId: string
let serviceId: string
const emails: string[] = []

async function creerMembre(cle: string, extra: Record<string, unknown> = {}) {
  const email = `${cle}-${suffixe}@example.com`
  emails.push(email)
  return prisma.user.create({ data: { nom: 'Test', prenom: cle, email, motDePasseHash: 'x', role: 'COIFFEUR', ...extra } })
}

beforeAll(async () => {
  const c = await creerMembre('pause', { pauseDebut: '13:00', pauseFin: '14:00' })
  coiffeurId = c.id
  serviceId = (await prisma.service.create({ data: { nom: `Service pause ${suffixe}`, prix: 10, duree: 30 } })).id
  await prisma.disponibilite.create({ data: { coiffeurId, jourSemaine: new Date(`${DATE}T00:00:00Z`).getUTCDay(), heureDebut: '09:00', heureFin: '18:00' } })
})

afterAll(async () => {
  await prisma.disponibilite.deleteMany({ where: { coiffeurId } })
  await prisma.service.deleteMany({ where: { id: serviceId } })
  await prisma.user.deleteMany({ where: { email: { in: emails } } })
  await prisma.$disconnect()
})

describe('pause déjeuner', () => {
  it('aucun créneau ne chevauche la pause ; ceux qui finissent à 13:00 ou commencent à 14:00 restent libres', async () => {
    const grille = await getGrilleJour(coiffeurId, serviceId, DATE)
    const libre = (h: string) => grille.find((c) => c.heure === h)?.libre
    expect(libre('12:30')).toBe(true) // 12:30 – 13:00
    expect(libre('13:00')).toBe(false)
    expect(libre('13:30')).toBe(false)
    expect(libre('14:00')).toBe(true)
  })

  it('une prestation longue ne peut pas empiéter sur la pause', async () => {
    const long = await prisma.service.create({ data: { nom: `Long pause ${suffixe}`, prix: 30, duree: 90 } })
    try {
      const grille = await getGrilleJour(coiffeurId, long.id, DATE)
      expect(grille.find((c) => c.heure === '11:30')?.libre).toBe(true) // 11:30 – 13:00
      expect(grille.find((c) => c.heure === '12:00')?.libre).toBe(false) // 12:00 – 13:30 chevauche
    } finally {
      await prisma.service.delete({ where: { id: long.id } })
    }
  })

  it('le contrôle de dernière minute et le jour « libre » en tiennent compte aussi', async () => {
    expect(await creneauEstLibre(coiffeurId, DATE, '13:15', '13:45')).toBe(false)
    expect(await creneauEstLibre(coiffeurId, DATE, '14:00', '14:30')).toBe(true)
    const jours = await getJoursDisponibles(coiffeurId, serviceId, DATE, 1)
    expect(jours[0].etat).toBe('libre')
  })

  it('sans pause, le créneau de midi est proposé', async () => {
    await prisma.user.update({ where: { id: coiffeurId }, data: { pauseDebut: null, pauseFin: null } })
    try {
      expect((await getGrilleJour(coiffeurId, serviceId, DATE)).find((c) => c.heure === '13:00')?.libre).toBe(true)
    } finally {
      await prisma.user.update({ where: { id: coiffeurId }, data: { pauseDebut: '13:00', pauseFin: '14:00' } })
    }
  })

  it('validation : les deux bornes ou aucune, la fin après le début', () => {
    expect(erreurPause('', '')).toBeNull()
    expect(erreurPause(null, undefined)).toBeNull()
    expect(erreurPause('13:00', '14:00')).toBeNull()
    expect(erreurPause('13:00', '')).toMatch(/début et la fin/)
    expect(erreurPause('14:00', '13:00')).toMatch(/après son début/)
  })
})

describe('accès du personnel lié au compte Clerk', () => {
  it('modifier l’email d’un membre déjà connecté ne coupe pas son accès', async () => {
    const m = await creerMembre('lie')
    const claims = { email: m.email }

    expect((await staffDepuisClerk('user_lie_' + suffixe, claims))?.id).toBe(m.id) // première connexion : par l'email, puis liaison
    expect((await prisma.user.findUniqueOrThrow({ where: { id: m.id } })).clerkId).toBe('user_lie_' + suffixe)

    // L'administrateur corrige l'email dans « Équipe » : le compte Clerk n'a pas changé d'adresse
    const nouvelEmail = `nouveau-${suffixe}@example.com`
    emails.push(nouvelEmail)
    await prisma.user.update({ where: { id: m.id }, data: { email: nouvelEmail } })
    oublierPersonnel()
    expect((await staffDepuisClerk('user_lie_' + suffixe, claims))?.id).toBe(m.id)
  })

  it('un membre désactivé perd l’accès, même lié', async () => {
    const m = await creerMembre('desactive')
    await staffDepuisClerk('user_des_' + suffixe, { email: m.email })
    await prisma.user.update({ where: { id: m.id }, data: { actif: false } })
    oublierPersonnel()
    expect(await staffDepuisClerk('user_des_' + suffixe, { email: m.email })).toBeNull()
  })

  it('une fiche liée à un compte n’est pas ouverte à un autre compte qui reprendrait son adresse', async () => {
    const m = await creerMembre('autre')
    await staffDepuisClerk('user_a_' + suffixe, { email: m.email })
    oublierPersonnel()
    expect(await staffDepuisClerk('user_b_' + suffixe, { email: m.email })).toBeNull()
  })

  it('un compte inconnu de l’équipe n’a aucun accès', async () => {
    expect(await staffDepuisClerk('user_inconnu_' + suffixe, { email: `personne-${suffixe}@example.com` })).toBeNull()
  })
})
