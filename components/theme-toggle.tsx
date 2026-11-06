'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'dark' | 'light'

/**
 * Bascule entre le thème sombre (par défaut) et le thème clair.
 * Le thème est porté par <html data-theme> ; le script de app/layout.tsx l'applique
 * avant le premier affichage pour éviter tout clignotement. Le choix est mémorisé
 * dans le navigateur (localStorage).
 */
export function ThemeToggle({ className, libelle }: { className?: string; libelle?: string }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
  }, [])

  function basculer() {
    const suivant: Theme = theme === 'light' ? 'dark' : 'light'
    document.documentElement.dataset.theme = suivant
    try {
      localStorage.setItem('mc-theme', suivant)
    } catch {
      // navigation privée : le choix vaut pour cette visite seulement
    }
    setTheme(suivant)
  }

  return (
    <button
      type="button"
      className={`theme-toggle${className ? ` ${className}` : ''}`}
      onClick={basculer}
      data-ph="theme"
      aria-label={theme === 'light' ? 'Passer au thème sombre' : 'Passer au thème clair'}
      title={theme === 'light' ? 'Thème sombre' : 'Thème clair'}
    >
      <Sun className="i-sun" aria-hidden="true" />
      <Moon className="i-moon" aria-hidden="true" />
      <span className="tt-label">{libelle ?? (theme === 'light' ? 'Thème sombre' : 'Thème clair')}</span>
    </button>
  )
}

/**
 * Ré-applique le thème choisi une fois la page hydratée. Le script de app/layout.tsx le fait
 * avant l'affichage ; ceci rattrape le cas où React régénère le document (erreur d'hydratation)
 * et remet l'attribut par défaut.
 */
export function ThemeSync() {
  useEffect(() => {
    try {
      const t = localStorage.getItem('mc-theme')
      document.documentElement.dataset.theme = t === 'light' ? 'light' : 'dark'
    } catch {
      // stockage indisponible : on garde le thème courant
    }
  }, [])
  return null
}
