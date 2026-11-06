import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AnalytiqueNonConfigure, AnalytiqueView } from '@/components/admin/analytique-view'
import { getAnalytique, lirePeriode } from '@/lib/analytique'
import { auth } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Analytique',
}

export const dynamic = 'force-dynamic'

export default async function AdminAnalytiquePage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const session = await auth()
  if (session?.user.role !== 'ADMIN') redirect('/planning')

  const periode = lirePeriode((await searchParams).periode)
  const resultat = await getAnalytique(periode)
  if (resultat.etat === 'non_configure') return <AnalytiqueNonConfigure />

  return <AnalytiqueView donnees={resultat.donnees} periode={periode} erreurs={resultat.erreurs} />
}
