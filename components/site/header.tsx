import { auth } from '@/lib/auth'
import { Logo } from '@/components/site/logo'
import { HeaderActions } from '@/components/site/header-actions'

export async function Header() {
  const session = await auth()

  return (
    <header className="relative border-b border-border/60 bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8 lg:px-12">
        <Logo />
        <HeaderActions user={session?.user ?? null} />
      </div>
    </header>
  )
}
