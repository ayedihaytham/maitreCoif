import { clerkClient } from '@clerk/nextjs/server'
import type { Role } from '@prisma/client'

import { prisma } from '@/lib/prisma'

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

export async function staffDepuisClerk(userId: string | null | undefined, claims: Claims): Promise<StaffUser | null> {
  if (!userId) return null

  try {
    const email = await emailVerifie(userId, claims)
    if (!email) return null

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, role: { in: ['COIFFEUR', 'ADMIN'] }, actif: true },
      select: { id: true, email: true, prenom: true, nom: true, role: true },
    })
    if (!user || (user.role !== 'COIFFEUR' && user.role !== 'ADMIN')) return null

    return { id: user.id, email: user.email, name: `${user.prenom} ${user.nom}`, role: user.role }
  } catch (error) {
    // Fail closed : une panne de Clerk ou de la base ne doit jamais ouvrir l'accès.
    console.error('[staff] Impossible de résoudre le membre de l’équipe', error)
    return null
  }
}

export type ResultatInvitation = 'envoyee' | 'deja_inscrit' | 'non_configure' | 'echec'

/**
 * Invite un nouveau membre à créer son accès Clerk (email envoyé par Clerk,
 * lien vers /espace-equipe/inscription). N'échoue jamais : la fiche en base
 * est créée de toute façon et l'invitation peut se refaire depuis Clerk.
 */
export async function inviterMembre(email: string): Promise<ResultatInvitation> {
  if (!clerkConfigured()) return 'non_configure'

  const site = (process.env.AUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
  try {
    const client = await clerkClient()
    await client.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: `${site}/espace-equipe/inscription`,
      ignoreExisting: true,
    })
    return 'envoyee'
  } catch (error) {
    const codes = (error as { errors?: { code?: string }[] }).errors?.map((e) => e.code) ?? []
    if (codes.includes('form_identifier_exists')) return 'deja_inscrit'
    console.error('[staff] Invitation Clerk impossible', error)
    return 'echec'
  }
}
