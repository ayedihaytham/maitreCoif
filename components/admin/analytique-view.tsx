import Link from 'next/link'

import { AdminPageHead } from '@/components/admin/page-head'
import { LIBELLES_CLICS, LIBELLES_PAGES, PERIODES_ANALYTIQUE, type Analytique, type PeriodeJours } from '@/lib/analytique'
import { cn } from '@/lib/utils'

const nf = new Intl.NumberFormat('fr-FR')
const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0).replace('.', ',')} %`
const jourCourt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** Courbe des visiteurs par jour (SVG simple, sans bibliothèque). */
function Courbe({ serie }: { serie: Analytique['serie'] }) {
  const L = 800
  const H = 200
  const max = Math.max(1, ...serie.map((j) => j.visiteurs))
  const x = (i: number) => (serie.length <= 1 ? L / 2 : (i / (serie.length - 1)) * L)
  const y = (v: number) => H - 6 - (v / max) * (H - 18)
  const points = serie.map((j, i) => `${x(i).toFixed(1)},${y(j.visiteurs).toFixed(1)}`).join(' ')
  const total = serie.reduce((s, j) => s + j.visiteurs, 0)
  const meilleur = serie.reduce((m, j) => (j.visiteurs > m.visiteurs ? j : m), serie[0])

  return (
    <div className="an-chart">
      <div className="an-axis-y" aria-hidden="true">
        <span>{nf.format(max)}</span>
        <span>0</span>
      </div>
      <svg
        viewBox={`0 0 ${L} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Visiteurs par jour sur ${serie.length} jours : ${nf.format(total)} au total, pic le ${meilleur ? jourCourt(meilleur.jour) : '—'} avec ${meilleur?.visiteurs ?? 0}`}
      >
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" x2={L} y1={H * g} y2={H * g} className="g" vectorEffect="non-scaling-stroke" />
        ))}
        {serie.length > 1 && <polygon points={`0,${H} ${points} ${L},${H}`} className="aire" />}
        <polyline points={points} className="ligne" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="an-axis-x" aria-hidden="true">
        <span>{jourCourt(serie[0].jour)}</span>
        <span>{jourCourt(serie[Math.floor(serie.length / 2)].jour)}</span>
        <span>{jourCourt(serie[serie.length - 1].jour)}</span>
      </div>
    </div>
  )
}

/** Liste classée avec barres proportionnelles ; le chiffre est toujours écrit (jamais la barre seule). */
function Classement({ lignes, vide }: { lignes: { nom: string; valeur: number }[]; vide: string }) {
  if (lignes.length === 0) return <p className="ad-empty">{vide}</p>
  const max = Math.max(1, ...lignes.map((l) => l.valeur))
  return (
    <ol className="an-rank">
      {lignes.map((l) => (
        <li key={l.nom}>
          <div className="top">
            <span className="nm">{l.nom}</span>
            <span className="n">{nf.format(l.valeur)}</span>
          </div>
          <div className="track" aria-hidden="true">
            <i style={{ width: `${(l.valeur / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  )
}

const TITRE = (
  <>
    L&apos;<em>audience.</em>
  </>
)

export function AnalytiqueView({ donnees, periode, erreurs = [] }: { donnees: Analytique; periode: PeriodeJours; erreurs?: string[] }) {
  const d = donnees
  const sansDonnees = d.visiteurs === 0 && d.pagesVues === 0
  const hautEntonnoir = Math.max(1, d.entonnoir[0]?.personnes ?? 1)

  return (
    <div>
      <AdminPageHead
        section="Analytique"
        titre={TITRE}
        description="Les visites du site public et le parcours de réservation, mesurés sans cookie. Les visites de l'équipe ne sont pas comptées. Chiffres mis à jour toutes les 5 minutes."
      >
        <div className="ad-seg" role="group" aria-label="Période">
          {PERIODES_ANALYTIQUE.map((p) => (
            <Link key={p.jours} href={`/analytique?periode=${p.jours}`} className={cn(periode === p.jours && 'on')} aria-current={periode === p.jours ? 'true' : undefined}>
              {p.libelle}
            </Link>
          ))}
        </div>
      </AdminPageHead>

      <div className="ad-body">
        {erreurs.length > 0 && (
          <div className="ad-note" role="status">
            <strong>Certaines rubriques n&apos;ont pas pu être lues.</strong> Les autres s&apos;affichent normalement.
            <ul className="an-errs">
              {erreurs.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {sansDonnees && erreurs.length === 0 && (
          <div className="ad-note" role="status">
            Aucune visite enregistrée sur cette période. Si le suivi vient d&apos;être configuré, les premiers chiffres arrivent après quelques minutes de visites.
          </div>
        )}

        <div className="an-kpis">
          <section className="ad-card an-kpi" aria-label="Visiteurs">
            <span className="lbl dim">Visiteurs</span>
            <div className="v">{nf.format(d.visiteurs)}</div>
            <p className="st-note">Personnes différentes (comptées par jour).</p>
          </section>
          <section className="ad-card an-kpi" aria-label="Pages vues">
            <span className="lbl dim">Pages vues</span>
            <div className="v">{nf.format(d.pagesVues)}</div>
            <p className="st-note">{d.visiteurs ? `${(d.pagesVues / d.visiteurs).toFixed(1).replace('.', ',')} pages par visiteur` : '—'}</p>
          </section>
          <section className="ad-card an-kpi" aria-label="Réservations en ligne">
            <span className="lbl dim">Réservations en ligne</span>
            <div className="v">{nf.format(d.reservations)}</div>
            <p className="st-note">Confirmées depuis le site.</p>
          </section>
          <section className="ad-card an-kpi" aria-label="Conversion">
            <span className="lbl dim">Conversion</span>
            <div className="v">{pct(d.conversion)}</div>
            <p className="st-note">Visiteurs qui réservent.</p>
          </section>
        </div>

        <section className="st-sec" aria-labelledby="an-serie">
          <h2 id="an-serie">Visiteurs par jour</h2>
          <div className="ad-card an-box">
            <Courbe serie={d.serie} />
          </div>
        </section>

        <section className="st-sec" aria-labelledby="an-entonnoir">
          <h2 id="an-entonnoir">Parcours de réservation</h2>
          <div className="ad-card an-box">
            <ol className="an-funnel">
              {d.entonnoir.map((e, i) => {
                const precedent = i === 0 ? null : d.entonnoir[i - 1].personnes
                return (
                  <li key={e.etape}>
                    <div className="top">
                      <span className="nm">{e.etape}</span>
                      <span className="n">
                        {nf.format(e.personnes)}
                        <small>{pct(e.personnes / hautEntonnoir)}</small>
                      </span>
                    </div>
                    <div className="track" aria-hidden="true">
                      <i style={{ width: `${(e.personnes / hautEntonnoir) * 100}%` }} />
                    </div>
                    {precedent !== null && precedent > e.personnes && <p className="perte">{nf.format(precedent - e.personnes)} s&apos;arrêtent avant cette étape</p>}
                  </li>
                )
              })}
            </ol>
          </div>
        </section>

        <div className="an-cols">
          <section className="st-sec" aria-labelledby="an-pages">
            <h2 id="an-pages">Pages les plus vues</h2>
            <div className="ad-card an-box">
              <Classement vide="Aucune page vue." lignes={d.pages.map((p) => ({ nom: LIBELLES_PAGES[p.page] ?? p.page, valeur: p.vues }))} />
            </div>
          </section>
          <section className="st-sec" aria-labelledby="an-clics">
            <h2 id="an-clics">Boutons les plus utilisés</h2>
            <div className="ad-card an-box">
              <Classement vide="Aucun clic enregistré." lignes={d.clics.map((c) => ({ nom: LIBELLES_CLICS[c.cible] ?? c.cible, valeur: c.clics }))} />
            </div>
          </section>
          <section className="st-sec" aria-labelledby="an-sources">
            <h2 id="an-sources">D&apos;où viennent les visiteurs</h2>
            <div className="ad-card an-box">
              <Classement vide="Aucune donnée." lignes={d.sources.map((s) => ({ nom: s.source === '$direct' ? 'Accès direct' : s.source, valeur: s.visiteurs }))} />
            </div>
          </section>
          <section className="st-sec" aria-labelledby="an-appareils">
            <h2 id="an-appareils">Appareils</h2>
            <div className="ad-card an-box">
              <Classement vide="Aucune donnée." lignes={d.appareils.map((a) => ({ nom: a.appareil, valeur: a.visiteurs }))} />
            </div>
          </section>
          <section className="st-sec" aria-labelledby="an-pays">
            <h2 id="an-pays">Pays</h2>
            <div className="ad-card an-box">
              <Classement vide="Aucune donnée." lignes={d.pays.map((p) => ({ nom: p.pays, valeur: p.visiteurs }))} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

/** Affiché tant que PostHog n'est pas relié au back-office. */
export function AnalytiqueNonConfigure() {
  return (
    <div>
      <AdminPageHead section="Analytique" titre={TITRE} description="Les visites du site public et le parcours de réservation." />
      <div className="ad-body">
        <div className="ad-card an-box">
          <h2 style={{ margin: '0 0 12px', font: '600 16px/1.3 var(--a-sans)' }}>PostHog n&apos;est pas encore relié</h2>
          <p className="st-note" style={{ maxWidth: '62ch', marginTop: 0 }}>
            Pour afficher les chiffres ici, ajoutez ces deux variables d&apos;environnement dans Vercel (Settings, Environment Variables), puis redéployez :
          </p>
          <ul className="an-vars">
            <li>
              <code>POSTHOG_PERSONAL_API_KEY</code> : clé d&apos;API personnelle (permission « Query read »)
            </li>
            <li>
              <code>POSTHOG_PROJECT_ID</code> : numéro du projet PostHog
            </li>
          </ul>
          <p className="st-note" style={{ maxWidth: '62ch' }}>
            Le suivi des visites lui-même demande aussi <code>NEXT_PUBLIC_POSTHOG_KEY</code>. Le pas-à-pas complet est dans le README, rubrique « Analytique (PostHog) ».
          </p>
        </div>
      </div>
    </div>
  )
}
