import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { avisSchema } from '@/lib/validators'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json()
  const parsed = avisSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const rendezVous = await prisma.rendezVous.findUnique({
    where: { id: parsed.data.rendezVousId },
    include: { avis: true },
  })

  if (!rendezVous || rendezVous.clientUserId !== session.user.id) {
    return NextResponse.json({ error: 'Rendez-vous introuvable' }, { status: 404 })
  }
  if (rendezVous.statut !== 'TERMINE') {
    return NextResponse.json({ error: 'Un avis ne peut être laissé qu\'après un rendez-vous terminé.' }, { status: 400 })
  }
  if (rendezVous.avis) {
    return NextResponse.json({ error: 'Un avis a déjà été laissé pour ce rendez-vous.' }, { status: 409 })
  }

  const avis = await prisma.avis.create({
    data: {
      rendezVousId: rendezVous.id,
      note: parsed.data.note,
      commentaire: parsed.data.commentaire || null,
    },
  })

  return NextResponse.json(avis, { status: 201 })
}
