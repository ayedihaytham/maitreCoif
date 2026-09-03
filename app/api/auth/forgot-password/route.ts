import crypto from 'node:crypto'

import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { envoyerResetPasswordEmail } from '@/lib/notifications'
import { checkRateLimit, clientIpFrom } from '@/lib/rate-limit'
import { forgotPasswordSchema } from '@/lib/validators-auth'

export async function POST(request: Request) {
  const ip = clientIpFrom(request.headers)
  if (!checkRateLimit(`forgot-password:${ip}`, 6, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'Trop de tentatives, veuillez réessayer plus tard.' }, { status: 429 })
  }

  const body = await request.json()
  const parsed = forgotPasswordSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })

  // Réponse identique que l'utilisateur existe ou non, pour ne pas révéler
  // quels emails sont enregistrés (énumération de comptes).
  if (user && user.actif) {
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } })

    const origin = process.env.AUTH_URL || new URL(request.url).origin
    const resetUrl = `${origin}/reinitialiser-mot-de-passe?token=${token}`
    await envoyerResetPasswordEmail(user.email, user.prenom, resetUrl)
  }

  return NextResponse.json({ ok: true })
}
