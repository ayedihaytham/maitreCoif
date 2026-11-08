'use client'

// Panier de la boutique, gardé dans le navigateur (localStorage) : aucun compte, aucune donnée sur le
// serveur tant que le client n'a pas confirmé. Le panier ne contient que des identifiants et des
// quantités : les prix et le stock sont toujours relus côté serveur (cf. /api/boutique/panier).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { QUANTITE_MAX } from '@/lib/boutique-constantes'

export interface LignePanierLocale {
  type: 'produit' | 'pack'
  id: string
  quantite: number
}

interface ContextePanier {
  lignes: LignePanierLocale[]
  /** Nombre d'articles (quantités additionnées). */
  nombre: number
  /** Faux avant la lecture du stockage local : évite d'afficher un panier vide puis rempli. */
  pret: boolean
  quantiteDe: (type: LignePanierLocale['type'], id: string) => number
  /** Fixe la quantité d'un article (0 = le retirer). */
  regler: (type: LignePanierLocale['type'], id: string, quantite: number) => void
  /** Remplace tout le panier (après correction par le serveur). */
  remplacer: (lignes: LignePanierLocale[]) => void
  vider: () => void
}

const CLE = 'mc-panier-v1'
const Contexte = createContext<ContextePanier | null>(null)

function lire(): LignePanierLocale[] {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? '[]')
    if (!Array.isArray(brut)) return []
    return brut.flatMap((l) => {
      const ok = l && l.type === 'produit' && typeof l.id === 'string' && Number.isInteger(l.quantite) && l.quantite > 0
      return ok ? [{ type: l.type, id: l.id, quantite: Math.min(QUANTITE_MAX, l.quantite) } as LignePanierLocale] : []
    })
  } catch {
    return []
  }
}

function ecrire(lignes: LignePanierLocale[]) {
  try {
    localStorage.setItem(CLE, JSON.stringify(lignes))
  } catch {
    // stockage indisponible (navigation privée stricte...) : le panier reste valable pour cette page
  }
}

export function PanierProvider({ children }: { children: React.ReactNode }) {
  const [lignes, setLignes] = useState<LignePanierLocale[]>([])
  const [pret, setPret] = useState(false)

  useEffect(() => {
    setLignes(lire())
    setPret(true)
    // Un autre onglet a modifié le panier : on le suit.
    const surStockage = (e: StorageEvent) => e.key === CLE && setLignes(lire())
    window.addEventListener('storage', surStockage)
    return () => window.removeEventListener('storage', surStockage)
  }, [])

  const appliquer = useCallback((suite: (actuel: LignePanierLocale[]) => LignePanierLocale[]) => {
    setLignes((actuel) => {
      const prochain = suite(actuel)
      ecrire(prochain)
      return prochain
    })
  }, [])

  const regler = useCallback<ContextePanier['regler']>(
    (type, id, quantite) =>
      appliquer((actuel) => {
        const q = Math.min(QUANTITE_MAX, Math.max(0, Math.floor(quantite)))
        const sans = actuel.filter((l) => !(l.type === type && l.id === id))
        return q === 0 ? sans : actuel.some((l) => l.type === type && l.id === id) ? actuel.map((l) => (l.type === type && l.id === id ? { ...l, quantite: q } : l)) : [...sans, { type, id, quantite: q }]
      }),
    [appliquer],
  )

  const valeur = useMemo<ContextePanier>(
    () => ({
      lignes,
      nombre: lignes.reduce((s, l) => s + l.quantite, 0),
      pret,
      quantiteDe: (type, id) => lignes.find((l) => l.type === type && l.id === id)?.quantite ?? 0,
      regler,
      remplacer: (suite) => appliquer(() => suite),
      vider: () => appliquer(() => []),
    }),
    [lignes, pret, regler, appliquer],
  )

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

export function usePanier(): ContextePanier {
  const contexte = useContext(Contexte)
  if (!contexte) throw new Error('usePanier doit être utilisé dans <PanierProvider>')
  return contexte
}
