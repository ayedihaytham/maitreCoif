// Test d'intégration (base locale requise) : pack avec prestation (rendez-vous réservé en même temps),
// expiration et rappel des réservations, suppression en cascade d'un produit. Les envois sont simulés.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { prisma } from '@/lib/prisma'
import { assertLocalDatabase } from './assert-local-db'

assertLocalDatabase()

const m = vi.hoisted(() => ({
  contenu: vi.fn(async (..._a: unknown[]) => ({ sent: true })),
  confirmation: vi.fn(async (..._a: unknown[]) => ({ sent: true })),
  whatsapp: vi.fn(async (..._a: unknown[]) => ({ sent: false })),
  alerte: vi.fn(async (..._a: unknown[]) => undefined),
}))

vi.mock('@/lib/auth', () => ({ auth: async () => ({ user: { id: 'gerant-test', role: 'ADMIN', email: 'g@example.com', name: 'Gérant' } }) }))
vi.mock('@/lib/notifications', async (original) => ({
  ...(await original<typeof import('@/lib/notifications')>()),
  envoyerContenu: m.contenu,
  envoyerConfirmationEmail: m.confirmation,
}))
vi.mock('@/lib/whatsapp', async (original) => ({ ...(await original<typeof import('@/lib/whatsapp')>()), envoyerConfirmationWhatsapp: m.whatsapp }))
vi.mock('@/lib/alerte-salon', () => ({ alerterSalon: m.alerte }))

import * as routeProduit from '@/app/api/admin/produits/[id]/route'
import * as routePacks from '@/app/api/admin/packs/route'
import * as routeCommandes from '@/app/api/boutique/commandes/route'
import { changerStatutCommande, creerCommande, resoudrePanier } from '@/lib/boutique'
import { expirerCommandesEchues, rappelerCommandes } from '@/lib/boutique-expiration'

const suffixe = Date.now()
const DATE = '2099-06-16' // un mardi, loin dans le futur
const IP = `203.0.114.${Math.floor(Math.random() * 200) + 1}`
const ids: Record<string, string> = {}

const requete = (corps: unknown, methode = 'POST') =>
  new Request('http://test/api', { method: methode, headers: { 'Content-Type': 'application/json', 'x-real-ip': IP }, body: JSON.stringify(corps) })
const suppression = (cascade: boolean) => new Request(`http://test/api${cascade ? '?cascade=1' : ''}`, { method: 'DELETE', headers: { 'x-real-ip': IP } })
const ctxId = (id: string) => ({ params: Promise.resolve({ id }) })
const client = { clientNom: 'Sami Ben Ali', clientTelephone: '20 130 289', clientEmail: `sami-c-${suffixe}@example.com`, retrait: 'SALON' as const, jourSouhaite: null, notes: null }
const corpsClient = { clientNom: client.clientNom, clientTelephone: client.clientTelephone, clientEmail: client.clientEmail, retrait: 'SALON' }
const lignesPack = (quantite = 1) => [{ type: 'pack' as const, id: ids.pack, quantite }]
const stock = async () => (await prisma.produit.findUniqueOrThrow({ where: { id: ids.huile } })).stock

beforeAll(async () => {
  const coiffeur = await prisma.user.create({ data: { nom: 'Test', prenom: 'Pack', email: `coiffeur-pack-${suffixe}@example.com`, motDePasseHash: 'x', role: 'COIFFEUR' } })
  await prisma.disponibilite.create({ data: { coiffeurId: coiffeur.id, jourSemaine: new Date(`${DATE}T00:00:00Z`).getUTCDay(), heureDebut: '09:00', heureFin: '18:00' } })
  const service = await prisma.service.create({ data: { nom: `Taille c ${suffixe}`, prix: 20, duree: 30 } })
  const huile = await prisma.produit.create({ data: { nom: `Huile c ${suffixe}`, prix: 40, stock: 10 } })
  const pack = await prisma.pack.create({
    data: {
      nom: `Pack Barbier c ${suffixe}`,
      remiseType: 'POURCENTAGE',
      remiseValeur: 25, // 60 DT -> 45 DT
      lignes: { create: [{ serviceId: service.id, quantite: 1, ordre: 0 }, { produitId: huile.id, quantite: 1, ordre: 1 }] },
    },
  })
  Object.assign(ids, { coiffeur: coiffeur.id, service: service.id, huile: huile.id, pack: pack.id })
})

beforeEach(async () => {
  for (const f of Object.values(m)) f.mockClear()
  await prisma.produit.updateMany({ where: { id: ids.huile }, data: { stock: 10, actif: true } })
  await prisma.pack.updateMany({ where: { id: ids.pack }, data: { actif: true } })
})

afterAll(async () => {
  await prisma.commande.deleteMany({ where: { clientEmail: { contains: String(suffixe) } } })
  await prisma.rendezVous.deleteMany({ where: { coiffeurId: ids.coiffeur } })
  await prisma.pack.deleteMany({ where: { nom: { contains: String(suffixe) } } })
  await prisma.produit.deleteMany({ where: { nom: { contains: String(suffixe) } } })
  await prisma.service.deleteMany({ where: { nom: { contains: String(suffixe) } } })
  await prisma.disponibilite.deleteMany({ where: { coiffeurId: ids.coiffeur } })
  await prisma.user.deleteMany({ where: { id: ids.coiffeur } })
  await prisma.rateLimitHit.deleteMany({ where: { key: { contains: IP } } })
  await prisma.$disconnect()
})

const creneau = (heureDebut: string) => ({ coiffeurId: ids.coiffeur, date: DATE, heureDebut })

describe('pack avec prestation', () => {
  it('le panier réclame un créneau et limite le pack à un exemplaire', async () => {
    const p = await resoudrePanier(lignesPack(3))
    expect(p.rendezVous).toMatchObject({ serviceIds: [ids.service], duree: 30 })
    expect(p.lignes[0].quantite).toBe(1)
    expect(p.problemes.join(' ')).toMatch(/un seul exemplaire/)
  })

  it('refuse la réservation sans créneau, sans rien décompter ni créer', async () => {
    const r = await creerCommande({ ...client, lignes: lignesPack() })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problemes[0]).toMatch(/Choisissez le créneau/)
    expect(await stock()).toBe(10)
    expect(await prisma.rendezVous.count({ where: { coiffeurId: ids.coiffeur } })).toBe(0)
  })

  it('crée le rendez-vous et la réservation ensemble, le rendez-vous portant la part de prestation du prix remisé', async () => {
    const r = await creerCommande({ ...client, lignes: lignesPack(), rendezVous: creneau('10:00') })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.commande.rendezVousId).toBe(r.rendezVous?.id)
    expect(r.commande.retrait).toBe('RDV')
    expect(r.commande.jourSouhaite).toMatch(/10:00/)
    expect(await stock()).toBe(9)

    const rdv = await prisma.rendezVous.findUniqueOrThrow({ where: { id: r.rendezVous!.id }, include: { lignes: true } })
    expect(rdv.statut).toBe('CONFIRME')
    expect(rdv.heureDebut).toBe('10:00')
    expect(rdv.heureFin).toBe('10:30')
    expect(Number(rdv.lignes[0].prix)).toBe(15) // 20 DT × (45 / 60)
  })

  it('un créneau déjà pris est refusé : rien n’est décompté', async () => {
    const premier = await creerCommande({ ...client, lignes: lignesPack(), rendezVous: creneau('11:00') })
    expect(premier.ok).toBe(true)
    const second = await creerCommande({ ...client, lignes: lignesPack(), rendezVous: creneau('11:00') })
    expect(second.ok).toBe(false)
    expect(await stock()).toBe(9)
  })

  it('si la réservation échoue après la prise du créneau, le créneau est rendu', async () => {
    await prisma.produit.update({ where: { id: ids.huile }, data: { stock: 1 } })
    const avant = await prisma.rendezVous.count({ where: { coiffeurId: ids.coiffeur } })
    const resultats = await Promise.all([
      creerCommande({ ...client, lignes: lignesPack(), rendezVous: creneau('14:00') }),
      creerCommande({ ...client, lignes: lignesPack(), rendezVous: creneau('15:00') }),
    ])
    expect(resultats.filter((r) => r.ok)).toHaveLength(1)
    expect(await prisma.rendezVous.count({ where: { coiffeurId: ids.coiffeur } })).toBe(avant + 1)
  })

  it('annuler la réservation annule aussi le rendez-vous ; l’expiration, non', async () => {
    const a = await creerCommande({ ...client, lignes: lignesPack(), rendezVous: creneau('16:00') })
    const b = await creerCommande({ ...client, lignes: lignesPack(), rendezVous: creneau('17:00') })
    if (!a.ok || !b.ok) throw new Error('réservation')
    await changerStatutCommande(a.commande.id, 'ANNULEE')
    await changerStatutCommande(b.commande.id, 'EXPIREE')
    expect((await prisma.rendezVous.findUniqueOrThrow({ where: { id: a.rendezVous!.id } })).statut).toBe('ANNULE')
    expect((await prisma.rendezVous.findUniqueOrThrow({ where: { id: b.rendezVous!.id } })).statut).toBe('CONFIRME')
  })

  it('route : confirmation de la réservation (avec le rendez-vous) et du rendez-vous', async () => {
    const r = await routeCommandes.POST(requete({ ...corpsClient, lignes: lignesPack(), rendezVous: creneau('09:00') }))
    expect(r.status).toBe(201)
    const [to, , contenu] = m.contenu.mock.calls[0] as [string, string, { intro: string[]; lignes: [string, string][] }]
    expect(to).toBe(client.clientEmail)
    expect(contenu.intro.join(' ')).toMatch(/Votre rendez-vous est confirmé/)
    expect(contenu.lignes.some(([l]) => l === 'Rendez-vous')).toBe(true)
    expect(m.confirmation).toHaveBeenCalledTimes(1) // email de suivi du rendez-vous
    expect(String(m.alerte.mock.calls[0][1])).toMatch(/Rendez-vous :/)
  })

  it('route : sans créneau, 409 et message clair', async () => {
    const r = await routeCommandes.POST(requete({ ...corpsClient, lignes: lignesPack() }))
    expect(r.status).toBe(409)
    expect((await r.json()).error).toMatch(/Choisissez le créneau/)
  })

  it('un pack ne peut comprendre qu’une seule fois chaque prestation, 5 au plus', async () => {
    const doublePrestation = await routePacks.POST(requete({ nom: `X ${suffixe}`, remiseType: 'POURCENTAGE', remiseValeur: 10, lignes: [{ type: 'service', id: ids.service, quantite: 2 }, { type: 'produit', id: ids.huile, quantite: 1 }] }))
    expect(doublePrestation.status).toBe(400)
    expect((await doublePrestation.json()).error).toMatch(/qu’une seule fois/)
  })
})

describe('expiration et rappel', () => {
  async function reserver(heures: number) {
    const r = await creerCommande({ ...client, retrait: 'SALON', jourSouhaite: null, notes: null, lignes: [{ type: 'produit', id: ids.huile, quantite: 2 }] })
    if (!r.ok) throw new Error(r.problemes.join())
    await prisma.commande.update({ where: { id: r.commande.id }, data: { expireLe: new Date(Date.now() + heures * 3600_000) } })
    m.contenu.mockClear()
    return r.commande
  }
  const sujets = () => m.contenu.mock.calls.filter((c) => c[0] === client.clientEmail).map((c) => String(c[1]))

  it('rappel 24 h avant : envoyé une seule fois, puis de nouveau après un passage à « prête »', async () => {
    const c = await reserver(10)
    expect(await rappelerCommandes()).toBeGreaterThanOrEqual(1)
    expect(sujets().filter((s) => /Plus que 24 h/.test(s))).toHaveLength(1)
    expect(await rappelerCommandes()).toBe(0)
    expect((await prisma.commande.findUniqueOrThrow({ where: { id: c.id } })).rappelEnvoye).toBe(true)

    await changerStatutCommande(c.id, 'PRETE') // le délai repart : le rappel aussi
    expect((await prisma.commande.findUniqueOrThrow({ where: { id: c.id } })).rappelEnvoye).toBe(false)
  })

  it('pas de rappel pour une réservation qui expire dans plus de 24 h', async () => {
    await reserver(72)
    await rappelerCommandes()
    expect(sujets().filter((s) => /Plus que 24 h/.test(s))).toHaveLength(0)
  })

  it('l’expiration rend le stock et prévient le client', async () => {
    const c = await reserver(-1)
    expect(await stock()).toBe(8)
    expect(await expirerCommandesEchues()).toBeGreaterThanOrEqual(1)
    expect(await stock()).toBe(10)
    expect((await prisma.commande.findUniqueOrThrow({ where: { id: c.id } })).statut).toBe('EXPIREE')
    expect(sujets().some((s) => /a expiré/.test(s))).toBe(true)
    expect(await expirerCommandesEchues()).toBe(0)
  })
})

describe('suppression en cascade d’un produit', () => {
  it('montre l’impact, puis retire le produit des packs, annule les réservations et prévient les clients', async () => {
    const reserve = await creerCommande({ ...client, lignes: lignesPack(), rendezVous: creneau('12:00') })
    if (!reserve.ok) throw new Error('réservation')
    m.contenu.mockClear()

    const refus = await routeProduit.DELETE(suppression(false), ctxId(ids.huile))
    expect(refus.status).toBe(409)
    expect((await refus.json()).impact.commandes).toBeGreaterThanOrEqual(1)
    expect(await prisma.produit.findUnique({ where: { id: ids.huile } })).not.toBeNull()

    const ok = await routeProduit.DELETE(suppression(true), ctxId(ids.huile))
    expect(ok.status).toBe(200)
    const corps = await ok.json()
    expect(corps).toMatchObject({ supprime: true, packsModifies: 1 })
    expect(corps.commandesAnnulees).toBeGreaterThanOrEqual(1)
    expect(corps.clientsPrevenus).toBe(corps.commandesAnnulees)
    expect(await prisma.produit.findUnique({ where: { id: ids.huile } })).toBeNull()

    // La réservation et son rendez-vous sont annulés, le client reçoit l'email d'annulation
    expect((await prisma.commande.findUniqueOrThrow({ where: { id: reserve.commande.id } })).statut).toBe('ANNULEE')
    expect((await prisma.rendezVous.findUniqueOrThrow({ where: { id: reserve.rendezVous!.id } })).statut).toBe('ANNULE')
    expect(m.contenu.mock.calls.some((c) => /Réservation annulée/.test(String(c[1])))).toBe(true)

    // Le pack n'a plus que sa prestation : il reste, sans le produit
    const pack = await prisma.pack.findUniqueOrThrow({ where: { id: ids.pack }, include: { lignes: true } })
    expect(pack.lignes).toHaveLength(1)
    expect(pack.lignes[0].serviceId).toBe(ids.service)
  })

  it('un pack qui n’a plus aucun élément est désactivé', async () => {
    const solo = await prisma.produit.create({ data: { nom: `Solo c ${suffixe}`, prix: 5, stock: 1 } })
    const pack = await prisma.pack.create({ data: { nom: `Pack solo c ${suffixe}`, remiseType: 'POURCENTAGE', remiseValeur: 10, lignes: { create: [{ produitId: solo.id, quantite: 1 }] } } })
    expect((await routeProduit.DELETE(suppression(false), ctxId(solo.id))).status).toBe(409)
    expect((await routeProduit.DELETE(suppression(true), ctxId(solo.id))).status).toBe(200)
    const apres = await prisma.pack.findUniqueOrThrow({ where: { id: pack.id }, include: { lignes: true } })
    expect(apres.lignes).toHaveLength(0)
    expect(apres.actif).toBe(false)
  })
})
