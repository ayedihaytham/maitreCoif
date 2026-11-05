import { auth } from '@/lib/auth'
import { SiteNav } from '@/components/site/site-nav'

export async function Header() {
  const session = await auth()

  return <SiteNav user={session?.user ? { name: session.user.name, role: session.user.role } : null} />
}
