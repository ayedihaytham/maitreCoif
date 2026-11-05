import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { StatistiquesView } from '@/components/admin/statistiques-view'
import { auth } from '@/lib/auth'
import { getStatistiques, type Periode } from '@/lib/statistiques'

export const metadata: Metadata = {
  title: 'Statistiques',
}

export const dynamic = 'force-dynamic'

export default async function AdminStatistiquesPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>
}) {
  const session = await auth()
  if (session?.user.role !== 'ADMIN') redirect('/planning')

  const { periode: periodeParam } = await searchParams
  const periode: Periode = periodeParam === 'semaine' || periodeParam === 'annee' ? periodeParam : 'mois'

  const stats = await getStatistiques(periode)

  return <StatistiquesView stats={stats} periode={periode} />
}
