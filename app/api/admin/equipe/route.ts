import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { coiffeurSchema } from '@/lib/validators'

async function requireAdmin() {
  const session = await auth()
  return session?.user.role === 'ADMIN'
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const equipe = await prisma.user.findMany({
    where: { role: { in: ['COIFFEUR', 'ADMIN'] } },
    orderBy: { dateCreation: 'asc' },
    select: {
      id: true,
      nom: true,
      prenom: true,
      email: true,
      telephone: true,
      role: true,
      photo: true,
      specialites: true,
      bio: true,
      actif: true,
    },
  })

  return NextResponse.json(equipe)
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await request.json()
  const parsed = coiffeurSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  if (!parsed.data.password) return NextResponse.json({ error: 'Mot de passe requis' }, { status: 400 })

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) return NextResponse.json({ error: 'Un compte existe déjà avec cet email.' }, { status: 409 })

  const motDePasseHash = await bcrypt.hash(parsed.data.password, 12)
  const coiffeur = await prisma.user.create({
    data: {
      nom: parsed.data.nom,
      prenom: parsed.data.prenom,
      email: parsed.data.email,
      telephone: parsed.data.telephone || null,
      bio: parsed.data.bio || null,
      specialites: parsed.data.specialites ?? [],
      role: parsed.data.role ?? 'COIFFEUR',
      photo: parsed.data.photo || null,
      motDePasseHash,
    },
  })

  return NextResponse.json(coiffeur, { status: 201 })
}
