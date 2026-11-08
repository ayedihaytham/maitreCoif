import Link from 'next/link'
import { Clock, Scissors } from 'lucide-react'

import { Reveal } from '@/components/site/reveal'
import type { PackPublic } from '@/lib/boutique'
import { formatPrix } from '@/lib/utils'

const jourCourt = (iso: string) => iso.split('-').reverse().join('/')

/** Les packs de prestations (page « Nos services »). Un pack se réserve comme une prestation : lien vers l'assistant de réservation. */
export function PacksListe({ packs }: { packs: PackPublic[] }) {
  if (packs.length === 0) return <p className="empty-state">Aucun pack disponible pour le moment.</p>

  return (
    <div className="bq-packs">
      {packs.map((k, i) => {
        const duree = k.elements.reduce((t, e) => t + (e.duree ?? 0), 0)
        return (
          <Reveal as="article" key={k.id} delay={i % 3} className="bq-pack">
            <div className="bq-pack-top">
              <div style={{ minWidth: 0 }}>
                <h3>{k.nom}</h3>
                {k.description && <p>{k.description}</p>}
              </div>
              {k.pourcentage > 0 && <span className="bq-off">−{k.pourcentage} %</span>}
            </div>
            <ul className="bq-incl">
              {k.elements.map((e) => (
                <li key={e.id}>
                  <Scissors aria-hidden="true" />
                  <span>{e.nom}</span>
                  <span>{formatPrix(e.prix)}</span>
                </li>
              ))}
            </ul>
            <div className="bq-pack-prix">
              <div>
                {k.economie > 0 && <s>{formatPrix(k.normal)}</s>}
                <b>{formatPrix(k.final)}</b>
                {k.economie > 0 && <span className="econ">Vous économisez {formatPrix(k.economie)}</span>}
              </div>
              <span className="bq-note" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <Clock className="size-3.5" aria-hidden="true" /> {duree} min
              </span>
            </div>
            <div className="bq-pack-cta">
              <Link className="btn btn-gold" href={`/reservation?packId=${k.id}`} data-ph="reserver-pack">
                Réserver ce pack
              </Link>
              {k.fin && <p className="bq-note">Valable jusqu’au {jourCourt(k.fin)}.</p>}
            </div>
          </Reveal>
        )
      })}
    </div>
  )
}
