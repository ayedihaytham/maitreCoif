import { auth } from '@/lib/auth'
import { AdminSidebar } from '@/components/admin/sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  // Le contrôle d'accès effectif est fait par le middleware ; ce garde
  // défensif évite un crash si la page est rendue sans session.
  if (!session?.user) return null

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground sm:flex-row">
      <AdminSidebar role={session.user.role} nom={session.user.name ?? ''} />
      <div className="flex-1 overflow-x-hidden">{children}</div>
    </div>
  )
}
