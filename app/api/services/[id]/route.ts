import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serviceSchema } from '@/lib/validators'

async function requireAdmin() {
  const session = await auth()
  return session?.user.role === 'ADMIN'
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const parsed = serviceSchema.partial().safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const service = await prisma.service.update({ where: { id }, data: parsed.data })
  return NextResponse.json(service)
}

/** Suppression définitive. Impossible si le service figure dans des rendez-vous : on le désactive alors. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id } = await params
  const existe = await prisma.service.findUnique({ where: { id }, select: { id: true } })
  if (!existe) return NextResponse.json({ error: 'Service introuvable' }, { status: 404 })

  const [direct, lignes] = await Promise.all([prisma.rendezVous.count({ where: { serviceId: id } }), prisma.rendezVousService.count({ where: { serviceId: id } })])
  const utilisations = Math.max(direct, lignes)
  if (utilisations > 0) {
    return NextResponse.json(
      { error: `Suppression impossible : ce service figure dans ${utilisations} rendez-vous (historique). Désactivez-le plutôt, vous pourrez le réactiver.` },
      { status: 409 },
    )
  }

  await prisma.service.delete({ where: { id } })
  return NextResponse.json({ supprime: true })
}
