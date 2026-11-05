import type { Metadata } from 'next'

import { ReservationWizard } from '@/components/reservation/wizard'
import { attribuerPortraits } from '@/lib/portraits'
import { prisma } from '@/lib/prisma'
import { maintenantSalon } from '@/lib/slots'

export const metadata: Metadata = {
  title: 'Réservation',
  description: 'Réservez votre rendez-vous en ligne chez Maitre Coif.',
}

export const dynamic = 'force-dynamic'

export default async function ReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ coiffeurId?: string; serviceId?: string }>
}) {
  const { coiffeurId, serviceId } = await searchParams

  const [coiffeurs, services] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ['COIFFEUR', 'ADMIN'] }, actif: true },
      orderBy: { dateCreation: 'asc' },
      select: { id: true, nom: true, prenom: true, photo: true, specialites: true, role: true },
    }),
    prisma.service.findMany({ where: { actif: true }, orderBy: { prix: 'asc' } }),
  ])

  const coiffeursForClient = attribuerPortraits(coiffeurs).map(({ photo: _photo, role, ...c }) => ({
    ...c,
    role: role === 'ADMIN' ? 'Gérant · Fondateur' : 'Coiffeur',
  }))
  const servicesForClient = services.map((s) => ({ ...s, prix: Number(s.prix) }))

  return (
    <main>
      <div className="wrap page-head sec">
        <div className="lbl">Prendre rendez-vous</div>
        <h1 className="page-h1">
          Réservez <em>votre séance.</em>
        </h1>
        <p className="lead">
          Choisissez votre coiffeur, votre prestation, puis le créneau qui vous convient. Aucun compte n&apos;est requis :
          la confirmation est immédiate.
        </p>

        <ReservationWizard
          coiffeurs={coiffeursForClient}
          services={servicesForClient}
          preselectedCoiffeurId={coiffeurId}
          preselectedServiceId={serviceId}
          todayISO={maintenantSalon().dateISO}
        />
      </div>
    </main>
  )
}
