import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { coiffeurSchema } from '@/lib/validators'

async function requireAdmin() {
  const session = await auth()
  return session?.user.role === 'ADMIN'
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const parsed = coiffeurSchema.partial().safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { password, ...rest } = parsed.data

  const coiffeur = await prisma.user.update({
    where: { id },
    data: {
      ...rest,
      telephone: rest.telephone === '' ? null : rest.telephone,
      bio: rest.bio === '' ? null : rest.bio,
      ...(rest.photo !== undefined ? { photo: rest.photo === '' ? null : rest.photo } : {}),
      ...(password ? { motDePasseHash: await bcrypt.hash(password, 12) } : {}),
    },
  })

  return NextResponse.json(coiffeur)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id } = await params
  const coiffeur = await prisma.user.update({ where: { id }, data: { actif: false } })
  return NextResponse.json(coiffeur)
}
