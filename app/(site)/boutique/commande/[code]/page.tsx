import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Check } from 'lucide-react'

import { AnnulerCommande } from '@/components/boutique/commande-actions'
import { INCLURE_COMMANDE, lireDetail } from '@/lib/boutique'
import { CODE_COMMANDE_VALIDE } from '@/lib/liens'
import { prisma } from '@/lib/prisma'
import { formatPrix } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Ma réservation',
  robots: { index: false, follow: false },
}

// Toujours à jour : le statut change quand le salon prépare la commande.
export const dynamic = 'force-dynamic'

const STATUTS = {
  A_PREPARER: { libelle: 'En préparation', classe: '', titre: 'C’est réservé.' },
  PRETE: { libelle: 'Prête à retirer', classe: '', titre: 'C’est prêt.' },
  RETIREE: { libelle: 'Retirée', classe: 'ter', titre: 'Merci.' },
  ANNULEE: { libelle: 'Annulée', classe: 'ann', titre: 'Annulée.' },
  EXPIREE: { libelle: 'Expirée', classe: 'ann', titre: 'Expirée.' },
} as const

const jourLong = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Tunis' })

/** « s***@exemple.com » : l'adresse n'est pas montrée en entier à qui connaît seulement le code. */
function masquerEmail(email: string) {
  const [local, domaine] = email.split('@')
  return `${local.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(5, local.length - 1)))}@${domaine}`
}

export default async function CommandePage({ params }: { params: Promise<{ code: string }> }) {
  const code = decodeURIComponent((await params).code).trim().toUpperCase()
  if (!CODE_COMMANDE_VALIDE.test(code)) notFound()

  const commande = await prisma.commande.findUnique({ where: { code }, include: INCLURE_COMMANDE })
  if (!commande) notFound()

  const statut = STATUTS[commande.statut]
  const active = commande.statut === 'A_PREPARER' || commande.statut === 'PRETE'
  const rdv = commande.rendezVous
  const rdvJour = rdv ? new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(rdv.date) : ''
  const prestations = commande.lignes.flatMap((l) => (l.type === 'PACK' ? lireDetail(l.detail).filter((e) => e.type === 'service').map((e) => e.nom) : []))

  return (
    <main>
      <div className="wrap page-head sec">
        <div className="done-h" style={{ marginTop: 0 }}>
          <div className="lbl">Réservation {code}</div>
          <h1 className="page-h1">
            {commande.statut === 'A_PREPARER' ? (
              <>
                C’est <em>réservé.</em>
              </>
            ) : (
              <em>{statut.titre}</em>
            )}
          </h1>
          <p className="lead" style={{ margin: '20px auto 0', maxWidth: 640 }}>
            {commande.statut === 'A_PREPARER' && `Merci ${commande.clientNom.split(' ')[0]}. Vos articles sont mis de côté jusqu’au ${jourLong(commande.expireLe)}. Un email de confirmation est parti vers ${masquerEmail(commande.clientEmail)} ; nous vous écrivons dès que tout est prêt.`}
            {commande.statut === 'PRETE' && `Vos articles vous attendent au salon : passez les retirer avant le ${jourLong(commande.expireLe)} et réglez sur place.`}
            {commande.statut === 'RETIREE' && 'Cette réservation a été retirée au salon. Merci de votre confiance.'}
            {commande.statut === 'ANNULEE' && 'Cette réservation est annulée : les articles ont été remis en vente. Vous pouvez en faire une nouvelle à tout moment.'}
            {commande.statut === 'EXPIREE' && 'Les articles n’ont pas été retirés à temps : ils ont été remis en vente. Vous pouvez réserver de nouveau à tout moment.'}
          </p>
        </div>

        <div className="hz">
          <div className="hz-main">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
              <span className={`badge ${statut.classe}`}>{statut.libelle}</span>
              {active && <span style={{ fontSize: 13, color: 'var(--mc-muted)' }}>À retirer avant le {jourLong(commande.expireLe)}</span>}
            </div>

            <ul className="bq-recap">
              {commande.lignes.map((l) => {
                const contenu = l.type === 'PACK' ? lireDetail(l.detail) : []
                return (
                  <li key={l.id}>
                    <div>
                      <b>
                        {l.type === 'PACK' ? 'Pack · ' : ''}
                        {l.nom}
                        {l.quantite > 1 ? ` ×${l.quantite}` : ''}
                      </b>
                      {contenu.length > 0 && (
                        <small>
                          {contenu.map((e) => `${e.nom}${e.quantite > 1 ? ` ×${e.quantite}` : ''}${e.type === 'service' ? ' (prestation)' : ''}`).join(' · ')}
                        </small>
                      )}
                    </div>
                    <span>{formatPrix(Number(l.prixUnitaire) * l.quantite)}</span>
                  </li>
                )
              })}
              {Number(commande.economie) > 0 && (
                <li className="econ">
                  <div>
                    <b>Vous économisez</b>
                  </div>
                  <span>{formatPrix(Number(commande.economie))}</span>
                </li>
              )}
              <li className="total">
                <div>
                  <b>Total à régler au salon</b>
                </div>
                <span>{formatPrix(Number(commande.total))}</span>
              </li>
            </ul>

            {rdv && (
              <div className="bq-rdv">
                <div className="lbl">Votre rendez-vous</div>
                <p>
                  {rdvJour} à {rdv.heureDebut}
                </p>
                <small>
                  avec {rdv.coiffeur.prenom} {rdv.coiffeur.nom} ·{' '}
                  {rdv.statut === 'ANNULE' ? (
                    'annulé'
                  ) : (
                    <Link href={`/suivi?code=${encodeURIComponent(rdv.codeSuivi)}`} style={{ color: 'var(--mc-gold-ink)', textDecoration: 'underline' }}>
                      suivre mon rendez-vous
                    </Link>
                  )}
                </small>
              </div>
            )}

            <div className="kv">
              <div>
                <div className="lbl dim" style={{ fontSize: 10.5 }}>
                  Retrait
                </div>
                <p style={{ fontSize: 24 }}>{commande.retrait === 'RDV' ? 'Avec mon rendez-vous' : 'Au salon'}</p>
              </div>
              {commande.jourSouhaite && (
                <div>
                  <div className="lbl dim" style={{ fontSize: 10.5 }}>
                    Jour souhaité
                  </div>
                  <p style={{ fontSize: 24 }}>{commande.jourSouhaite}</p>
                </div>
              )}
            </div>
            <p style={{ margin: '26px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--mc-muted)' }}>Maitre Coif · Route Afran Km 5, Sfax · Mardi — Samedi, 10h00 — 20h30.</p>
          </div>
          <div className="hz-cut" />
          <div className="hz-stub">
            <div className="lbl dim" style={{ fontSize: 10.5 }}>
              Code de réservation
            </div>
            <div className="code">{commande.code}</div>
            <div className="qr-tile">
              {/* eslint-disable-next-line @next/next/no-img-element -- image générée par /api/qr, déjà optimisée */}
              <img src={`/api/qr/${encodeURIComponent(commande.code)}`} width={168} height={168} alt={`QR code de la réservation ${commande.code}`} />
            </div>
            <p className="qr-hint">Présentez ce code au salon pour retirer vos articles</p>
          </div>
        </div>

        {active && (
          <section className="notice bq-etapes" style={{ maxWidth: 1000, margin: '28px auto 0' }}>
            <Check className="size-4" aria-hidden="true" />
            <div>
              <b style={{ color: 'var(--mc-ivory)' }}>Et maintenant ?</b>
              <ol>
                <li>Nous préparons votre commande et vous écrivons dès qu’elle est prête.</li>
                <li>Passez au salon avec votre code ou ce QR code, avant le {jourLong(commande.expireLe)}.</li>
                <li>Réglez sur place, en espèces ou par carte.</li>
                {rdv && rdv.statut !== 'ANNULE' && <li>Votre rendez-vous est confirmé : retrouvez vos produits ce jour-là.</li>}
                {!rdv && prestations.length > 0 && (
                  <li>
                    Votre pack comprend une prestation ({prestations.join(', ')}) :{' '}
                    <Link href="/reservation" style={{ color: 'var(--mc-gold-ink)', textDecoration: 'underline' }}>
                      choisissez votre créneau
                    </Link>
                    .
                  </li>
                )}
              </ol>
            </div>
          </section>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', gap: 16, marginTop: 40 }}>
          <Link className="btn btn-gold" href="/boutique">
            Retour à la boutique
          </Link>
          {active && <AnnulerCommande code={commande.code} />}
        </div>
      </div>
    </main>
  )
}
