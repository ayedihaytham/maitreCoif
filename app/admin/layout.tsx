import '../cinema-admin.css'
import '../cinema-fixes.css'

import type { Metadata } from 'next'

import { auth } from '@/lib/auth'
import { AdminSidebarClerk } from '@/components/admin/sidebar'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  // Le contrôle d'accès effectif est fait par le middleware ; ce garde
  // défensif évite un crash si la page est rendue sans session.
  if (!session?.user) return null

  return (
    <div className="ad">
      <AdminSidebarClerk role={session.user.role} nom={session.user.name ?? ''} />
      <div className="ad-main">{children}</div>
    </div>
  )
}
