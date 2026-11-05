'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { ArrowUpRight, BarChart3, CalendarOff, CalendarRange, Images, LogOut, Scissors, Users } from 'lucide-react'

import { ThemeLogo } from '@/components/theme-logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { siteUrl } from '@/lib/salon-host'
import { cn } from '@/lib/utils'
import type { Role } from '@prisma/client'

const LINKS = [
  { href: '/planning', label: 'Planning', icon: CalendarRange, adminOnly: false },
  { href: '/equipe', label: 'Équipe', icon: Users, adminOnly: true },
  { href: '/fermetures', label: 'Fermetures', icon: CalendarOff, adminOnly: true },
  { href: '/services', label: 'Services', icon: Scissors, adminOnly: true },
  { href: '/galerie', label: 'Galerie', icon: Images, adminOnly: true },
  { href: '/statistiques', label: 'Statistiques', icon: BarChart3, adminOnly: true },
]

/** Horloge du salon (fuseau de Tunis), comme le timecode d'un plateau. */
function HorlogeSalon() {
  const [maintenant, setMaintenant] = useState<Date | null>(null)

  // Rendu initial neutre : l'heure n'existe que côté navigateur (pas de décalage d'hydratation).
  useEffect(() => {
    setMaintenant(new Date())
    const t = window.setInterval(() => setMaintenant(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const fuseau = 'Africa/Tunis'
  const heure = maintenant
    ? maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: fuseau })
    : '--:--:--'
  const jour = maintenant
    ? maintenant.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: fuseau })
    : ' '

  return (
    <div className="ad-clock" aria-label="Heure du salon">
      <span className="lbl dim">Heure du salon</span>
      <span className="tc" suppressHydrationWarning>
        {heure}
      </span>
      <span className="dt" suppressHydrationWarning>
        {jour}
      </span>
    </div>
  )
}

interface Props {
  role: Role
  nom: string
  /** Fournie par le conteneur connecté à Clerk ; absente = bouton de déconnexion masqué. */
  onSignOut?: () => void
}

// Présentation seule (aucune dépendance à Clerk) : testable et prévisualisable sans compte.
export function AdminSidebar({ role, nom, onSignOut }: Props) {
  const pathname = usePathname()
  const isAdmin = role === 'ADMIN'

  return (
    <aside className="ad-side" aria-label="Navigation du back-office">
      <Link className="ad-brand" href="/planning" aria-label="Maitre Coif, planning">
        <ThemeLogo priority />
      </Link>
      <div className="ad-rec">Espace salon</div>

      <div className="ad-user">
        <div className="nm">{nom || 'Équipe'}</div>
        <span className="rl">{isAdmin ? 'Gérant' : 'Coiffeur'}</span>
      </div>

      <nav className="ad-nav" aria-label="Sections">
        {LINKS.filter((l) => !l.adminOnly || isAdmin).map((link) => {
          const Icon = link.icon
          const actif = pathname.startsWith(link.href)
          return (
            <Link key={link.href} href={link.href} className={cn(actif && 'on')} aria-current={actif ? 'page' : undefined}>
              <Icon aria-hidden="true" />
              <span>{link.label}</span>
            </Link>
          )
        })}
      </nav>

      <HorlogeSalon />

      <div className="ad-foot">
        <a href={siteUrl('/')}>
          <ArrowUpRight aria-hidden="true" />
          <span>Retour au site</span>
        </a>
        <ThemeToggle className="ad-theme" />
        {onSignOut && (
          <button type="button" onClick={onSignOut}>
            <LogOut aria-hidden="true" />
            <span>Déconnexion</span>
          </button>
        )}
      </div>
    </aside>
  )
}

/** Version connectée : la déconnexion passe par Clerk. */
export function AdminSidebarClerk(props: Omit<Props, 'onSignOut'>) {
  const { signOut } = useClerk()
  return <AdminSidebar {...props} onSignOut={() => signOut({ redirectUrl: siteUrl('/') })} />
}
