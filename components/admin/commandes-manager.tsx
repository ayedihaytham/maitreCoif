'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, Check, Loader2, Mail, PackageCheck, Phone, X } from 'lucide-react'

import type { CommandeAdmin } from '@/lib/boutique-admin'
import { cn, formatPrix } from '@/lib/utils'

type Filtre = 'toutes' | 'A_PREPARER' | 'PRETE' | 'RETIREE' | 'FINIES'

const FILTRES: { id: Filtre; libelle: string }[] = [
  { id: 'toutes', libelle: 'Toutes' },
  { id: 'A_PREPARER', libelle: 'À préparer' },
  { id: 'PRETE', libelle: 'Prêtes' },
  { id: 'RETIREE', libelle: 'Retirées' },
  { id: 'FINIES', libelle: 'Annulées' },
]

const STATUTS: Record<CommandeAdmin['statut'], { libelle: string; tag: string }> = {
  A_PREPARER: { libelle: 'À préparer', tag: '' },
  PRETE: { libelle: 'Prête à retirer', tag: 'green' },
  RETIREE: { libelle: 'Retirée', tag: 'mut' },
  ANNULEE: { libelle: 'Annulée', tag: 'red' },
  EXPIREE: { libelle: 'Expirée', tag: 'red' },
}

const jourCourt = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Tunis' })

const jourRdv = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

export function CommandesManager({ initial }: { initial: CommandeAdmin[] }) {
  const [commandes, setCommandes] = useState(initial)
  const [filtre, setFiltre] = useState<Filtre>('toutes')
  const [enCours, setEnCours] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const visibles = useMemo(
    () =>
      commandes.filter((c) => {
        if (filtre === 'toutes') return true
        if (filtre === 'FINIES') return c.statut === 'ANNULEE' || c.statut === 'EXPIREE'
        return c.statut === filtre
      }),
    [commandes, filtre],
  )

  const stats = useMemo(() => {
    const il_y_a_30_jours = Date.now() - 30 * 24 * 3600 * 1000
    const retirees = commandes.filter((c) => c.statut === 'RETIREE' && new Date(c.dateCreation).getTime() > il_y_a_30_jours)
    return {
      aPreparer: commandes.filter((c) => c.statut === 'A_PREPARER').length,
      pretes: commandes.filter((c) => c.statut === 'PRETE').length,
      retirees: retirees.length,
      ventes: retirees.reduce((s, c) => s + c.total, 0),
    }
  }, [commandes])

  async function changer(c: CommandeAdmin, statut: 'PRETE' | 'RETIREE' | 'ANNULEE') {
    setMessage(null)
    if (statut === 'ANNULEE' && !confirm(`Annuler la réservation ${c.code} de ${c.clientNom} ? Le stock est remis en vente et le client est prévenu par email.`)) return
    setEnCours(c.id)
    try {
      const res = await fetch(`/api/admin/commandes/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statut }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setMessage(data.error ?? 'Impossible de modifier cette réservation.')
      setCommandes((prev) => prev.map((x) => (x.id === c.id ? data.commande : x)))
      setMessage(
        statut === 'PRETE'
          ? `La réservation ${c.code} est prête : ${c.clientNom} a été prévenu par email.`
          : statut === 'ANNULEE'
            ? `La réservation ${c.code} est annulée : le stock est remis en vente et ${c.clientNom} a été prévenu par email.`
            : `La réservation ${c.code} a été retirée.`,
      )
    } finally {
      setEnCours(null)
    }
  }

  return (
    <div>
      <div className="bo-kpis four">
        <section className="ad-card bo-kpi" aria-label="À préparer">
          <span className="lbl dim">À préparer</span>
          <b className={stats.aPreparer ? 'warn' : ''}>{stats.aPreparer}</b>
        </section>
        <section className="ad-card bo-kpi" aria-label="Prêtes à retirer">
          <span className="lbl dim">Prêtes à retirer</span>
          <b>{stats.pretes}</b>
        </section>
        <section className="ad-card bo-kpi" aria-label="Retirées sur 30 jours">
          <span className="lbl dim">Retirées · 30 jours</span>
          <b>{stats.retirees}</b>
        </section>
        <section className="ad-card bo-kpi" aria-label="Ventes de produits sur 30 jours">
          <span className="lbl dim">Ventes · 30 jours</span>
          <b className="money">{formatPrix(stats.ventes)}</b>
        </section>
      </div>

      <div className="bo-tools">
        <div className="ad-seg" role="group" aria-label="Filtrer par statut">
          {FILTRES.map((f) => (
            <button key={f.id} type="button" className={filtre === f.id ? 'on' : ''} aria-pressed={filtre === f.id} onClick={() => setFiltre(f.id)}>
              {f.libelle}
            </button>
          ))}
        </div>
        <p className="bo-hint">Sans retrait sous 7 jours, une réservation expire : le stock est remis en vente et le client en est informé.</p>
      </div>

      {message && (
        <p role="status" className="ad-note">
          {message}
        </p>
      )}

      <div className="ad-list">
        {visibles.map((c) => {
          const s = STATUTS[c.statut]
          const active = c.statut === 'A_PREPARER' || c.statut === 'PRETE'
          return (
            <article key={c.id} className={cn('ad-card bo-cmd', !active && 'off')}>
              <div className="bo-cmd-who">
                <div className="lbl">{c.code}</div>
                <b>{c.clientNom}</b>
                <a href={`tel:${c.clientTelephone.replace(/\s/g, '')}`}>
                  <Phone aria-hidden="true" /> {c.clientTelephone}
                </a>
                <a href={`mailto:${c.clientEmail}`}>
                  <Mail aria-hidden="true" /> {c.clientEmail}
                </a>
              </div>

              <div className="bo-cmd-art">
                <ul>
                  {c.lignes.map((l, i) => (
                    <li key={i}>
                      <span>
                        {l.type === 'PACK' ? <em>Pack · </em> : null}
                        {l.nom}
                        {l.quantite > 1 ? ` ×${l.quantite}` : ''}
                      </span>
                      {l.type === 'PACK' && l.contenu.length > 0 && (
                        <small>
                          {l.contenu.map((e) => `${e.nom}${e.quantite > 1 ? ` ×${e.quantite}` : ''}${e.type === 'service' ? ' (prestation)' : ''}`).join(' · ')}
                        </small>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="bo-cmd-meta">
                  {c.retrait === 'RDV' ? 'Avec son prochain rendez-vous' : c.jourSouhaite ? `Passage souhaité : ${c.jourSouhaite}` : 'Passage au salon'}
                  {c.notes ? ` · « ${c.notes} »` : ''}
                  {active ? ` · à retirer avant le ${jourCourt(c.expireLe)}` : ''}
                </div>
                {c.rendezVous && (
                  <div className="bo-cmd-rdv">
                    <CalendarClock aria-hidden="true" /> Rendez-vous {c.rendezVous.statut === 'ANNULE' ? 'annulé' : 'le'} {jourRdv(c.rendezVous.date)} à {c.rendezVous.heureDebut} · {c.rendezVous.coiffeur}
                  </div>
                )}
              </div>

              <div className="bo-cmd-total">
                <b>{formatPrix(c.total)}</b>
                {c.economie > 0 && <small>dont {formatPrix(c.economie)} de remise</small>}
                <span className={cn('ad-tag', s.tag)}>{s.libelle}</span>
              </div>

              <div className="bo-cmd-actions">
                {enCours === c.id && <Loader2 className="size-4 animate-spin" aria-label="Enregistrement…" />}
                {c.statut === 'A_PREPARER' && (
                  <button type="button" className="ad-btn gold sm" disabled={enCours === c.id} onClick={() => changer(c, 'PRETE')}>
                    <PackageCheck aria-hidden="true" /> Marquer prête
                  </button>
                )}
                {c.statut === 'PRETE' && (
                  <button type="button" className="ad-btn gold sm" disabled={enCours === c.id} onClick={() => changer(c, 'RETIREE')}>
                    <Check aria-hidden="true" /> Marquer retirée
                  </button>
                )}
                {c.statut === 'A_PREPARER' && (
                  <button type="button" className="ad-btn line sm" disabled={enCours === c.id} onClick={() => changer(c, 'RETIREE')}>
                    <Check aria-hidden="true" /> Retirée
                  </button>
                )}
                {active && (
                  <button type="button" className="ad-btn danger sm" disabled={enCours === c.id} onClick={() => changer(c, 'ANNULEE')}>
                    <X aria-hidden="true" /> Annuler
                  </button>
                )}
              </div>
            </article>
          )
        })}
        {visibles.length === 0 && <p className="ad-empty">{commandes.length === 0 ? 'Aucune réservation de produits pour le moment.' : 'Aucune réservation dans cette catégorie.'}</p>}
      </div>
    </div>
  )
}
