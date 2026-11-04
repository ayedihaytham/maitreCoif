import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { maintenantSalon } from '@/lib/slots'
import { FermeturesManager } from '@/components/admin/fermetures-manager'

export const metadata: Metadata = {
  title: 'Fermetures',
}

export const dynamic = 'force-dynamic'

export default async function AdminFermeturesPage() {
  const session = await auth()
  if (session?.user.role !== 'ADMIN') redirect('/planning')

  const aujourdhui = new Date(`${maintenantSalon().dateISO}T00:00:00Z`)
  const [fermetures, coiffeurs] = await Promise.all([
    prisma.fermeture.findMany({
      where: { dateFin: { gte: aujourdhui } },
      orderBy: { dateDebut: 'asc' },
      include: { coiffeur: { select: { prenom: true, nom: true } } },
    }),
    prisma.user.findMany({
      where: { role: { in: ['COIFFEUR', 'ADMIN'] }, actif: true },
      orderBy: { dateCreation: 'asc' },
      select: { id: true, prenom: true, nom: true },
    }),
  ])

  return (
    <div>
      <div className="border-b border-border/60 px-5 py-5 sm:px-8">
        <h1 className="text-lg font-light uppercase tracking-[0.14em]">Fermetures et congés</h1>
      </div>
      <div className="p-5 sm:p-8">
        <FermeturesManager
          initial={fermetures.map((f) => ({
            ...f,
            dateDebut: f.dateDebut.toISOString(),
            dateFin: f.dateFin.toISOString(),
            dateCreation: undefined,
          }))}
          coiffeurs={coiffeurs}
        />
      </div>
    </div>
  )
}
