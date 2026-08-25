import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, clientIpFrom } from '@/lib/rate-limit'
import { changeEmailSchema } from '@/lib/validators'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const ip = clientIpFrom(request.headers)
  if (!checkRateLimit(`account-email:${session.user.id}:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'Trop de tentatives, veuillez réessayer plus tard.' }, { status: 429 })
  }

  const body = await request.json()
  const parsed = changeEmailSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 })

  const valid = await bcrypt.compare(parsed.data.password, user.motDePasseHash)
  if (!valid) return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 400 })

  if (parsed.data.email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    if (existing) return NextResponse.json({ error: 'Cet email est déjà utilisé par un autre compte.' }, { status: 409 })
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data: { email: parsed.data.email } })

  return NextResponse.json({ email: updated.email })
}
