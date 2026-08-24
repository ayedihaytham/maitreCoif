import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

export async function GET() {
  const coiffeurs = await prisma.user.findMany({
    where: { role: { in: ['COIFFEUR', 'ADMIN'] }, actif: true },
    orderBy: { dateCreation: 'asc' },
    select: { id: true, nom: true, prenom: true, photo: true, specialites: true, role: true },
  })

  return NextResponse.json(coiffeurs)
}
