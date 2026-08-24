import { NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { disponibiliteSchema } from '@/lib/validators'

async function requireAdmin() {
  const session = await auth()
  return session?.user.role === 'ADMIN'
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id } = await params
  const disponibilites = await prisma.disponibilite.findMany({
    where: { coiffeurId: id },
    orderBy: { jourSemaine: 'asc' },
  })
  return NextResponse.json(disponibilites)
}

const replaceSchema = z.object({ disponibilites: z.array(disponibiliteSchema) })

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const parsed = replaceSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  await prisma.$transaction([
    prisma.disponibilite.deleteMany({ where: { coiffeurId: id } }),
    prisma.disponibilite.createMany({
      data: parsed.data.disponibilites.map((d) => ({ ...d, coiffeurId: id })),
    }),
  ])

  const disponibilites = await prisma.disponibilite.findMany({ where: { coiffeurId: id }, orderBy: { jourSemaine: 'asc' } })
  return NextResponse.json(disponibilites)
}
