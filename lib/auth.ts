import { auth as clerkAuth } from '@clerk/nextjs/server'
import bcrypt from 'bcryptjs'
import NextAuth, { type Session } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { cache } from 'react'

import { prisma } from '@/lib/prisma'
import { checkRateLimit, clientIpFrom } from '@/lib/rate-limit'
import { clerkConfigured, staffDepuisClerk } from '@/lib/staff'
import { loginSchema } from '@/lib/validators'

// Auth.js ne gère plus que les CLIENTS. Le personnel passe par Clerk.
export const {
  handlers,
  auth: authClient,
  signIn,
  signOut,
} = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/connexion' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        // Anti brute-force : limite par email (cible) et par IP (source).
        const ip = clientIpFrom(request.headers)
        const email = parsed.data.email.toLowerCase()
        const [emailOk, ipOk] = await Promise.all([
          checkRateLimit(`login-email:${email}`, 10, 15 * 60 * 1000),
          checkRateLimit(`login-ip:${ip}`, 30, 15 * 60 * 1000),
        ])
        if (!emailOk || !ipOk) return null

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
        if (!user || !user.actif) return null
        // Le personnel se connecte exclusivement via Clerk : son ancien mot de
        // passe (ex. comptes de démo) ne doit plus ouvrir aucune session.
        if (user.role !== 'CLIENT') return null

        const valid = await bcrypt.compare(parsed.data.password, user.motDePasseHash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: `${user.prenom} ${user.nom}`,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // authorize() ci-dessus renvoie toujours un id ; non défini uniquement
        // pour les providers OAuth que ce projet n'utilise pas.
        token.id = user.id as string
        token.role = user.role
        return token
      }

      // Le JWT vit 30 jours : on relit l'utilisateur en base pour qu'un compte
      // désactivé soit déconnecté immédiatement et qu'un changement de rôle
      // soit pris en compte sans attendre une reconnexion.
      const current = await prisma.user.findUnique({
        where: { id: token.id },
        select: { actif: true, role: true },
      })
      if (!current || !current.actif) return null
      token.role = current.role
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.role = token.role
      }
      return session
    },
  },
})

/** Session du personnel (Clerk), mise en cache le temps d'une requête. */
const sessionPersonnel = cache(async (): Promise<Session | null> => {
  if (!clerkConfigured()) return null

  const { userId, sessionClaims } = await clerkAuth()
  const staff = await staffDepuisClerk(userId, sessionClaims)
  if (!staff) return null

  return {
    user: { id: staff.id, email: staff.email, name: staff.name, role: staff.role },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  }
})

/**
 * Session courante, quel que soit le système : personnel (Clerk) en priorité,
 * sinon client (Auth.js). Les ~25 appelants existants n'ont pas à changer.
 */
export async function auth(): Promise<Session | null> {
  return (await sessionPersonnel()) ?? (await authClient())
}
