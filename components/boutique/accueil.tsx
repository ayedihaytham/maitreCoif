import Link from 'next/link'
import { ArrowRight, Package, Scissors } from 'lucide-react'

import { Reveal } from '@/components/site/reveal'
import type { PackPublic, ProduitPublic } from '@/lib/boutique'
import { SEUIL_STOCK_BAS } from '@/lib/boutique-constantes'
import { formatPrix } from '@/lib/utils'

/**
 * Section « boutique » de l'accueil : quelques produits et les packs du moment. Les achats se font sur la
 * page boutique ; ici, tout est un lien (aucun script côté navigateur).
 */
export function BoutiqueAccueil({ produits, packs }: { produits: ProduitPublic[]; packs: PackPublic[] }) {
  if (produits.length === 0 && packs.length === 0) return null

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

        {produits.length > 0 && (
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
        )}

        {packs.length > 0 && (
          <>
            <Reveal className="bq-sous">
              <h3>
                Nos <em>packs.</em>
              </h3>
              <Link className="tlink" href="/boutique?vue=packs" data-ph="tous-les-packs">
                Tous les packs <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Reveal>
            <div className="bq-packs">
              {packs.map((k, i) => (
                <Reveal as="article" key={k.id} delay={i} className="bq-pack">
                  <div className="bq-pack-top">
                    <div style={{ minWidth: 0 }}>
                      <h3>{k.nom}</h3>
                      {k.description && <p>{k.description}</p>}
                    </div>
                    {k.pourcentage > 0 && <span className="bq-off">−{k.pourcentage} %</span>}
                  </div>
                  <ul className="bq-incl">
                    {k.elements.map((e) => (
                      <li key={`${e.type}${e.id}`}>
                        {e.type === 'service' ? <Scissors aria-hidden="true" /> : <Package aria-hidden="true" />}
                        <span>
                          {e.nom}
                          {e.quantite > 1 ? ` ×${e.quantite}` : ''}
                          {e.type === 'service' ? <em> · prestation</em> : null}
                        </span>
                        <span>{formatPrix(e.prix * e.quantite)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="bq-pack-prix">
                    <div>
                      {k.economie > 0 && <s>{formatPrix(k.normal)}</s>}
                      <b>{formatPrix(k.final)}</b>
                      {k.economie > 0 && <span className="econ">Vous économisez {formatPrix(k.economie)}</span>}
                    </div>
                  </div>
                  <div className="bq-pack-cta">
                    <Link className="btn btn-gold" href="/boutique?vue=packs" data-ph="accueil-pack">
                      Réserver ce pack
                    </Link>
                  </div>
                </Reveal>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
