import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { AdminPageHead } from '@/components/admin/page-head'
import { prisma } from '@/lib/prisma'
import { GalerieManager } from '@/components/admin/galerie-manager'

export const metadata: Metadata = {
  title: 'Galerie du salon',
}

export const dynamic = 'force-dynamic'

export default async function AdminGaleriePage() {
  const session = await auth()
  if (session?.user.role !== 'ADMIN') redirect('/planning')

  const photos = await prisma.photoSalon.findMany({
    orderBy: [{ ordre: 'asc' }, { dateCreation: 'asc' }],
    select: { id: true, url: true, legende: true },
  })

  return (
    <div>
      <AdminPageHead
        section="Galerie"
        titre={
          <>
            Les <em>plans du salon.</em>
          </>
        }
        description="Ces photos sont visibles par les visiteurs sur la page d'accueil du site (scène « L'univers »)."
      />
      <div className="ad-body">
        <GalerieManager initial={photos} />
      </div>
    </div>
  )
}
