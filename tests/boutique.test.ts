// Test d'intégration (base locale requise) : réservation de produits et de packs, stock, statuts et emails.
// L'envoi des emails et des alertes est simulé : on vérifie qui reçoit quoi, et quand.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { prisma } from '@/lib/prisma'
import { assertLocalDatabase } from './assert-local-db'

assertLocalDatabase()

const m = vi.hoisted(() => ({
  contenu: vi.fn(async (..._a: unknown[]) => ({ sent: true })),
  alerte: vi.fn(async (..._a: unknown[]) => undefined),
  role: { valeur: 'ADMIN' as 'ADMIN' | 'COIFFEUR' | 'CLIENT' | null },
}))

vi.mock('@/lib/auth', () => ({
  auth: async () => (m.role.valeur ? { user: { id: 'gerant-test', role: m.role.valeur, email: 'g@example.com', name: 'Gérant' } } : null),
}))
vi.mock('@/lib/notifications', async (original) => ({
  ...(await original<typeof import('@/lib/notifications')>()),
  envoyerContenu: m.contenu,
}))
vi.mock('@/lib/alerte-salon', () => ({ alerterSalon: m.alerte }))

import { creerCommande, changerStatutCommande, commandesEchues, dansLaPeriode, prixPack, quantitesParProduit, resoudrePanier } from '@/lib/boutique'
import * as routeProduits from '@/app/api/admin/produits/route'
import * as routeProduit from '@/app/api/admin/produits/[id]/route'
import * as routePacks from '@/app/api/admin/packs/route'
import * as routePack from '@/app/api/admin/packs/[id]/route'
import * as routeStatut from '@/app/api/admin/commandes/[id]/route'
import * as routeCommandes from '@/app/api/boutique/commandes/route'
import * as routeAnnuler from '@/app/api/boutique/commandes/[code]/annuler/route'
import * as routePanier from '@/app/api/boutique/panier/route'

const suffixe = Date.now()
const IP = `203.0.113.${Math.floor(Math.random() * 200) + 1}`
const ids: Record<string, string> = {}

const requete = (corps: unknown, methode = 'POST') =>
  new Request('http://test/api', { method: methode, headers: { 'Content-Type': 'application/json', 'x-real-ip': IP }, body: JSON.stringify(corps) })
const ctxId = (id: string) => ({ params: Promise.resolve({ id }) })
const ctxCode = (code: string) => ({ params: Promise.resolve({ code }) })

const client = { clientNom: 'Sami Ben Ali', clientTelephone: '20 130 289', clientEmail: `sami-${suffixe}@example.com`, retrait: 'SALON' as const }

async function stock(cle: string) {
  return (await prisma.produit.findUniqueOrThrow({ where: { id: ids[cle] } })).stock
}

beforeAll(async () => {
  const huile = await prisma.produit.create({ data: { nom: `Huile test ${suffixe}`, prix: 24, stock: 10, categorie: 'Barbe' } })
  const baume = await prisma.produit.create({ data: { nom: `Baume test ${suffixe}`, prix: 18, stock: 5 } })
  const rare = await prisma.produit.create({ data: { nom: `Rare test ${suffixe}`, prix: 30, stock: 1 } })
  const peigne = await prisma.produit.create({ data: { nom: `Peigne test ${suffixe}`, prix: 18, stock: 50 } })
  Object.assign(ids, { huile: huile.id, baume: baume.id, rare: rare.id, peigne: peigne.id })

  const pack = await prisma.pack.create({
    data: {
      nom: `Pack Barbier test ${suffixe}`,
      remiseType: 'POURCENTAGE',
      remiseValeur: 15,
      lignes: {
        create: [
          { produitId: peigne.id, quantite: 1, ordre: 0 },
          { produitId: huile.id, quantite: 1, ordre: 1 },
          { produitId: baume.id, quantite: 1, ordre: 2 },
        ],
      },
    },
  })
  ids.pack = pack.id
})

beforeEach(async () => {
  m.contenu.mockClear()
  m.alerte.mockClear()
  m.role.valeur = 'ADMIN'
  await prisma.produit.update({ where: { id: ids.huile }, data: { stock: 10, actif: true } })
  await prisma.produit.update({ where: { id: ids.baume }, data: { stock: 5, actif: true } })
  await prisma.produit.update({ where: { id: ids.rare }, data: { stock: 1, actif: true } })
  await prisma.pack.update({ where: { id: ids.pack }, data: { actif: true, debut: null, fin: null } })
})

afterAll(async () => {
  await prisma.commande.deleteMany({ where: { clientEmail: { contains: String(suffixe) } } })
  await prisma.pack.deleteMany({ where: { nom: { contains: String(suffixe) } } })
  await prisma.produit.deleteMany({ where: { nom: { contains: String(suffixe) } } })
  await prisma.rateLimitHit.deleteMany({ where: { key: { contains: IP } } })
  await prisma.$disconnect()
})

describe('calculs', () => {
  it('remise en pourcentage : le prix du pack découle du prix normal', () => {
    expect(prixPack([{ quantite: 1, prix: 18 }, { quantite: 1, prix: 24 }, { quantite: 1, prix: 18 }], 'POURCENTAGE', 15)).toEqual({ normal: 60, final: 51, economie: 9, pourcentage: 15 })
  })
  it('prix fixe : jamais supérieur au prix normal', () => {
    expect(prixPack([{ quantite: 2, prix: 10 }], 'PRIX_FIXE', 15)).toMatchObject({ normal: 20, final: 15, economie: 5, pourcentage: 25 })
    expect(prixPack([{ quantite: 1, prix: 10 }], 'PRIX_FIXE', 50)).toMatchObject({ final: 10, economie: 0, pourcentage: 0 })
  })
  it('période de validité : bornes incluses, facultative', () => {
    const d = (j: string) => new Date(`${j}T00:00:00Z`)
    expect(dansLaPeriode(null, null, '2026-11-07')).toBe(true)
    expect(dansLaPeriode(d('2026-11-07'), d('2026-11-07'), '2026-11-07')).toBe(true)
    expect(dansLaPeriode(d('2026-11-08'), null, '2026-11-07')).toBe(false)
    expect(dansLaPeriode(null, d('2026-11-06'), '2026-11-07')).toBe(false)
  })
  it('stock à décompter : produits seuls et produits des packs additionnés', () => {
    const detail = [{ type: 'produit', produitId: 'a', nom: 'A', quantite: 2, prix: 1 }, { type: 'service', serviceId: 's', nom: 'S', quantite: 1, prix: 1 }]
    const q = quantitesParProduit([
      { type: 'PRODUIT', produitId: 'a', quantite: 1 },
      { type: 'PACK', produitId: null, quantite: 3, detail },
    ])
    expect(q.get('a')).toBe(7)
    expect(q.size).toBe(1)
  })
})

describe('panier', () => {
  it('ignore les prix du navigateur et calcule le total avec les prix de la base', async () => {
    const p = await resoudrePanier([{ type: 'produit', id: ids.huile, quantite: 2 }, { type: 'pack', id: ids.pack, quantite: 1 }])
    expect(p.problemes).toEqual([])
    expect(p.total).toBe(48 + 51)
    expect(p.economie).toBe(9)
  })
  it('ajuste une quantité au stock et le signale', async () => {
    const p = await resoudrePanier([{ type: 'produit', id: ids.rare, quantite: 4 }])
    expect(p.lignes[0].quantite).toBe(1)
    expect(p.problemes.join(' ')).toMatch(/Il ne reste que 1/)
  })
  it('retire un produit désactivé ou en rupture', async () => {
    await prisma.produit.update({ where: { id: ids.baume }, data: { actif: false } })
    const p = await resoudrePanier([{ type: 'produit', id: ids.baume, quantite: 1 }])
    expect(p.lignes).toHaveLength(0)
    expect(p.problemes).toHaveLength(1)
  })
  it("masque un pack dont un produit est en rupture", async () => {
    await prisma.produit.update({ where: { id: ids.huile }, data: { stock: 0 } })
    const p = await resoudrePanier([{ type: 'pack', id: ids.pack, quantite: 1 }])
    expect(p.lignes).toHaveLength(0)
    expect(p.problemes[0]).toMatch(/n’est plus disponible/)
  })
  it('signale un produit demandé seul et dans un pack quand le stock ne suffit pas pour les deux', async () => {
    await prisma.produit.update({ where: { id: ids.baume }, data: { stock: 1 } })
    const p = await resoudrePanier([{ type: 'produit', id: ids.baume, quantite: 1 }, { type: 'pack', id: ids.pack, quantite: 1 }])
    expect(p.problemes.join(' ')).toMatch(/ne suffit pas/)
  })
  it('route : panier invalide refusé', async () => {
    const r = await routePanier.POST(requete({ lignes: [{ type: 'produit', id: 'pas-un-uuid', quantite: 1 }] }))
    expect(r.status).toBe(400)
  })
})

describe('réservation (route publique)', () => {
  it('crée la réservation, décompte le stock, prévient le client et alerte le salon', async () => {
    const r = await routeCommandes.POST(requete({ ...client, lignes: [{ type: 'produit', id: ids.huile, quantite: 2 }, { type: 'pack', id: ids.pack, quantite: 1 }] }))
    expect(r.status).toBe(201)
    const { code } = await r.json()
    expect(code).toMatch(/^PR-[A-Z0-9]{7}$/)

    // 2 huiles seules + 1 huile et 1 baume dans le pack
    expect(await stock('huile')).toBe(10 - 3)
    expect(await stock('baume')).toBe(5 - 1)

    const commande = await prisma.commande.findUniqueOrThrow({ where: { code }, include: { lignes: true } })
    expect(Number(commande.total)).toBe(99)
    expect(Number(commande.economie)).toBe(9)
    expect(commande.statut).toBe('A_PREPARER')
    expect(commande.expireLe.getTime()).toBeGreaterThan(Date.now() + 6.9 * 24 * 3600 * 1000)
    expect(commande.lignes).toHaveLength(2)

    // Email de confirmation au client (avec le code), et alerte au salon qui mentionne le pack
    expect(m.contenu).toHaveBeenCalledTimes(1)
    const [to, sujet, contenu] = m.contenu.mock.calls[0] as [string, string, { codeSuivi: string; titre: string }]
    expect(to).toBe(client.clientEmail)
    expect(sujet).toContain(code)
    expect(contenu.codeSuivi).toBe(code)
    expect(contenu.titre).toMatch(/pack est réservé/)
    expect(m.alerte).toHaveBeenCalledTimes(1)
    expect(String(m.alerte.mock.calls[0][0])).toMatch(/pack/i)
  })

  it("le sujet nomme le pack quand c'est la seule chose réservée", async () => {
    const r = await routeCommandes.POST(requete({ ...client, lignes: [{ type: 'pack', id: ids.pack, quantite: 1 }] }))
    expect(r.status).toBe(201)
    expect(String(m.contenu.mock.calls[0][1])).toContain(`Pack Barbier test ${suffixe}`)
  })

  it('refuse sans email : le client doit recevoir sa confirmation', async () => {
    const r = await routeCommandes.POST(requete({ ...client, clientEmail: '', lignes: [{ type: 'produit', id: ids.huile, quantite: 1 }] }))
    expect(r.status).toBe(400)
    expect(await stock('huile')).toBe(10)
    expect(m.contenu).not.toHaveBeenCalled()
  })

  it('refuse si le stock ne suffit plus, sans rien décompter', async () => {
    const r = await routeCommandes.POST(requete({ ...client, lignes: [{ type: 'produit', id: ids.huile, quantite: 1 }, { type: 'produit', id: ids.rare, quantite: 2 }] }))
    expect(r.status).toBe(409)
    expect(await stock('huile')).toBe(10)
    expect(await stock('rare')).toBe(1)
    expect(m.contenu).not.toHaveBeenCalled()
  })

  it('deux réservations simultanées du dernier exemplaire : une seule passe', async () => {
    const lancer = () => creerCommande({ ...client, jourSouhaite: null, notes: null, lignes: [{ type: 'produit', id: ids.rare, quantite: 1 }] })
    const resultats = await Promise.all([lancer(), lancer()])
    expect(resultats.filter((r) => r.ok)).toHaveLength(1)
    expect(await stock('rare')).toBe(0)
  })

  it('honeypot rempli : succès factice, rien créé', async () => {
    const avant = await prisma.commande.count()
    const r = await routeCommandes.POST(requete({ ...client, website: 'http://spam.test', lignes: [{ type: 'produit', id: ids.huile, quantite: 1 }] }))
    expect(r.status).toBe(201)
    expect(await prisma.commande.count()).toBe(avant)
    expect(m.contenu).not.toHaveBeenCalled()
  })
})

describe('statuts et emails (back-office)', () => {
  async function reserver(lignes: { type: 'produit' | 'pack'; id: string; quantite: number }[]) {
    const r = await creerCommande({ ...client, jourSouhaite: null, notes: null, lignes })
    if (!r.ok) throw new Error(r.problemes.join())
    m.contenu.mockClear()
    m.alerte.mockClear()
    return r.commande
  }

  it('« prête » : le client reçoit l’email « prête à retirer » et le délai repart', async () => {
    const c = await reserver([{ type: 'produit', id: ids.huile, quantite: 1 }])
    const r = await routeStatut.PATCH(requete({ statut: 'PRETE' }, 'PATCH'), ctxId(c.id))
    expect(r.status).toBe(200)
    expect((await r.json()).commande.statut).toBe('PRETE')
    expect(m.contenu).toHaveBeenCalledTimes(1)
    const [to, sujet] = m.contenu.mock.calls[0] as [string, string]
    expect(to).toBe(client.clientEmail)
    expect(sujet).toMatch(/prête à être retirée/)
    expect((await prisma.commande.findUniqueOrThrow({ where: { id: c.id } })).preteLe).not.toBeNull()
  })

  it('« retirée » : pas d’email, stock inchangé ; plus aucun changement possible ensuite', async () => {
    const c = await reserver([{ type: 'produit', id: ids.huile, quantite: 1 }])
    expect((await routeStatut.PATCH(requete({ statut: 'RETIREE' }, 'PATCH'), ctxId(c.id))).status).toBe(200)
    expect(m.contenu).not.toHaveBeenCalled()
    expect(await stock('huile')).toBe(9)
    expect((await routeStatut.PATCH(requete({ statut: 'ANNULEE' }, 'PATCH'), ctxId(c.id))).status).toBe(409)
    expect(await stock('huile')).toBe(9)
  })

  it('annulation par le salon : stock rendu (pack compris), client prévenu, pas d’alerte salon', async () => {
    const c = await reserver([{ type: 'produit', id: ids.huile, quantite: 2 }, { type: 'pack', id: ids.pack, quantite: 1 }])
    expect(await stock('huile')).toBe(7)
    const r = await routeStatut.PATCH(requete({ statut: 'ANNULEE' }, 'PATCH'), ctxId(c.id))
    expect(r.status).toBe(200)
    expect(await stock('huile')).toBe(10)
    expect(await stock('baume')).toBe(5)
    expect(String(m.contenu.mock.calls[0][1])).toMatch(/annulée/)
    expect(m.alerte).not.toHaveBeenCalled()
  })

  it('annuler deux fois ne rend pas le stock deux fois', async () => {
    const c = await reserver([{ type: 'produit', id: ids.huile, quantite: 2 }])
    await changerStatutCommande(c.id, 'ANNULEE')
    const encore = await changerStatutCommande(c.id, 'ANNULEE')
    expect(encore.ok).toBe(false)
    expect(await stock('huile')).toBe(10)
  })

  it('réservé au gérant : ni les clients ni les coiffeurs', async () => {
    const c = await reserver([{ type: 'produit', id: ids.huile, quantite: 1 }])
    m.role.valeur = 'CLIENT'
    expect((await routeStatut.PATCH(requete({ statut: 'PRETE' }, 'PATCH'), ctxId(c.id))).status).toBe(403)
    m.role.valeur = 'COIFFEUR'
    expect((await routeStatut.PATCH(requete({ statut: 'PRETE' }, 'PATCH'), ctxId(c.id))).status).toBe(403)
    m.role.valeur = 'ADMIN'
    expect((await routeStatut.PATCH(requete({ statut: 'PRETE' }, 'PATCH'), ctxId(c.id))).status).toBe(200)
  })

  it('expiration : le stock est rendu et seules les réservations échues sont concernées', async () => {
    const c = await reserver([{ type: 'produit', id: ids.huile, quantite: 3 }])
    expect((await commandesEchues()).some((e) => e.id === c.id)).toBe(false)
    await prisma.commande.update({ where: { id: c.id }, data: { expireLe: new Date(Date.now() - 1000) } })
    expect((await commandesEchues()).some((e) => e.id === c.id)).toBe(true)
    const r = await changerStatutCommande(c.id, 'EXPIREE')
    expect(r.ok).toBe(true)
    expect(await stock('huile')).toBe(10)
  })
})

describe('annulation par le client', () => {
  it('rend le stock, prévient le client et alerte le salon', async () => {
    const r1 = await creerCommande({ ...client, jourSouhaite: null, notes: null, lignes: [{ type: 'produit', id: ids.huile, quantite: 2 }] })
    if (!r1.ok) throw new Error('réservation')
    m.contenu.mockClear()
    m.alerte.mockClear()

    const r = await routeAnnuler.POST(requete({}), ctxCode(r1.commande.code))
    expect(r.status).toBe(200)
    expect(await stock('huile')).toBe(10)
    expect(m.contenu).toHaveBeenCalledTimes(1)
    expect(m.alerte).toHaveBeenCalledTimes(1)
    expect((await routeAnnuler.POST(requete({}), ctxCode(r1.commande.code))).status).toBe(409)
    expect((await routeAnnuler.POST(requete({}), ctxCode('PR-INCONNU1'))).status).toBe(404)
    expect((await routeAnnuler.POST(requete({}), ctxCode('nimporte'))).status).toBe(400)
  })
})

describe('catalogue (back-office)', () => {
  it('réservé à l’administrateur', async () => {
    m.role.valeur = 'COIFFEUR'
    expect((await routeProduits.GET()).status).toBe(403)
    expect((await routePacks.GET()).status).toBe(403)
    m.role.valeur = 'ADMIN'
    expect((await routeProduits.GET()).status).toBe(200)
  })

  it('crée, modifie et supprime un produit', async () => {
    const r = await routeProduits.POST(requete({ nom: `Cire test ${suffixe}`, prix: 22, stock: 4, categorie: 'Coiffage' }))
    expect(r.status).toBe(201)
    const { id } = await r.json()
    const p = await routeProduit.PATCH(requete({ stock: 9, actif: false }, 'PATCH'), ctxId(id))
    expect(p.status).toBe(200)
    expect(await p.json()).toMatchObject({ stock: 9, actif: false })
    expect((await routeProduit.DELETE(requete({}, 'DELETE'), ctxId(id))).status).toBe(200)
    expect(await prisma.produit.findUnique({ where: { id } })).toBeNull()
  })

  it('refuse un prix négatif ou un stock décimal', async () => {
    expect((await routeProduits.POST(requete({ nom: 'Test', prix: -5, stock: 1 }))).status).toBe(400)
    expect((await routeProduits.POST(requete({ nom: 'Test', prix: 5, stock: 1.5 }))).status).toBe(400)
  })

  it('un produit d’un pack ou d’une réservation en cours ne se supprime pas', async () => {
    const r = await routeProduit.DELETE(requete({}, 'DELETE'), ctxId(ids.huile))
    expect(r.status).toBe(409)
    const refus = await r.json()
    expect(refus.impact.packs.join()).toMatch(/Pack Barbier test/)

    const libre = await prisma.produit.create({ data: { nom: `Libre test ${suffixe}`, prix: 5, stock: 3 } })
    const c = await creerCommande({ ...client, jourSouhaite: null, notes: null, lignes: [{ type: 'produit', id: libre.id, quantite: 1 }] })
    if (!c.ok) throw new Error('réservation')
    expect((await routeProduit.DELETE(requete({}, 'DELETE'), ctxId(libre.id))).status).toBe(409)
    await changerStatutCommande(c.commande.id, 'RETIREE')
    expect((await routeProduit.DELETE(requete({}, 'DELETE'), ctxId(libre.id))).status).toBe(200)
    // L'historique garde le nom et le prix
    const ligne = await prisma.commandeLigne.findFirstOrThrow({ where: { commandeId: c.commande.id } })
    expect(ligne.nom).toBe(`Libre test ${suffixe}`)
    expect(ligne.produitId).toBeNull()
  })

  it('crée un pack, refuse un prix fixe supérieur au prix normal, puis le supprime', async () => {
    const lignes = [{ type: 'produit', id: ids.huile, quantite: 1 }, { type: 'produit', id: ids.baume, quantite: 1 }]
    const trop = await routePacks.POST(requete({ nom: `Cher test ${suffixe}`, remiseType: 'PRIX_FIXE', remiseValeur: 50, lignes }))
    expect(trop.status).toBe(400)
    expect((await trop.json()).error).toMatch(/inférieur au prix normal/)

    const ok = await routePacks.POST(requete({ nom: `Duo test ${suffixe}`, remiseType: 'PRIX_FIXE', remiseValeur: 36, lignes }))
    expect(ok.status).toBe(201)
    const pack = await ok.json()
    expect(pack.prix).toMatchObject({ normal: 42, final: 36, economie: 6, pourcentage: 14 })

    const doublon = await routePacks.POST(requete({ nom: `Doublon test ${suffixe}`, remiseType: 'POURCENTAGE', remiseValeur: 10, lignes: [lignes[0], lignes[0]] }))
    expect(doublon.status).toBe(400)

    const off = await routePack.PATCH(requete({ actif: false }, 'PATCH'), ctxId(pack.id))
    expect((await off.json()).actif).toBe(false)
    expect((await routePack.DELETE(requete({}, 'DELETE'), ctxId(pack.id))).status).toBe(200)
  })
})
