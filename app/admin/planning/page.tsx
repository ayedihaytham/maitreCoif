import type { Metadata } from 'next'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AdminPageHead } from '@/components/admin/page-head'
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
      <AdminPageHead
        section="Planning"
        titre={
          <>
            Le <em>planning.</em>
          </>
        }
        description="Les rendez-vous du jour, coiffeur par coiffeur. La ligne rouge indique l'heure actuelle au salon."
      />
      <div className="ad-body">
        <PlanningBoard role={session.user.role} currentUserId={session.user.id} coiffeurs={coiffeurs} />
      </div>
    </div>
  )
}
