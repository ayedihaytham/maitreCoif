'use client'

import Link from 'next/link'
import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { LayoutDashboard, LogOut, Menu, User, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Role } from '@prisma/client'

const NAV_LINKS = [
  { href: '/', label: 'Accueil' },
  { href: '/services', label: 'Services' },
  { href: '/equipe', label: 'Notre équipe' },
  { href: '/suivi', label: 'Suivi de réservation' },
]

interface HeaderActionsProps {
  user: { name?: string | null; role: Role } | null
}

export function HeaderActions({ user }: HeaderActionsProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <nav className="hidden items-center gap-8 md:flex" aria-label="Navigation principale">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-gold"
          >
            {link.label}
          </Link>
        ))}
        {user ? <AccountLink user={user} /> : <ConnexionLink />}
      </nav>

      <button
        className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground md:hidden"
        type="button"
        aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-40 border-b border-border/60 bg-background px-5 py-6 md:hidden">
          <nav className="flex flex-col gap-5" aria-label="Navigation mobile">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-gold"
              >
                {link.label}
              </Link>
            ))}
            {user ? <AccountLink user={user} onNavigate={() => setOpen(false)} /> : <ConnexionLink onNavigate={() => setOpen(false)} />}
          </nav>
        </div>
      )}
    </>
  )
}

function ConnexionLink({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/reservation"
      onClick={onNavigate}
      className="border border-gold px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-gold transition-colors hover:bg-gold hover:text-background"
    >
      Réserver
    </Link>
  )
}

function AccountLink({ user, onNavigate }: { user: { name?: string | null; role: Role }; onNavigate?: () => void }) {
  const isStaff = user.role === 'COIFFEUR' || user.role === 'ADMIN'

  return (
    <div className="flex items-center gap-4">
      <Link
        href={isStaff ? '/admin/planning' : '/compte'}
        onClick={onNavigate}
        className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-gold"
      >
        {isStaff ? <LayoutDashboard className="size-3.5" /> : <User className="size-3.5" />}
        {isStaff ? 'Back-office' : 'Mon compte'}
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Se déconnecter"
        onClick={() => signOut({ callbackUrl: '/' })}
      >
        <LogOut className="size-3.5" />
      </Button>
    </div>
  )
}
