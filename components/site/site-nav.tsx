'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, LogOut, Menu, User, X } from 'lucide-react'

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

interface SiteNavProps {
  user: { name?: string | null; role: Role } | null
}

async function deconnecterClient() {
  const { signOut } = await import('next-auth/react')
  signOut({ callbackUrl: '/' })
}

export function SiteNav({ user }: SiteNavProps) {
  const pathname = usePathname()
  const accueil = pathname === '/'
  const [defile, setDefile] = useState(false)
  const [ouvert, setOuvert] = useState(false)

  // Transparent sur l'image d'ouverture, plein dès qu'on défile (ou hors accueil).
  useEffect(() => {
    const onScroll = () => setDefile(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setOuvert(false), [pathname])

  // Le menu plein écran bloque le défilement de la page derrière lui.
  useEffect(() => {
    document.body.style.overflow = ouvert ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [ouvert])

  const estEquipe = user?.role === 'COIFFEUR' || user?.role === 'ADMIN'
  const actif = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))
  const compteHref = estEquipe ? salonUrl('/planning') : '/compte'
  const compteLabel = estEquipe ? 'Back-office' : 'Mon compte'
  const CompteIcone = estEquipe ? LayoutDashboard : User

  return (
    <>
      <header className={cn('nav', (!accueil || defile || ouvert) && 'solid')}>
        <Link className="logo" href="/" aria-label="Maitre Coif, accueil">
          <Image src="/logo-gold.png" alt="Maitre Coif" width={376} height={310} priority />
        </Link>

        <nav className="nav-links" aria-label="Navigation principale">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={cn('nl', actif(l.href) && 'on')} aria-current={actif(l.href) ? 'page' : undefined}>
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
          <Link className="btn btn-gold btn-sm cta" href="/reservation" style={{ marginLeft: 10 }}>
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
      </header>

      <div id="menu-mobile" className={cn('menu', ouvert && 'open')} aria-hidden={!ouvert}>
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={cn('big', actif(l.href) && 'on')} tabIndex={ouvert ? 0 : -1}>
            {l.label}
          </Link>
        ))}
        <Link className="btn btn-gold" href="/reservation" style={{ marginTop: 28, height: 60 }} tabIndex={ouvert ? 0 : -1}>
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
      </div>

      {!accueil && <div className="nav-spacer" aria-hidden="true" />}
    </>
  )
}
