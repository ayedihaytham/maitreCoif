import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { photoSalonSchema } from '@/lib/validators'

async function requireAdmin() {
  const session = await auth()
  return session?.user.role === 'ADMIN'
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const photos = await prisma.photoSalon.findMany({ orderBy: [{ ordre: 'asc' }, { dateCreation: 'asc' }] })
  return NextResponse.json(photos)
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await request.json()
  const parsed = photoSalonSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const count = await prisma.photoSalon.count()
  const photo = await prisma.photoSalon.create({
    data: { url: parsed.data.url, legende: parsed.data.legende || null, ordre: count },
  })

  return NextResponse.json(photo, { status: 201 })
}
