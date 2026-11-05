'use client'

import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, LogOut, Menu, User, X } from 'lucide-react'

import { ThemeLogo } from '@/components/theme-logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { StaffSignOutButton } from '@/components/auth/staff-sign-out'
import { salonUrl } from '@/lib/salon-host'
import { cn } from '@/lib/utils'
import type { Role } from '@prisma/client'

const NAV_LINKS = [
  { href: '/', label: 'Accueil' },
  { href: '/services', label: 'Services' },
  { href: '/equipe', label: 'Notre équipe' },
  { href: '/suivi', label: 'Suivi de réservation' },
]

// Pages qui s'ouvrent sur un plan plein cadre : la barre y est transparente au départ.
const PLATEAUX = ['/', '/services', '/equipe', '/suivi']

type Utilisateur = { name?: string | null; role: Role } | null

async function deconnecterClient() {
  const { signOut } = await import('next-auth/react')
  signOut({ callbackUrl: '/' })
}

export function SiteNav() {
  const pathname = usePathname()
  const [user, setUser] = useState<Utilisateur>(null)

  // La session est demandée au navigateur (pas au rendu serveur) : les pages publiques
  // restent statiques. Relue quand l'onglet redevient visible (connexion dans un autre onglet).
  useEffect(() => {
    let annule = false
    const lire = () =>
      fetch('/api/session', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => !annule && setUser(d?.user ?? null))
        .catch(() => {})
    lire()
    const surVisible = () => document.visibilityState === 'visible' && lire()
    document.addEventListener('visibilitychange', surVisible)
    return () => {
      annule = true
      document.removeEventListener('visibilitychange', surVisible)
    }
  }, [])
  const plateau = PLATEAUX.includes(pathname)
  const [defile, setDefile] = useState(false)
  const [ouvert, setOuvert] = useState(false)
  const entete = useRef<HTMLElement>(null)

  // Transparent sur le plan d'ouverture, plein dès qu'on défile ; la ligne dorée
  // du bas de la barre indique la progression dans la page.
  useEffect(() => {
    let attente = false
    const onScroll = () => {
      setDefile(window.scrollY > 40)
      if (attente) return
      attente = true
      requestAnimationFrame(() => {
        const course = document.documentElement.scrollHeight - window.innerHeight
        entete.current?.style.setProperty('--sp', String(course > 0 ? Math.min(1, window.scrollY / course) : 0))
        attente = false
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [pathname])

  useEffect(() => setOuvert(false), [pathname])

  // Le menu plein écran bloque le défilement de la page derrière lui.
  useEffect(() => {
    document.body.style.overflow = ouvert ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [ouvert])

  // Échap ferme le menu.
  useEffect(() => {
    if (!ouvert) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOuvert(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ouvert])

  const estEquipe = user?.role === 'COIFFEUR' || user?.role === 'ADMIN'
  const actif = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))
  const compteHref = estEquipe ? salonUrl('/planning') : '/compte'
  const compteLabel = estEquipe ? 'Back-office' : 'Mon compte'
  const CompteIcone = estEquipe ? LayoutDashboard : User

  return (
    <>
      <header ref={entete} className={cn('nav', (!plateau || defile || ouvert) && 'solid')}>
        <div className="nav-left">
          <Link className="logo" href="/" aria-label="Maitre Coif, accueil">
            <ThemeLogo priority />
          </Link>
        </div>

        <nav className="nav-links" aria-label="Navigation principale">
          {NAV_LINKS.map((l, i) => (
            <Link key={l.href} href={l.href} className={cn('nl', actif(l.href) && 'on')} aria-current={actif(l.href) ? 'page' : undefined}>
              <sup aria-hidden="true">{String(i + 1).padStart(2, '0')}</sup>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="nav-user">
          {user && (
            <>
              <a className="nl" href={compteHref}>
                <CompteIcone className="size-3.5" aria-hidden="true" />
                <span>{compteLabel}</span>
              </a>
              {estEquipe ? (
                <StaffSignOutButton />
              ) : (
                <button type="button" className="icon-btn" aria-label="Se déconnecter" onClick={deconnecterClient}>
                  <LogOut className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </>
          )}
          <ThemeToggle />
          <Link className="btn btn-gold btn-sm cta btn-ticket" href="/reservation" style={{ marginLeft: 10 }}>
            Réserver
          </Link>
          <button
            type="button"
            className="burger"
            aria-label={ouvert ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={ouvert}
            aria-controls="menu-mobile"
            onClick={() => setOuvert((o) => !o)}
          >
            {ouvert ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
          </button>
        </div>
        <i className="nav-progress" aria-hidden="true" />
      </header>

      {/* Menu mobile plein écran */}
      <div id="menu-mobile" className={cn('menu', ouvert && 'open')} aria-hidden={!ouvert}>
        <div className="menu-rail" aria-hidden="true" />
        {NAV_LINKS.map((l, i) => (
          <Link
            key={l.href}
            href={l.href}
            className={cn('big', actif(l.href) && 'on')}
            style={{ '--i': i } as CSSProperties}
            tabIndex={ouvert ? 0 : -1}
          >
            <span className="no">{String(i + 1).padStart(2, '0')}</span>
            {l.label}
          </Link>
        ))}
        <Link
          className="btn btn-gold btn-ticket"
          href="/reservation"
          style={{ marginTop: 30, height: 60, '--i': NAV_LINKS.length } as CSSProperties}
          tabIndex={ouvert ? 0 : -1}
        >
          Réserver un rendez-vous
        </Link>
        {user && (
          <div className="small">
            <a href={compteHref} tabIndex={ouvert ? 0 : -1}>
              {compteLabel}
            </a>
            {!estEquipe && (
              <button type="button" onClick={deconnecterClient} tabIndex={ouvert ? 0 : -1}>
                Se déconnecter
              </button>
            )}
          </div>
        )}
        <div className="menu-foot">
          <ThemeToggle />
          Route Afran Km 5, Sfax
          <br />
          Mardi — Samedi · 10h00 — 20h30 · Sur rendez-vous
        </div>
      </div>

      {!plateau && <div className="nav-spacer" aria-hidden="true" />}
    </>
  )
}
