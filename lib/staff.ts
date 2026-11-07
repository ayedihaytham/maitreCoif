import { clerkClient } from '@clerk/nextjs/server'
import type { Role } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { SALON_HOST, salonUrl } from '@/lib/salon-host'

/**
 * Le personnel (coiffeurs + administrateurs) s'authentifie avec Clerk ; les
 * clients restent sur Auth.js (cf. lib/auth.ts). Clerk prouve l'identité, la
 * table `User` reste la source de vérité des rôles : un compte Clerk n'a accès
 * au back-office que si son email VÉRIFIÉ correspond à un membre actif de
 * l'équipe en base. Un compte Clerk inconnu n'a donc aucun droit.
 */

/** Vrai quand les clés Clerk sont présentes (sinon le back-office est fermé). */
export function clerkConfigured() {
  return Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
}

export interface StaffUser {
  id: string
  email: string
  name: string
  role: Extract<Role, 'COIFFEUR' | 'ADMIN'>
}

type Claims = Record<string, unknown> | null | undefined

/**
 * Email vérifié de l'utilisateur Clerk. On lit d'abord la claim `email` du
 * jeton de session (aucun appel réseau) ; si elle n'est pas configurée dans
 * Clerk, on interroge l'API et on exige un email principal vérifié.
 */
async function emailVerifie(userId: string, claims: Claims): Promise<string | null> {
  const claim = claims?.email
  if (typeof claim === 'string' && claim.includes('@')) return claim

  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const principal = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
  return principal?.verification?.status === 'verified' ? principal.emailAddress : null
}

// Chaque navigation du back-office résout l'identité plusieurs fois (proxy, layout, page) et,
// sans claim `email` dans le jeton, appelle l'API Clerk à chaque fois. On garde le résultat
// 30 s par utilisateur. Un membre désactivé perd donc son accès au plus 30 s plus tard ;
// `oublierPersonnel()` vide la mémoire dès qu'on modifie l'équipe depuis cette instance.
const DUREE_MEMOIRE_MS = 30_000
const memoire = new Map<string, { jusqua: number; staff: StaffUser | null }>()

export function oublierPersonnel() {
  memoire.clear()
}

export async function staffDepuisClerk(userId: string | null | undefined, claims: Claims): Promise<StaffUser | null> {
  if (!userId) return null

  const connu = memoire.get(userId)
  if (connu && connu.jusqua > Date.now()) return connu.staff

  const staff = await resoudrePersonnel(userId, claims)
  // Un échec technique (null) n'est pas mémorisé trop longtemps : on réessaie vite.
  memoire.set(userId, { jusqua: Date.now() + (staff ? DUREE_MEMOIRE_MS : 5_000), staff })
  if (memoire.size > 200) memoire.delete(memoire.keys().next().value as string)
  return staff
}

async function resoudrePersonnel(userId: string, claims: Claims): Promise<StaffUser | null> {
  try {
    const choix = { id: true, email: true, prenom: true, nom: true, role: true, clerkId: true } as const
    const estEquipe = { in: ['COIFFEUR', 'ADMIN'] as Role[] }

    // 1. Fiche déjà liée à ce compte Clerk : l'accès ne dépend plus de l'email, qu'on peut donc modifier
    //    dans « Équipe » sans couper l'accès de la personne.
    let user = await prisma.user.findFirst({ where: { clerkId: userId, role: estEquipe, actif: true }, select: choix })

    // 2. Première connexion : on rapproche l'email vérifié du compte Clerk de la fiche, puis on les lie.
    if (!user) {
      const email = await emailVerifie(userId, claims)
      if (!email) return null
      user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, role: estEquipe, actif: true }, select: choix })
      if (!user) return null
      // Une fiche déjà liée à un autre compte Clerk n'est pas ouverte à qui reprendrait simplement son adresse.
      if (user.clerkId && user.clerkId !== userId) return null
      if (!user.clerkId) {
        await prisma.user.updateMany({ where: { id: user.id, clerkId: null }, data: { clerkId: userId } }).catch((e) => console.error('[staff] Liaison du compte Clerk impossible', e))
      }
    }
    if (user.role !== 'COIFFEUR' && user.role !== 'ADMIN') return null

    return { id: user.id, email: user.email, name: `${user.prenom} ${user.nom}`, role: user.role }
  } catch (error) {
    // Fail closed : une panne de Clerk ou de la base ne doit jamais ouvrir l'accès.
    console.error('[staff] Impossible de résoudre le membre de l’équipe', error)
    return null
  }
}

export type ResultatInvitation = 'envoyee' | 'deja_inscrit' | 'non_configure' | 'echec'

/** Message lisible d'une erreur de l'API Clerk (montré à l'administrateur). */
function detailClerk(error: unknown): string {
  const erreurs = (error as { errors?: { code?: string; longMessage?: string; message?: string }[] }).errors
  const premiere = erreurs?.[0]
  if (premiere) return [premiere.code, premiere.longMessage ?? premiere.message].filter(Boolean).join(' : ')
  return error instanceof Error ? error.message : 'erreur inconnue'
}

/**
 * Invite un membre à créer son accès Clerk : Clerk lui envoie un email avec un
 * lien vers l'inscription du sous-domaine salon, où il choisit son mot de
 * passe (le compte Clerk est créé à ce moment-là). N'échoue jamais : la fiche
 * en base existe de toute façon et l'invitation peut être renvoyée.
 */
export async function inviterMembre(email: string): Promise<{ statut: ResultatInvitation; detail?: string }> {
  if (!clerkConfigured()) {
    return { statut: 'non_configure', detail: 'clés Clerk absentes (CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)' }
  }
  if (!SALON_HOST) return { statut: 'non_configure', detail: 'NEXT_PUBLIC_SALON_HOST non défini' }

  try {
    const client = await clerkClient()
    await client.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: salonUrl('/inscription'),
      ignoreExisting: true,
    })
    return { statut: 'envoyee' }
  } catch (error) {
    const codes = (error as { errors?: { code?: string }[] }).errors?.map((e) => e.code) ?? []
    if (codes.includes('form_identifier_exists')) return { statut: 'deja_inscrit' }
    console.error('[staff] Invitation Clerk impossible', error)
    return { statut: 'echec', detail: detailClerk(error) }
  }
}
