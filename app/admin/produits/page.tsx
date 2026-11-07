import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AdminPageHead } from '@/components/admin/page-head'
import { ProduitsManager } from '@/components/admin/produits-manager'
import { auth } from '@/lib/auth'
import { listerProduitsAdmin } from '@/lib/boutique-admin'

export const metadata: Metadata = {
  title: 'Produits',
}

export const dynamic = 'force-dynamic'

export default async function AdminProduitsPage() {
  const session = await auth()
  if (session?.user.role !== 'ADMIN') redirect('/planning')

  return (
    <div>
      <AdminPageHead
        section="Boutique"
        titre={
          <>
            Les <em>produits.</em>
          </>
        }
        description="Les produits que vous créez ici sont réservables en ligne : le client réserve, retire et règle au salon. Le stock baisse à chaque réservation et remonte si elle est annulée ou expire."
      />
      <div className="ad-body">
        <ProduitsManager initial={await listerProduitsAdmin()} />
      </div>
    </div>
  )
}
