import type { Metadata } from 'next'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PlanningBoard } from '@/components/admin/planning-board'

export const metadata: Metadata = {
  title: 'Planning',
}

export const dynamic = 'force-dynamic'

export default async function AdminPlanningPage() {
  const session = await auth()
  if (!session?.user) return null

  const coiffeurs = await prisma.user.findMany({
    where: { role: { in: ['COIFFEUR', 'ADMIN'] }, actif: true },
    orderBy: { dateCreation: 'asc' },
    select: { id: true, nom: true, prenom: true },
  })

  return (
    <div>
      <div className="border-b border-border/60 px-5 py-5 sm:px-8">
        <h1 className="text-lg font-light uppercase tracking-[0.14em]">Planning</h1>
      </div>
      <PlanningBoard role={session.user.role} currentUserId={session.user.id} coiffeurs={coiffeurs} />
    </div>
  )
}
