'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, PencilLine, Search, X } from 'lucide-react'

import { MESSAGE_ANTI_ROBOT, useAntiRobot } from '@/components/reservation/turnstile'
import { etatRendezVous } from '@/lib/compte-a-rebours'
import { cn, formatPrix } from '@/lib/utils'

interface RendezVousSuivi {
  id: string
  codeSuivi: string
  statut: 'EN_ATTENTE' | 'CONFIRME' | 'TERMINE' | 'ANNULE'
  date: string
  heureDebut: string
  heureFin: string
  notes: string | null
  demandeEnCours: string | null
  coiffeur: string
  service: string
  prestations?: string[]
  prix: number
  duree: number
}

const STATUT_LABEL: Record<RendezVousSuivi['statut'], string> = {
  EN_ATTENTE: 'En attente de confirmation',
  CONFIRME: 'Confirmé',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
}

const STATUT_CLASSE: Record<RendezVousSuivi['statut'], string> = {
  EN_ATTENTE: 'att',
  CONFIRME: '',
  TERMINE: 'ter',
  ANNULE: 'ann',
}

function dateLongue(date: string) {
  const iso = date.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return date
  const t = new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

const deux = (n: number) => String(n).padStart(2, '0')

/** Temps restant avant le rendez-vous, mis à jour chaque seconde. */
function CompteARebours({ date, debut, fin }: { date: string; debut: string; fin: string }) {
  const [maintenant, setMaintenant] = useState<Date | null>(null)

  useEffect(() => {
    setMaintenant(new Date())
    const t = window.setInterval(() => setMaintenant(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  if (!maintenant) return null
  const e = etatRendezVous(date.slice(0, 10), debut, fin, maintenant)

  if (e.etat !== 'avant') {
    return (
      <div className="cd cd-msg" role="status">
        {e.etat === 'en_cours' ? 'Votre rendez-vous est en cours.' : 'Ce rendez-vous est passé.'}
      </div>
    )
  }

  const { jours, heures, minutes, secondes } = e.reste
  const cases = [
    { v: jours, l: jours > 1 ? 'jours' : 'jour' },
    { v: heures, l: 'heures' },
    { v: minutes, l: 'min' },
    { v: secondes, l: 'sec' },
  ]
  const texte = `${jours > 0 ? `${jours} j ` : ''}${heures} h ${minutes} min`
  return (
    <div className="cd" role="timer" aria-label={`Temps restant avant votre rendez-vous : ${texte}`}>
      <div className="lbl dim" style={{ fontSize: 10.5 }}>
        Temps restant
      </div>
      <div className="cd-cells" aria-hidden="true">
        {cases.map((c) => (
          <div key={c.l} className="cd-cell">
            <b>{deux(c.v)}</b>
            <span>{c.l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SuiviLookup({ initialCode = '' }: { initialCode?: string }) {
  const [codeSuivi, setCodeSuivi] = useState(initialCode)
  // Un jeton anti-robot par action sensible (annuler, demander une modification).
  const robotAnnulation = useAntiRobot()
  const robotModification = useAntiRobot()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<RendezVousSuivi[] | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  const [modifyingId, setModifyingId] = useState<string | null>(null)
  const [modifyMessage, setModifyMessage] = useState('')
  const [submittingModifyId, setSubmittingModifyId] = useState<string | null>(null)

  async function search(code: string) {
    setError(null)
    setResults(null)
    setLoading(true)
    try {
      const params = new URLSearchParams({ codeSuivi: code })
      const res = await fetch(`/api/rendez-vous/suivi?${params}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Une erreur est survenue.')
        return
      }
      if (data.length === 0) setError('Aucune réservation trouvée avec ces informations.')
      setResults(data)
    } catch {
      setError('Impossible de contacter le serveur.')
    } finally {
      setLoading(false)
    }
  }

  // Arrivée depuis l'écran de confirmation : /suivi?code=MC-XXXXXX lance la recherche.
  const dejaLance = useRef(false)
  useEffect(() => {
    if (initialCode && !dejaLance.current) {
      dejaLance.current = true
      search(initialCode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    search(codeSuivi)
  }

  async function handleCancel(rdv: RendezVousSuivi) {
    setError(null)
    if (robotAnnulation.manquant) {
      setError(MESSAGE_ANTI_ROBOT)
      return
    }
    setCancellingId(rdv.id)
    try {
      const res = await fetch('/api/rendez-vous/suivi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rdv.id, codeSuivi: rdv.codeSuivi, turnstileToken: robotAnnulation.token }),
      })
      robotAnnulation.renouveler()
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Impossible d'annuler ce rendez-vous.")
        return
      }
      setResults((prev) => prev?.map((r) => (r.id === rdv.id ? { ...r, statut: 'ANNULE' } : r)) ?? null)
      setConfirmCancelId(null)
    } catch {
      setError('Impossible de contacter le serveur.')
    } finally {
      setCancellingId(null)
    }
  }

  async function handleModificationRequest(rdv: RendezVousSuivi) {
    if (modifyMessage.trim().length < 5) {
      setError('Merci de préciser votre demande (5 caractères minimum).')
      return
    }
    if (robotModification.manquant) {
      setError(MESSAGE_ANTI_ROBOT)
      return
    }
    setSubmittingModifyId(rdv.id)
    setError(null)
    try {
      const res = await fetch('/api/rendez-vous/modification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rdv.id, codeSuivi: rdv.codeSuivi, message: modifyMessage, turnstileToken: robotModification.token }),
      })
      robotModification.renouveler()
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Impossible d'envoyer cette demande.")
        return
      }
      setResults((prev) => prev?.map((r) => (r.id === rdv.id ? { ...r, demandeEnCours: modifyMessage.trim() } : r)) ?? null)
      setModifyingId(null)
      setModifyMessage('')
    } catch {
      setError('Impossible de contacter le serveur.')
    } finally {
      setSubmittingModifyId(null)
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} className={cn('suivi-form scanner', loading && 'busy')} noValidate>
        <i className="scan-line" aria-hidden="true" />
        <label className="fld">
          <span>Code de suivi</span>
          <div className="suivi-row">
            <input
              className="inp"
              placeholder="MC-XXXXXXX"
              value={codeSuivi}
              onChange={(e) => setCodeSuivi(e.target.value)}
              autoComplete="off"
              required
            />
            <button type="submit" className="btn btn-gold" disabled={loading || !codeSuivi.trim()}>
              {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Search className="size-4" aria-hidden="true" />}
              Rechercher
            </button>
          </div>
        </label>
        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}
      </form>

      {results && results.length > 0 && (
        <div>
          {results.map((rdv) => {
            const actif = rdv.statut === 'EN_ATTENTE' || rdv.statut === 'CONFIRME'
            return (
              <article key={rdv.id} className="res">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <span className="lbl">Code {rdv.codeSuivi}</span>
                  <span className={cn('badge', STATUT_CLASSE[rdv.statut])}>{STATUT_LABEL[rdv.statut]}</span>
                </div>
                <h3>
                  {rdv.prestations && rdv.prestations.length > 1 ? 'Votre rendez-vous' : rdv.service} avec {rdv.coiffeur}
                </h3>
                {rdv.prestations && rdv.prestations.length > 1 && (
                  <ul className="prestas">
                    {rdv.prestations.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
                <div style={{ marginTop: 8, fontSize: 13.5, color: 'var(--mc-muted)' }}>
                  {rdv.duree} min · {formatPrix(rdv.prix)}
                </div>
                <div className="kv">
                  <div>
                    <div className="lbl dim" style={{ fontSize: 10.5 }}>
                      Date
                    </div>
                    <p>{dateLongue(rdv.date)}</p>
                  </div>
                  <div>
                    <div className="lbl dim" style={{ fontSize: 10.5 }}>
                      Heure
                    </div>
                    <p style={{ color: 'var(--mc-gold-ink)' }}>
                      {rdv.heureDebut} — {rdv.heureFin}
                    </p>
                  </div>
                </div>
                {actif && <CompteARebours date={rdv.date} debut={rdv.heureDebut} fin={rdv.heureFin} />}
                {rdv.notes && <p className="note">« {rdv.notes} »</p>}

                {actif && (
                  <div>
                    <div className="act">
                      {confirmCancelId === rdv.id ? (
                        <>
                          {robotAnnulation.widget && <div style={{ flexBasis: '100%' }}>{robotAnnulation.widget}</div>}
                          <span className="hint" style={{ margin: '0 12px 0 0', alignSelf: 'center' }}>
                            Annuler définitivement ce rendez-vous ?
                          </span>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => handleCancel(rdv)} disabled={cancellingId === rdv.id}>
                            {cancellingId === rdv.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <X className="size-3.5" aria-hidden="true" />}
                            Oui, annuler
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmCancelId(null)}>
                            Non, le garder
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmCancelId(rdv.id)}>
                            <X className="size-3.5" aria-hidden="true" /> Annuler ce rendez-vous
                          </button>
                          {!rdv.demandeEnCours && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                setModifyingId(modifyingId === rdv.id ? null : rdv.id)
                                setModifyMessage('')
                                setError(null)
                              }}
                            >
                              <PencilLine className="size-3.5" aria-hidden="true" /> Demander une modification
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {rdv.demandeEnCours && (
                      <p className="okmsg" style={{ display: 'flex', gap: 10 }}>
                        <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span>
                          Votre demande de modification est transmise au salon, qui reviendra vers vous. En attendant, votre
                          rendez-vous reste confirmé à l&apos;horaire initial : « {rdv.demandeEnCours} »
                        </span>
                      </p>
                    )}

                    {modifyingId === rdv.id && (
                      <div style={{ marginTop: 24 }}>
                        <label className="fld">
                          <span>Votre demande</span>
                          <textarea
                            className="inp"
                            placeholder="Ex. Pourriez-vous décaler mon rendez-vous à 15h ?"
                            value={modifyMessage}
                            onChange={(e) => setModifyMessage(e.target.value)}
                            rows={3}
                          />
                        </label>
                        <p className="hint" style={{ margin: '-8px 0 16px' }}>
                          Votre rendez-vous reste confirmé tant que le salon ne l&apos;a pas déplacé.
                        </p>
                        {robotModification.widget && <div style={{ marginBottom: 14 }}>{robotModification.widget}</div>}
                        <button
                          type="button"
                          className="btn btn-gold btn-sm"
                          onClick={() => handleModificationRequest(rdv)}
                          disabled={submittingModifyId === rdv.id}
                        >
                          {submittingModifyId === rdv.id && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                          Envoyer la demande
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
