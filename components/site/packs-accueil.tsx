import type { CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import type { PackPublic } from '@/lib/boutique'
import { formatPrix } from '@/lib/utils'

/**
 * Les packs à l'accueil : la même pellicule que les prestations, mais elle défile dans l'autre sens
 * (data-dir="rev" : voir Cinema). Les cartes sont rangées de droite à gauche (row-reverse) : le premier
 * pack apparaît d'abord, l'ordre de tabulation reste l'ordre de lecture. Rien si aucun pack n'est proposé.
 */
export function PacksAccueil({ packs }: { packs: PackPublic[] }) {
  if (packs.length === 0) return null

  return (
    <section className="h-reel rev" data-scene="9" data-pin data-dir="rev" style={{ '--n': packs.length } as CSSProperties} aria-labelledby="t-packs">
      <div className="h-stage">
        <div className="h-reel-head">
          <div>
            <div className="lbl">Nos packs</div>
            <h2 className="h2" id="t-packs">
              Plus de soins, <em>un meilleur prix.</em>
            </h2>
          </div>
          <Link className="tlink" href="/services?vue=packs" data-ph="tous-les-packs">
            Tous nos packs <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="h-strip">
          {packs.map((k, i) => (
            <article key={k.id} className="h-card pk" data-depth>
              <span className="flare" />
              {k.pourcentage > 0 && <span className="pk-off">−{k.pourcentage} %</span>}
              <div className="no" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </div>
              <div>
                <h3>{k.nom}</h3>
                <p className="pk-incl">{k.elements.map((e) => e.nom).join(' · ')}</p>
                <div className="meta">
                  <span className="pk-old">{k.economie > 0 ? <s>{formatPrix(k.normal)}</s> : null}</span>
                  <b>{formatPrix(k.final)}</b>
                </div>
                <Link className="tlink" href={`/reservation?packId=${k.id}`} style={{ marginTop: 18 }} data-ph="accueil-pack">
                  Réserver <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
