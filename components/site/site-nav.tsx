'use client'

import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Menu, ShoppingBag, X } from 'lucide-react'

import { usePanier } from '@/components/boutique/panier'
import { ThemeLogo } from '@/components/theme-logo'
import { signalerSession } from '@/lib/analytics'
import { ThemeToggle } from '@/components/theme-toggle'
import { salonUrl } from '@/lib/salon-host'
import { cn } from '@/lib/utils'
import type { Role } from '@prisma/client'

const TOUS_LES_LIENS = [
  { href: '/', label: 'Accueil' },
  { href: '/services', label: 'Services' },
  { href: '/equipe', label: 'Notre équipe' },
  { href: '/galerie', label: 'Galerie' },
  { href: '/boutique', label: 'Boutique' },
  { href: '/suivi', label: 'Suivi de réservation' },
]

type Utilisateur = { name?: string | null; role: Role } | null

export function SiteNav({ horaires = [], boutique = true }: { horaires?: { jours: string; heures: string }[]; boutique?: boolean }) {
  // Sans produit en ligne, ni l'onglet Boutique ni le panier n'ont lieu d'être.
  const NAV_LINKS = boutique ? TOUS_LES_LIENS : TOUS_LES_LIENS.filter((l) => l.href !== '/boutique')
  const pathname = usePathname()
  const panier = usePanier()
  const [user, setUser] = useState<Utilisateur>(null)

  // La session est demandée au navigateur (pas au rendu serveur) : les pages publiques
  // restent statiques. Relue quand l'onglet redevient visible (connexion dans un autre onglet).
  useEffect(() => {
    let annule = false
    const lire = () =>
      fetch('/api/session', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (annule) return
          setUser(d?.user ?? null)
          // Les visites du personnel ne comptent pas dans l'audience.
          signalerSession(d?.user?.role)
        })
        .catch(() => {})
    lire()
    const surVisible = () => document.visibilityState === 'visible' && lire()
    document.addEventListener('visibilitychange', surVisible)
    return () => {
      annule = true
      document.removeEventListener('visibilitychange', surVisible)
    }
  }, [])
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
  // Lien actif : calculé après le montage. Sur la page d'accueil prérendue, le serveur ne connaît pas
  // toujours la même adresse que le navigateur ; le HTML serveur et le premier rendu client doivent
  // rester identiques, sinon React reconstruit toute la page (erreur d'hydratation #418).
  const [monte, setMonte] = useState(false)
  useEffect(() => setMonte(true), [])
  // Déjà sur l'accueil, un lien vers « / » ne change pas de page : Next.js ne fait alors rien. On remonte donc en haut.
  const versLeHaut = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href !== '/' || pathname !== '/' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    setOuvert(false)
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
  const actif = (href: string) => monte && (href === '/' ? pathname === '/' : pathname.startsWith(href))
  // Seul le personnel (Clerk) a une session : il n'y a plus de « Mon compte » pour les clients.
  const compteHref = salonUrl('/planning')
  const compteLabel = 'Back-office'

  return (
    <>
      <header ref={entete} className={cn('nav', (defile || ouvert) && 'solid')}>
        <div className="nav-left">
          <Link className="logo" href="/" aria-label="Maitre Coif, accueil" onClick={(e) => versLeHaut(e, "/")}>
            <ThemeLogo priority />
          </Link>
        </div>

        <nav className="nav-links" aria-label="Navigation principale">
          {NAV_LINKS.map((l, i) => (
            <Link key={l.href} href={l.href} className={cn('nl', actif(l.href) && 'on')} aria-current={actif(l.href) ? 'page' : undefined} onClick={(e) => versLeHaut(e, l.href)}>
              <sup aria-hidden="true">{String(i + 1).padStart(2, '0')}</sup>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="nav-user">
          {estEquipe && (
            <>
              <a className="nl" href={compteHref}>
                <LayoutDashboard className="size-3.5" aria-hidden="true" />
                <span>{compteLabel}</span>
              </a>
            </>
          )}
          {boutique && (
            <Link className="bq-bag" href="/boutique/panier" aria-label={panier.nombre > 0 ? `Mon panier, ${panier.nombre} article${panier.nombre > 1 ? 's' : ''}` : 'Mon panier'} data-ph="panier-barre">
              <ShoppingBag className="size-4" aria-hidden="true" />
              {panier.nombre > 0 && <em aria-hidden="true">{panier.nombre}</em>}
            </Link>
          )}
          <ThemeToggle />
          <Link className="btn btn-gold btn-sm cta btn-ticket" href="/reservation" style={{ marginLeft: 10 }} data-ph="reserver-barre">
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
            onClick={(e) => versLeHaut(e, l.href)}
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
          data-ph="reserver-menu"
          style={{ marginTop: 30, height: 60, '--i': NAV_LINKS.length } as CSSProperties}
          tabIndex={ouvert ? 0 : -1}
        >
          Réserver un rendez-vous
        </Link>
        {boutique && (
          <div className="small" style={{ marginTop: 18 }}>
            <Link href="/boutique/panier" tabIndex={ouvert ? 0 : -1}>
              Mon panier{panier.nombre > 0 ? ` (${panier.nombre})` : ''}
            </Link>
          </div>
        )}
        {estEquipe && (
          <div className="small">
            <a href={compteHref} tabIndex={ouvert ? 0 : -1}>
              {compteLabel}
            </a>
          </div>
        )}
        <div className="menu-foot">
          <ThemeToggle />
          Route Afran Km 5, Sfax
          <br />
          {horaires.map((h) => `${h.jours} · ${h.heures}`).join(' · ')}
          {horaires.length > 0 && ' · '}Sur rendez-vous
        </div>
      </div>

      {/* Toujours présent (le HTML serveur et client doit être identique) : le CSS le masque sur les pages à plan d'ouverture. */}
      <div className="nav-spacer" aria-hidden="true" />
    </>
  )
}
