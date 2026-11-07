'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { Activity, ArrowUpRight, BarChart3, CalendarOff, CalendarRange, Gift, Images, LogOut, Package, Scissors, ShoppingBag, Users } from 'lucide-react'

import { ThemeLogo } from '@/components/theme-logo'
import { ThemeToggle } from '@/components/theme-toggle'
import type { ProchainRdv } from '@/lib/prochain-rdv'
import { siteUrl } from '@/lib/salon-host'
import { cn } from '@/lib/utils'
import type { Role } from '@prisma/client'

const SECTIONS = [
  { titre: 'Au quotidien', liens: [{ href: '/planning', label: 'Planning', icon: CalendarRange, adminOnly: false }] },
  {
    titre: 'Gestion',
    liens: [
      { href: '/equipe', label: 'Équipe', icon: Users, adminOnly: true },
      { href: '/services', label: 'Services', icon: Scissors, adminOnly: true },
      { href: '/galerie', label: 'Galerie', icon: Images, adminOnly: true },
      { href: '/fermetures', label: 'Fermetures', icon: CalendarOff, adminOnly: true },
    ],
  },
  {
    titre: 'Boutique',
    liens: [
      { href: '/produits', label: 'Produits', icon: Package, adminOnly: true },
      { href: '/packs', label: 'Packs', icon: Gift, adminOnly: true },
      { href: '/commandes', label: 'Réservations produits', icon: ShoppingBag, adminOnly: false },
    ],
  },
  {
    titre: 'Analyse',
    liens: [
      { href: '/statistiques', label: 'Statistiques', icon: BarChart3, adminOnly: true },
      { href: '/analytique', label: 'Analytique', icon: Activity, adminOnly: true },
    ],
  },
]

const FUSEAU = 'Africa/Tunis'

/** Bloc « En direct » : heure du salon et prochain rendez-vous. */
function EnDirect({ prochain }: { prochain: ProchainRdv | null }) {
  const [maintenant, setMaintenant] = useState<Date | null>(null)
  const router = useRouter()

  // Rendu initial neutre : l'heure n'existe que côté navigateur (pas de décalage d'hydratation).
  useEffect(() => {
    setMaintenant(new Date())
    const horloge = window.setInterval(() => setMaintenant(new Date()), 15_000)
    // Le prochain rendez-vous vient du serveur : on le rafraîchit toutes les 2 minutes.
    const donnees = window.setInterval(() => router.refresh(), 120_000)
    return () => {
      window.clearInterval(horloge)
      window.clearInterval(donnees)
    }
  }, [router])

  const heure = maintenant ? maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: FUSEAU }) : '--:--'
  const jour = maintenant ? maintenant.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: FUSEAU }) : ' '

  return (
    <div className="ad-today" role="group" aria-label="Heure du salon et prochain rendez-vous">
      <div className="k">
        <span>
          <i aria-hidden="true" />
          En direct
        </span>
        <span suppressHydrationWarning>{jour}</span>
      </div>
      <div className="clock" suppressHydrationWarning>
        {heure}
      </div>
      <div className="nx">
        <small>Prochain rendez-vous</small>
        {prochain ? (
          <>
            <b>
              {prochain.jour === "aujourd'hui" ? '' : `${prochain.jour} · `}
              {prochain.heure} · {prochain.client}
            </b>
            <span>
              {prochain.prestations}
              {prochain.coiffeur ? ` · ${prochain.coiffeur}` : ''}
            </span>
          </>
        ) : (
          <span>Aucun rendez-vous à venir.</span>
        )}
      </div>
    </div>
  )
}

interface Props {
  role: Role
  nom: string
  prochain?: ProchainRdv | null
  /** Nombre de rendez-vous du jour (pastille sur « Planning »). */
  aujourdhui?: number
  /** Réservations de produits à préparer (pastille sur « Réservations produits »). */
  aPreparer?: number
  /** Fournie par le conteneur connecté à Clerk ; absente = bouton de déconnexion masqué. */
  onSignOut?: () => void
}

const initiales = (nom: string) =>
  nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase())
    .join('') || 'É'

// Présentation seule (aucune dépendance à Clerk) : testable et prévisualisable sans compte.
export function AdminSidebar({ role, nom, prochain = null, aujourdhui = 0, aPreparer = 0, onSignOut }: Props) {
  const pathname = usePathname()
  const isAdmin = role === 'ADMIN'

  return (
    <aside className="ad-side" aria-label="Navigation du back-office">
      <Link className="ad-brand" href="/planning" aria-label="Maitre Coif, planning">
        <ThemeLogo priority />
        <span className="bt">
          <b>Maitre Coif</b>
          <small>Espace salon</small>
        </span>
      </Link>

      <EnDirect prochain={prochain} />

      <nav className="ad-nav" aria-label="Sections">
        {SECTIONS.map((section) => {
          const liens = section.liens.filter((l) => !l.adminOnly || isAdmin)
          if (liens.length === 0) return null
          return (
            <div key={section.titre} className="grp">
              <div className="sec">{section.titre}</div>
              {liens.map((link) => {
                const Icon = link.icon
                const actif = pathname.startsWith(link.href)
                return (
                  <Link key={link.href} href={link.href} className={cn(actif && 'on')} aria-current={actif ? 'page' : undefined} title={link.label}>
                    <Icon aria-hidden="true" />
                    <span className="t">{link.label}</span>
                    {link.href === '/planning' && aujourdhui > 0 && (
                      <span className="n">
                        <span aria-hidden="true">{aujourdhui}</span>
                        <span className="sr-only">{aujourdhui} rendez-vous aujourd&apos;hui</span>
                      </span>
                    )}
                    {link.href === '/commandes' && aPreparer > 0 && (
                      <span className="n">
                        <span aria-hidden="true">{aPreparer}</span>
                        <span className="sr-only">{aPreparer} réservation{aPreparer > 1 ? 's' : ''} de produits à préparer</span>
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div className="ad-user">
        <span className="av" aria-hidden="true">
          {initiales(nom)}
        </span>
        <div className="who">
          <b>{nom || 'Équipe'}</b>
          <small>{isAdmin ? 'Gérant' : 'Coiffeur'}</small>
        </div>
      </div>

      <div className="ad-tools">
        <ThemeToggle libelle="Thème" />
        <a href={siteUrl('/')} title="Retour au site">
          <ArrowUpRight aria-hidden="true" />
          <span>Site</span>
        </a>
        {onSignOut && (
          <button type="button" onClick={onSignOut} title="Déconnexion">
            <LogOut aria-hidden="true" />
            <span>Sortir</span>
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
