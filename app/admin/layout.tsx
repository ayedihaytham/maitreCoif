import '../cinema-admin.css'
import '../cinema-fixes.css'

import type { Metadata } from 'next'

import { auth } from '@/lib/auth'
import { AdminSidebarClerk } from '@/components/admin/sidebar'
import { ClerkSalonProvider } from '@/components/auth/clerk-salon-provider'
import { resumeSalon } from '@/lib/prochain-rdv'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  // Le contrôle d'accès effectif est fait par le middleware ; ce garde
  // défensif évite un crash si la page est rendue sans session.
  if (!session?.user) return null

  const { prochain, aujourdhui } = await resumeSalon({ id: session.user.id, role: session.user.role })

  return (
    <ClerkSalonProvider>
    <div className="ad">
      <AdminSidebarClerk role={session.user.role} nom={session.user.name ?? ''} prochain={prochain} aujourdhui={aujourdhui} />
      <div className="ad-main">{children}</div>
    </div>
    </ClerkSalonProvider>
  )
}
