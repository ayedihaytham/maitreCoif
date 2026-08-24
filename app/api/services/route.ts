import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serviceSchema } from '@/lib/validators'

export async function GET() {
  const session = await auth()
  const services = await prisma.service.findMany({
    where: session?.user.role === 'ADMIN' ? {} : { actif: true },
    orderBy: { nom: 'asc' },
  })
  return NextResponse.json(services)
}

export async function POST(request: Request) {
  const session = await auth()
  if (session?.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = serviceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const service = await prisma.service.create({ data: parsed.data })
  return NextResponse.json(service, { status: 201 })
}
