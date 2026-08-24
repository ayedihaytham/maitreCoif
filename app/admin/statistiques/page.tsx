import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { getStatistiques, type Periode } from '@/lib/statistiques'
import { cn, formatPrix } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Statistiques',
}

export const dynamic = 'force-dynamic'

const PERIODES: { value: Periode; label: string }[] = [
  { value: 'semaine', label: '7 derniers jours' },
  { value: 'mois', label: 'Ce mois-ci' },
  { value: 'annee', label: 'Cette année' },
]

const STATUT_LABEL: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  CONFIRME: 'Confirmés',
  TERMINE: 'Terminés',
  ANNULE: 'Annulés',
}

export default async function AdminStatistiquesPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>
}) {
  const session = await auth()
  if (session?.user.role !== 'ADMIN') redirect('/admin/planning')

  const { periode: periodeParam } = await searchParams
  const periode: Periode = periodeParam === 'semaine' || periodeParam === 'annee' ? periodeParam : 'mois'

  const stats = await getStatistiques(periode)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 px-5 py-5 sm:px-8">
        <h1 className="text-lg font-light uppercase tracking-[0.14em]">Statistiques</h1>
        <div className="flex gap-2">
          {PERIODES.map((p) => (
            <Link
              key={p.value}
              href={`/admin/statistiques?periode=${p.value}`}
              className={cn(
                'border px-3 py-1.5 text-[10px] uppercase tracking-[0.14em]',
                periode === p.value ? 'border-gold bg-gold text-background' : 'border-border/70 text-muted-foreground',
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="p-5 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Chiffre d'affaires" value={formatPrix(stats.chiffreAffairesTotal)} />
          <StatCard label="Rendez-vous" value={String(stats.nombreRendezVous)} />
          <StatCard label="Taux de remplissage" value={`${Math.round(stats.tauxRemplissageGlobal * 100)} %`} />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          {Object.entries(STATUT_LABEL).map(([key, label]) => (
            <StatCard key={key} label={label} value={String(stats.parStatut[key] ?? 0)} small />
          ))}
        </div>

        <div className="mt-10">
          <h2 className="mb-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Par coiffeur</h2>
          <div className="overflow-x-auto border border-border/70">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/70 bg-anthracite text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Coiffeur</th>
                  <th className="px-4 py-3">Rendez-vous</th>
                  <th className="px-4 py-3">Chiffre d&apos;affaires</th>
                  <th className="px-4 py-3">Taux de remplissage</th>
                </tr>
              </thead>
              <tbody>
                {stats.parCoiffeur.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3">{c.nom}</td>
                    <td className="px-4 py-3">{c.rendezVous}</td>
                    <td className="px-4 py-3">{formatPrix(c.chiffreAffaires)}</td>
                    <td className="px-4 py-3">{Math.round(c.tauxRemplissage * 100)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="border border-border/70 bg-anthracite p-5">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={cn('mt-2 font-display text-gold', small ? 'text-xl' : 'text-3xl')}>{value}</p>
    </div>
  )
}
