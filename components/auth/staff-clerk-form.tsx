'use client'

import { SignIn, SignUp } from '@clerk/nextjs'
import { useSyncExternalStore } from 'react'

// Le thème (sombre/clair) est porté par <html data-theme> ; on s'y abonne pour que le
// formulaire Clerk change de couleurs dès que le visiteur bascule le thème.
function abonner(rappel: () => void) {
  const observateur = new MutationObserver(rappel)
  observateur.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observateur.disconnect()
}
const themeActuel = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')

const VARIABLES = {
  dark: {
    colorPrimary: '#d4af37',
    colorBackground: '#14120f',
    colorText: '#f5f3ee',
    colorTextSecondary: '#a09d96',
    colorTextOnPrimaryBackground: '#0a0a0a',
    colorInputBackground: '#0a0a0a',
    colorInputText: '#f5f3ee',
    colorNeutral: '#f5f3ee',
    colorDanger: '#e5484d',
  },
  light: {
    colorPrimary: '#d4af37',
    colorBackground: '#ffffff',
    colorText: '#1b1915',
    colorTextSecondary: '#6a655a',
    colorTextOnPrimaryBackground: '#0a0a0a',
    colorInputBackground: '#f6f3ec',
    colorInputText: '#1b1915',
    colorNeutral: '#1b1915',
    colorDanger: '#b3202a',
  },
} as const

const CARTE = {
  dark: { backgroundColor: '#14120f', border: '1px solid rgba(212,175,55,.28)', boxShadow: 'none' },
  light: { backgroundColor: '#ffffff', border: '1px solid rgba(125,95,8,.4)', boxShadow: '0 14px 38px rgba(27,25,21,.12)' },
} as const

/**
 * Formulaire de connexion / d'invitation de l'équipe (Clerk) aux couleurs du thème courant.
 * Seules les couleurs changent : le fonctionnement reste celui de Clerk.
 */
export function StaffClerkForm({ mode, masquerInscription }: { mode: 'sign-in' | 'sign-up'; masquerInscription?: boolean }) {
  const theme = useSyncExternalStore(abonner, themeActuel, () => 'dark' as const)
  const appearance = {
    variables: VARIABLES[theme],
    elements: { card: CARTE[theme], ...(masquerInscription ? { footerAction: { display: 'none' } } : {}) },
  }

  return mode === 'sign-in' ? (
    <SignIn path="/connexion" fallbackRedirectUrl="/planning" appearance={appearance} />
  ) : (
    <SignUp path="/inscription" signInUrl="/connexion" fallbackRedirectUrl="/planning" appearance={appearance} />
  )
}
