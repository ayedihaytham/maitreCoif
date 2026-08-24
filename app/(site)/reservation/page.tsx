import type { Metadata } from 'next'

import { prisma } from '@/lib/prisma'
import { ReservationWizard } from '@/components/reservation/wizard'

export const metadata: Metadata = {
  title: 'Réservation',
  description: 'Réservez votre rendez-vous en ligne chez Maitre Coif.',
}

export const dynamic = 'force-dynamic'

export default async function ReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ coiffeurId?: string }>
}) {
  const { coiffeurId } = await searchParams

  const [coiffeurs, services] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ['COIFFEUR', 'ADMIN'] }, actif: true },
      orderBy: { dateCreation: 'asc' },
      select: { id: true, nom: true, prenom: true, photo: true, specialites: true },
    }),
    prisma.service.findMany({ where: { actif: true }, orderBy: { prix: 'asc' } }),
  ])

  const servicesForClient = services.map((s) => ({ ...s, prix: Number(s.prix) }))

  return (
    <main className="px-5 pb-24 pt-16 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-4xl">
        <div className="eyebrow before:h-px before:w-8 before:bg-gold">Réservation</div>
        <h1 className="mt-6 text-3xl font-light uppercase tracking-[0.1em] sm:text-4xl">
          Prendre <span className="text-gold">rendez-vous</span>
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
          Choisissez votre coiffeur, votre prestation, puis le créneau qui vous convient. Aucun compte n&apos;est
          requis.
        </p>

        <div className="mt-12">
          <ReservationWizard coiffeurs={coiffeurs} services={servicesForClient} preselectedCoiffeurId={coiffeurId} />
        </div>
      </div>
    </main>
  )
}
