import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { AdminPageHead } from '@/components/admin/page-head'
import { prisma } from '@/lib/prisma'
import { EquipeManager } from '@/components/admin/equipe-manager'

export const metadata: Metadata = {
  title: 'Équipe',
}

export const dynamic = 'force-dynamic'

export default async function AdminEquipePage() {
  const session = await auth()
  if (session?.user.role !== 'ADMIN') redirect('/planning')

  const equipe = await prisma.user.findMany({
    where: { role: { in: ['COIFFEUR', 'ADMIN'] } },
    orderBy: { dateCreation: 'asc' },
    select: {
      id: true,
      nom: true,
      prenom: true,
      email: true,
      telephone: true,
      role: true,
      photo: true,
      specialites: true,
      bio: true,
      actif: true,
    },
  })

  return (
    <div>
      <AdminPageHead
        section="Équipe"
        titre={
          <>
            Le <em>casting.</em>
          </>
        }
        description="Ajoutez un membre : il reçoit automatiquement une invitation par email pour créer son accès au back-office."
      />
      <div className="ad-body">
        <EquipeManager initial={equipe} />
      </div>
    </div>
  )
}
