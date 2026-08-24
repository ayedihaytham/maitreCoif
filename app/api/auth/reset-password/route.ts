import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { checkRateLimit, clientIpFrom } from '@/lib/rate-limit'
import { resetPasswordSchema } from '@/lib/validators-auth'

export async function POST(request: Request) {
  const ip = clientIpFrom(request.headers)
  if (!checkRateLimit(`reset-password:${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'Trop de tentatives, veuillez réessayer plus tard.' }, { status: 429 })
  }

  const body = await request.json()
  const parsed = resetPasswordSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token: parsed.data.token } })
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Ce lien de réinitialisation est invalide ou expiré.' }, { status: 400 })
  }

  const motDePasseHash = await bcrypt.hash(parsed.data.password, 12)
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { motDePasseHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  ])

  return NextResponse.json({ ok: true })
}
