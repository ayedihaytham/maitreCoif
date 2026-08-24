import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ServicesManager } from '@/components/admin/services-manager'

export const metadata: Metadata = {
  title: 'Services',
}

export const dynamic = 'force-dynamic'

export default async function AdminServicesPage() {
  const session = await auth()
  if (session?.user.role !== 'ADMIN') redirect('/admin/planning')

  const services = await prisma.service.findMany({ orderBy: { nom: 'asc' } })
  const servicesForClient = services.map((s) => ({ ...s, prix: Number(s.prix) }))

  return (
    <div>
      <div className="border-b border-border/60 px-5 py-5 sm:px-8">
        <h1 className="text-lg font-light uppercase tracking-[0.14em]">Services</h1>
      </div>
      <div className="p-5 sm:p-8">
        <ServicesManager initial={servicesForClient} />
      </div>
    </div>
  )
}
