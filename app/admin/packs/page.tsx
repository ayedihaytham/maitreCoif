import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AdminPageHead } from '@/components/admin/page-head'
import { PacksManager } from '@/components/admin/packs-manager'
import { auth } from '@/lib/auth'
import { listerPacksAdmin } from '@/lib/boutique-admin'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'Packs',
}

export const dynamic = 'force-dynamic'

export default async function AdminPacksPage() {
  const session = await auth()
  if (session?.user.role !== 'ADMIN') redirect('/planning')

  const [packs, services] = await Promise.all([
    listerPacksAdmin(),
    prisma.service.findMany({ orderBy: { nom: 'asc' } }),
  ])

  return (
    <div>
      <AdminPageHead
        section="Gestion"
        titre={
          <>
            Les <em>packs.</em>
          </>
        }
        description="Un pack regroupe plusieurs prestations à un prix avantageux. Le client le réserve comme une prestation : il voit le prix normal barré, le prix du pack et son économie."
      />
      <div className="ad-body">
        <PacksManager
          initial={packs}
          services={services.map((s) => ({ id: s.id, nom: s.nom, prix: Number(s.prix), duree: s.duree, actif: s.actif }))}
        />
      </div>
    </div>
  )
}
