import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { checkRateLimit, clientIpFrom } from '@/lib/rate-limit'
import { registerSchema } from '@/lib/validators-auth'

export async function POST(request: Request) {
  const ip = clientIpFrom(request.headers)
  if (!checkRateLimit(`register:${ip}`, 6, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'Trop de tentatives, veuillez réessayer plus tard.' }, { status: 429 })
  }

  const body = await request.json()
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    return NextResponse.json({ error: 'Un compte existe déjà avec cet email.' }, { status: 409 })
  }

  const motDePasseHash = await bcrypt.hash(parsed.data.password, 12)
  await prisma.user.create({
    data: {
      nom: parsed.data.nom,
      prenom: parsed.data.prenom,
      email: parsed.data.email,
      telephone: parsed.data.telephone || null,
      motDePasseHash,
      role: 'CLIENT',
    },
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
