'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { BarChart3, CalendarRange, Images, LogOut, Scissors, Users } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { Role } from '@prisma/client'

const LINKS = [
  { href: '/admin/planning', label: 'Planning', icon: CalendarRange, adminOnly: false },
  { href: '/admin/equipe', label: 'Équipe', icon: Users, adminOnly: true },
  { href: '/admin/services', label: 'Services', icon: Scissors, adminOnly: true },
  { href: '/admin/galerie', label: 'Galerie', icon: Images, adminOnly: true },
  { href: '/admin/statistiques', label: 'Statistiques', icon: BarChart3, adminOnly: true },
]

export function AdminSidebar({ role, nom }: { role: Role; nom: string }) {
  const pathname = usePathname()
  const isAdmin = role === 'ADMIN'

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-border/60 bg-anthracite sm:w-56 sm:border-b-0 sm:border-r">
      <div className="border-b border-border/60 px-5 py-5">
        <p className="text-[10px] uppercase tracking-[0.3em] text-gold">Maitre Coif</p>
        <p className="mt-1 text-xs text-muted-foreground">{nom}</p>
      </div>
      <nav className="flex flex-1 flex-row gap-1 overflow-x-auto p-3 sm:flex-col sm:overflow-visible">
        {LINKS.filter((l) => !l.adminOnly || isAdmin).map((link) => {
          const Icon = link.icon
          const active = pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex shrink-0 items-center gap-2.5 rounded-sm px-3 py-2 text-xs uppercase tracking-[0.1em] transition-colors',
                active ? 'bg-gold text-background' : 'text-muted-foreground hover:bg-background hover:text-foreground',
              )}
            >
              <Icon className="size-4" /> {link.label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-border/60 p-3">
        <Link
          href="/"
          className="block px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          Retour au site
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/' })}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-3.5" /> Déconnexion
        </button>
      </div>
    </aside>
  )
}
