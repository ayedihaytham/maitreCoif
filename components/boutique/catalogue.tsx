'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Minus, Package, Plus, Scissors } from 'lucide-react'

import { usePanier } from '@/components/boutique/panier'
import { suivre } from '@/lib/analytics'
import type { ProduitPublic } from '@/lib/boutique'
import { QUANTITE_MAX, SEUIL_STOCK_BAS } from '@/lib/boutique-constantes'
import { cn, formatPrix } from '@/lib/utils'

const jourCourt = (iso: string) => iso.split('-').reverse().join('/')

/** Photo du produit, ou un emplacement sobre quand le salon n'en a pas encore mis. */
export function VisuelProduit({ produit }: { produit: Pick<ProduitPublic, 'image' | 'nom'> }) {
  return produit.image ? (
    // eslint-disable-next-line @next/next/no-img-element -- photo servie par /api/boutique, déjà dimensionnée à l'envoi
    <img src={produit.image} alt={produit.nom} width={640} height={640} loading="lazy" decoding="async" />
  ) : (
    <span className="bq-art" aria-hidden="true">
      <Package />
    </span>
  )
}

/** Sélecteur de quantité (− 2 +). `max` borne le « + ». */
export function Quantite({ nom, valeur, max, onChange }: { nom: string; valeur: number; max: number; onChange: (v: number) => void }) {
  return (
    <span className="bq-qty" role="group" aria-label={`Quantité de ${nom}`}>
      <button type="button" onClick={() => onChange(valeur - 1)} aria-label={`Retirer un ${nom}`}>
        <Minus aria-hidden="true" />
      </button>
      <span aria-live="polite">{valeur}</span>
      <button type="button" onClick={() => onChange(valeur + 1)} disabled={valeur >= max} aria-label={`Ajouter un ${nom}`}>
        <Plus aria-hidden="true" />
      </button>
    </span>
  )
}

function CartePanier({ produit }: { produit: ProduitPublic }) {
  const panier = usePanier()
  const quantite = panier.quantiteDe('produit', produit.id)
  const rupture = produit.stock < 1
  const max = Math.min(QUANTITE_MAX, produit.stock)

  return (
    <article className={cn('bq-card', rupture && 'out')}>
      <div className="bq-im">
        <VisuelProduit produit={produit} />
        {rupture ? <span className="bq-badge bad">Rupture</span> : produit.stock <= SEUIL_STOCK_BAS ? <span className="bq-badge">Plus que {produit.stock}</span> : null}
      </div>
      <div className="bq-bd">
        {produit.categorie && <span className="bq-cat">{produit.categorie}</span>}
        <h3>{produit.nom}</h3>
        {produit.description && <p>{produit.description}</p>}
        <div className="bq-ft">
          <b>{formatPrix(produit.prix)}</b>
          {rupture ? (
            <span className="bq-indispo">Indisponible</span>
          ) : quantite > 0 ? (
            <Quantite nom={produit.nom} valeur={quantite} max={max} onChange={(v) => panier.regler('produit', produit.id, v)} />
          ) : (
            <button
              type="button"
              className="btn btn-gold btn-sm"
              data-ph="boutique-ajouter"
              onClick={() => {
                panier.regler('produit', produit.id, 1)
                suivre('boutique_ajout', { type: 'produit' })
              }}
            >
              Ajouter
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

/** Les produits de la boutique (les packs de prestations se réservent comme des prestations, dans « Nos services »). */
export function Catalogue({ produits }: { produits: ProduitPublic[] }) {
  const panier = usePanier()
  const [categorie, setCategorie] = useState('Tous')

  const categories = useMemo(() => ['Tous', ...Array.from(new Set(produits.map((p) => p.categorie).filter((c): c is string => Boolean(c))))], [produits])
  const visibles = categorie === 'Tous' ? produits : produits.filter((p) => p.categorie === categorie)

  // Total du panier d'après le catalogue affiché (le serveur recalcule le vrai total à la confirmation).
  const total = panier.lignes.reduce((s, l) => {
    return s + (produits.find((p) => p.id === l.id)?.prix ?? 0) * l.quantite
  }, 0)

  return (
    <div className={cn(panier.nombre > 0 && 'has-bar')}>
      {categories.length > 2 && (
        <div className="bq-toolbar">
          <div className="bq-filters" role="group" aria-label="Filtrer par catégorie">
            {categories.map((c) => (
              <button key={c} type="button" className={cn(c === categorie && 'on')} aria-pressed={c === categorie} onClick={() => setCategorie(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {visibles.length === 0 ? (
        <p className="empty-state">Aucun produit disponible pour le moment.</p>
      ) : (
        <div className="bq-grid">
          {visibles.map((p) => (
            <CartePanier key={p.id} produit={p} />
          ))}
        </div>
      )}

      {panier.nombre > 0 && (
        <div className="bq-bar" role="region" aria-label="Résumé du panier">
          <div>
            <span className="s">
              <Check className="size-3.5" aria-hidden="true" /> {panier.nombre} article{panier.nombre > 1 ? 's' : ''}
            </span>
            <span className="t">{formatPrix(total)}</span>
          </div>
          <Link className="btn btn-gold btn-sm" href="/boutique/panier" data-ph="boutique-voir-panier">
            Voir mon panier <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  )
}
