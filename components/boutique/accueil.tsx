import Link from 'next/link'
import { ArrowRight, Package } from 'lucide-react'

import { Reveal } from '@/components/site/reveal'
import type { ProduitPublic } from '@/lib/boutique'
import { SEUIL_STOCK_BAS } from '@/lib/boutique-constantes'
import { formatPrix } from '@/lib/utils'

/**
 * Section « boutique » de l'accueil : quelques produits. Les achats se font sur la page boutique ; ici,
 * tout est un lien (aucun script côté navigateur). Les packs ont leur propre section, avant les prestations.
 */
export function BoutiqueAccueil({ produits }: { produits: ProduitPublic[] }) {
  if (produits.length === 0) return null

  return (
    <section className="bq-home" data-scene="7" aria-labelledby="t-boutique">
      <div className="wrap">
        <Reveal className="head-row">
          <div>
            <div className="lbl">La boutique</div>
            <h2 className="h2" id="t-boutique">
              Prolongez le geste <em>à la maison.</em>
            </h2>
            <p className="lead">Réservez en ligne, retirez et réglez au salon : sans paiement en ligne, sans compte à créer.</p>
          </div>
          <Link className="tlink" href="/boutique" data-ph="toute-la-boutique">
            Toute la boutique <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </Reveal>

        <div className="bq-grid">
            {produits.map((p, i) => (
              <Reveal as="article" key={p.id} delay={i % 4} className={`bq-card${p.stock < 1 ? ' out' : ''}`}>
                <Link href="/boutique" className="bq-im" tabIndex={-1} aria-hidden="true">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- photo servie par /api/boutique, déjà dimensionnée
                    <img src={p.image} alt="" width={640} height={640} loading="lazy" decoding="async" />
                  ) : (
                    <span className="bq-art">
                      <Package />
                    </span>
                  )}
                  {p.stock > 0 && p.stock <= SEUIL_STOCK_BAS && <span className="bq-badge">Plus que {p.stock}</span>}
                </Link>
                <div className="bq-bd">
                  {p.categorie && <span className="bq-cat">{p.categorie}</span>}
                  <h3>{p.nom}</h3>
                  <div className="bq-ft">
                    <b>{formatPrix(p.prix)}</b>
                    <Link className="btn btn-ghost btn-sm" href="/boutique" data-ph="accueil-produit">
                      Découvrir
                    </Link>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
      </div>
    </section>
  )
}
