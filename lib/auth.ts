import { auth as clerkAuth } from '@clerk/nextjs/server'
import type { Session } from 'next-auth'
import { cache } from 'react'

import { clerkConfigured, staffDepuisClerk } from '@/lib/staff'

/**
 * Session courante : uniquement le PERSONNEL, authentifié par Clerk. Il n'existe plus de compte client
 * (les réservations se font sans compte, le suivi par lien ou code) : aucune autre porte d'entrée.
 * Le type « Session » reste celui d'Auth.js (types/next-auth.d.ts) pour ne pas changer les ~25 appelants.
 */
export const auth = cache(async (): Promise<Session | null> => {
  if (!clerkConfigured()) return null

  const { userId, sessionClaims } = await clerkAuth()
  const staff = await staffDepuisClerk(userId, sessionClaims)
  if (!staff) return null

  return {
    user: { id: staff.id, email: staff.email, name: staff.name, role: staff.role },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  }
})
