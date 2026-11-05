import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { AdminPageHead } from '@/components/admin/page-head'
import { prisma } from '@/lib/prisma'
import { ServicesManager } from '@/components/admin/services-manager'

export const metadata: Metadata = {
  title: 'Services',
}

export const dynamic = 'force-dynamic'

export default async function AdminServicesPage() {
  const session = await auth()
  if (session?.user.role !== 'ADMIN') redirect('/planning')

  const services = await prisma.service.findMany({ orderBy: { nom: 'asc' } })
  const servicesForClient = services.map((s) => ({ ...s, prix: Number(s.prix) }))

  return (
    <div>
      <AdminPageHead
        section="Services"
        titre={
          <>
            Les <em>prestations.</em>
          </>
        }
        description="Nom, prix et durée : la durée détermine les créneaux proposés en ligne. Un service désactivé n'est plus réservable. Les clients peuvent cumuler plusieurs services (durées et prix s'additionnent) ; pour proposer un forfait à tarif réduit (ex. « Coupe + Barbe »), créez-le ici comme un service à part entière."
      />
      <div className="ad-body">
        <ServicesManager initial={servicesForClient} />
      </div>
    </div>
  )
}
