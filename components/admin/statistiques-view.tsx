import type { CSSProperties } from 'react'
import Link from 'next/link'

import { AdminPageHead } from '@/components/admin/page-head'
import { cn } from '@/lib/utils'

export type PeriodeStats = 'semaine' | 'mois' | 'annee'

export interface StatsAffichees {
  chiffreAffairesTotal: number
  nombreRendezVous: number
  tauxRemplissageGlobal: number
  parStatut: Record<string, number>
  parCoiffeur: { id: string; nom: string; rendezVous: number; chiffreAffaires: number; tauxRemplissage: number }[]
}

const PERIODES: { value: PeriodeStats; label: string }[] = [
  { value: 'semaine', label: '7 jours' },
  { value: 'mois', label: 'Ce mois-ci' },
  { value: 'annee', label: 'Cette année' },
]

const LIBELLE_PERIODE: Record<PeriodeStats, string> = {
  semaine: 'sur les 7 derniers jours',
  mois: 'ce mois-ci',
  annee: 'cette année',
}

// Une couleur par statut (jamais la couleur seule : chaque statut a aussi son libellé et son nombre).
const STATUTS: { key: string; label: string; couleur: string }[] = [
  { key: 'CONFIRME', label: 'Confirmés', couleur: '#d4af37' },
  { key: 'TERMINE', label: 'Terminés', couleur: '#7bd88f' },
  { key: 'ANNULE', label: 'Annulés', couleur: '#ff6b6e' },
]

const pourcent = (v: number) => Math.round(v * 100)

// Présentation seule (données fournies) : la page serveur gère l'accès et la lecture en base.
export function StatistiquesView({ stats, periode }: { stats: StatsAffichees; periode: PeriodeStats }) {
  const totalStatuts = STATUTS.reduce((n, s) => n + (stats.parStatut[s.key] ?? 0), 0)
  const caMax = Math.max(1, ...stats.parCoiffeur.map((c) => c.chiffreAffaires))
  const classement = [...stats.parCoiffeur].sort((a, b) => b.chiffreAffaires - a.chiffreAffaires || b.rendezVous - a.rendezVous)
  const taux = pourcent(stats.tauxRemplissageGlobal)

  return (
    <div>
      <AdminPageHead
        section="Statistiques"
        titre={
          <>
            Les <em>statistiques.</em>
          </>
        }
        description="Le chiffre d'affaires ne compte que les prestations terminées ; le taux de remplissage compare les créneaux réservés aux horaires des coiffeurs."
      >
        <div className="ad-seg" role="group" aria-label="Période">
          {PERIODES.map((p) => (
            <Link key={p.value} href={`/statistiques?periode=${p.value}`} className={cn(periode === p.value && 'on')} aria-current={periode === p.value ? 'true' : undefined}>
              {p.label}
            </Link>
          ))}
        </div>
      </AdminPageHead>

      <div className="ad-body">
        <div className="st-hero">
          <section className="big" aria-label="Chiffre d'affaires">
            <span className="lbl">Chiffre d&apos;affaires · {LIBELLE_PERIODE[periode]}</span>
            <div className="st-num">
              {stats.chiffreAffairesTotal.toFixed(3)}
              <small>DT</small>
            </div>
            <p className="st-note">Prestations terminées uniquement. Les rendez-vous confirmés à venir s&apos;ajoutent dès qu&apos;ils sont marqués « Terminé ».</p>
          </section>

          <section className="ad-card st-box" aria-label="Rendez-vous">
            <span className="lbl dim">Rendez-vous</span>
            <div className="v">{stats.nombreRendezVous}</div>
            <p className="st-note" style={{ margin: 0 }}>
              {stats.parStatut.ANNULE ? `dont ${stats.parStatut.ANNULE} annulé${stats.parStatut.ANNULE > 1 ? 's' : ''}` : 'aucune annulation'}
            </p>
          </section>

          <section className="ad-card st-box" aria-label="Taux de remplissage">
            <span className="lbl dim">Taux de remplissage</span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="st-gauge" style={{ '--v': taux } as CSSProperties} role="img" aria-label={`${taux} % des créneaux réservés`}>
                <span>{taux} %</span>
              </div>
            </div>
          </section>
        </div>

        <section className="st-sec" aria-labelledby="st-statuts">
          <h2 id="st-statuts">Répartition des rendez-vous</h2>
          <div className="st-bar" role="img" aria-label="Répartition par statut">
            {totalStatuts > 0 &&
              STATUTS.map((s) => {
                const n = stats.parStatut[s.key] ?? 0
                return n > 0 ? <i key={s.key} style={{ width: `${(n / totalStatuts) * 100}%`, background: s.couleur }} /> : null
              })}
          </div>
          <div className="st-legend">
            {STATUTS.map((s) => (
              <div key={s.key}>
                <span className="lbl dim" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <span className="dot" style={{ background: s.couleur }} aria-hidden="true" />
                  {s.label}
                </span>
                <span className="n">{stats.parStatut[s.key] ?? 0}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="st-sec" aria-labelledby="st-equipe">
          <h2 id="st-equipe">Classement de l&apos;équipe</h2>
          {classement.length === 0 ? (
            <p className="ad-empty">Aucun coiffeur actif.</p>
          ) : (
            <div className="st-rank">
              {classement.map((c, i) => (
                <article className="ad-card st-line" key={c.id}>
                  <div>
                    <div className="nm">
                      <span style={{ color: 'var(--a-gold)', marginRight: 12, fontVariantNumeric: 'lining-nums' }}>{String(i + 1).padStart(2, '0')}</span>
                      {c.nom}
                    </div>
                    <div className="sub">
                      {c.rendezVous} rendez-vous · remplissage {pourcent(c.tauxRemplissage)} %
                    </div>
                  </div>
                  <div className="track" role="img" aria-label={`Chiffre d'affaires de ${c.nom} : ${c.chiffreAffaires.toFixed(3)} DT`}>
                    <i style={{ width: `${(c.chiffreAffaires / caMax) * 100}%` }} />
                  </div>
                  <div>
                    <div className="ca">{c.chiffreAffaires.toFixed(3)} DT</div>
                    <div className="fill">{pourcent(c.tauxRemplissage)} %</div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
