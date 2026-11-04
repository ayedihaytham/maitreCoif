import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { maintenantSalon } from '@/lib/slots'
import { fermetureSchema } from '@/lib/validators'

async function requireAdmin() {
  const session = await auth()
  return session?.user.role === 'ADMIN'
}

// Fermetures en cours ou à venir (les passées n'ont plus d'intérêt).
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const aujourdhui = new Date(`${maintenantSalon().dateISO}T00:00:00Z`)
  const fermetures = await prisma.fermeture.findMany({
    where: { dateFin: { gte: aujourdhui } },
    orderBy: { dateDebut: 'asc' },
    include: { coiffeur: { select: { prenom: true, nom: true } } },
  })
  return NextResponse.json(fermetures)
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const parsed = fermetureSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { coiffeurId, dateDebut, dateFin, motif } = parsed.data

  if (coiffeurId) {
    const coiffeur = await prisma.user.findFirst({ where: { id: coiffeurId, role: { in: ['COIFFEUR', 'ADMIN'] } } })
    if (!coiffeur) return NextResponse.json({ error: 'Coiffeur introuvable' }, { status: 404 })
  }

  const debut = new Date(`${dateDebut}T00:00:00Z`)
  const fin = new Date(`${dateFin}T00:00:00Z`)

  const fermeture = await prisma.fermeture.create({
    data: { coiffeurId: coiffeurId ?? null, dateDebut: debut, dateFin: fin, motif: motif || null },
    include: { coiffeur: { select: { prenom: true, nom: true } } },
  })

  // La fermeture n'annule rien automatiquement : on signale au gérant les
  // rendez-vous déjà pris sur la période pour qu'il les déplace ou les annule.
  const rdvImpactes = await prisma.rendezVous.count({
    where: {
      date: { gte: debut, lte: fin },
      statut: { in: ['EN_ATTENTE', 'CONFIRME'] },
      ...(coiffeurId ? { coiffeurId } : {}),
    },
  })

  return NextResponse.json({ ...fermeture, rdvImpactes }, { status: 201 })
}
