import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GalerieManager } from '@/components/admin/galerie-manager'

export const metadata: Metadata = {
  title: 'Galerie du salon',
}

export const dynamic = 'force-dynamic'

export default async function AdminGaleriePage() {
  const session = await auth()
  if (session?.user.role !== 'ADMIN') redirect('/admin/planning')

  const photos = await prisma.photoSalon.findMany({
    orderBy: [{ ordre: 'asc' }, { dateCreation: 'asc' }],
    select: { id: true, url: true, legende: true },
  })

  return (
    <div>
      <div className="border-b border-border/60 px-5 py-5 sm:px-8">
        <h1 className="text-lg font-light uppercase tracking-[0.14em]">Galerie du salon</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Ces photos sont visibles par les visiteurs sur la page d&apos;accueil du site.
        </p>
      </div>
      <div className="p-5 sm:p-8">
        <GalerieManager initial={photos} />
      </div>
    </div>
  )
}
