import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apercuSuppression, messageRendezVousLies, prevenirClientsAnnulation, rendezVousDuService } from '@/lib/suppression'
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

/**
 * Suppression définitive. Si le service figure dans des rendez-vous, elle est refusée (409) avec le détail de ce
 * qui serait effacé ; avec `?cascade=1` ces rendez-vous sont supprimés aussi (en entier, même s'ils contiennent
 * d'autres prestations) et les clients à venir sont prévenus par email.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id } = await params
  const service = await prisma.service.findUnique({ where: { id }, select: { id: true, nom: true } })
  if (!service) return NextResponse.json({ error: 'Service introuvable' }, { status: 404 })

  const cascade = new URL(request.url).searchParams.get('cascade') === '1'
  const where = rendezVousDuService(id)
  const apercu = await apercuSuppression(where)
  if (apercu.total > 0 && !cascade) {
    return NextResponse.json({ error: messageRendezVousLies(`« ${service.nom} »`, apercu), rendezVous: apercu }, { status: 409 })
  }

  const clientsPrevenus = apercu.total > 0 ? await prevenirClientsAnnulation(where) : 0
  await prisma.$transaction([prisma.rendezVous.deleteMany({ where }), prisma.service.delete({ where: { id } })])
  return NextResponse.json({ supprime: true, rendezVousSupprimes: apercu.total, clientsPrevenus })
}
