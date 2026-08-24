import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EquipeManager } from '@/components/admin/equipe-manager'

export const metadata: Metadata = {
  title: 'Équipe',
}

export const dynamic = 'force-dynamic'

export default async function AdminEquipePage() {
  const session = await auth()
  if (session?.user.role !== 'ADMIN') redirect('/admin/planning')

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
      <div className="border-b border-border/60 px-5 py-5 sm:px-8">
        <h1 className="text-lg font-light uppercase tracking-[0.14em]">Équipe</h1>
      </div>
      <div className="p-5 sm:p-8">
        <EquipeManager initial={equipe} />
      </div>
    </div>
  )
}
