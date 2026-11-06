'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

import { PortraitRond } from '@/components/site/portrait'
import { TurnstileWidget } from '@/components/reservation/turnstile'
import { suivre } from '@/lib/analytics'
import { cn, formatPrix } from '@/lib/utils'
import type { Portrait } from '@/lib/portraits'

interface Coiffeur {
  id: string
  nom: string
  prenom: string
  specialites: string[]
  role: string
  portrait: Portrait
}

interface Service {
  id: string
  nom: string
  description: string | null
  prix: number
  duree: number
  categorie: string | null
}

interface CreneauGrille {
  heure: string
  libre: boolean
}

type EtatJour = 'libre' | 'complet' | 'ferme'

const MAX_PRESTATIONS = 5 // aligné sur lib/prestations.ts
const STEPS = ['Coiffeur', 'Prestations', 'Créneau', 'Coordonnées'] as const
// Noms des étapes envoyés au suivi d'audience (entonnoir de réservation du back-office).
const ETAPES_SUIVI = ['coiffeur', 'prestations', 'creneau', 'coordonnees'] as const
const JOURS_PROPOSES = 21
const JOURS_PAR_PAGE = 7
const JOURS_COURTS = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM']
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const PERIODES: [string, number, number][] = [
  ['Matin', 0, 720],
  ['Après-midi', 720, 1020],
  ['Soir', 1020, 1440],
]

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
const enMinutes = (heure: string) => {
  const [h, m] = heure.split(':').map(Number)
  return h * 60 + m
}
const ajouterMinutes = (heure: string, minutes: number) => {
  const t = enMinutes(heure) + minutes
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`
}

function jourApres(todayISO: string, decalage: number) {
  const d = new Date(`${todayISO}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + decalage)
  return d
}

function dateLongue(iso: string) {
  const t = new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function ReservationWizard({
  coiffeurs,
  services,
  preselectedCoiffeurId,
  preselectedServiceId,
  todayISO,
}: {
  coiffeurs: Coiffeur[]
  services: Service[]
  preselectedCoiffeurId?: string
  preselectedServiceId?: string
  /** Jour courant dans le fuseau du salon (calculé côté serveur). */
  todayISO: string
}) {
  const coiffeurInitial = coiffeurs.some((c) => c.id === preselectedCoiffeurId) ? preselectedCoiffeurId! : ''
  const serviceInitial = services.some((s) => s.id === preselectedServiceId) ? [preselectedServiceId!] : []

  // On démarre à la première étape dont la réponse manque.
  const [step, setStep] = useState(!coiffeurInitial ? 0 : serviceInitial.length === 0 ? 1 : 2)
  const [coiffeurId, setCoiffeurId] = useState(coiffeurInitial)
  const [serviceIds, setServiceIds] = useState<string[]>(serviceInitial)
  // Les appels d'API reçoivent les prestations séparées par des virgules.
  const serviceId = serviceIds.join(',')
  const [date, setDate] = useState('')
  const [heureDebut, setHeureDebut] = useState('')
  const [page, setPage] = useState(0)

  const [etats, setEtats] = useState<Record<string, EtatJour>>({})
  const [loadingJours, setLoadingJours] = useState(false)
  const [grille, setGrille] = useState<CreneauGrille[]>([])
  const [loadingGrille, setLoadingGrille] = useState(false)

  const [clientNom, setClientNom] = useState('')
  const [clientTelephone, setClientTelephone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileKey, setTurnstileKey] = useState(0) // un jeton Turnstile est à usage unique

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<{ codeSuivi: string } | null>(null)

  const coiffeur = coiffeurs.find((c) => c.id === coiffeurId)
  // « service » regroupe les prestations choisies : libellé, durée et prix cumulés.
  const choisies = serviceIds.map((id) => services.find((s) => s.id === id)).filter((s): s is Service => Boolean(s))
  const service =
    choisies.length > 0
      ? { nom: choisies.map((s) => s.nom).join(' + '), duree: choisies.reduce((t, s) => t + s.duree, 0), prix: choisies.reduce((t, s) => t + s.prix, 0) }
      : undefined
  const heureFin = service && heureDebut ? ajouterMinutes(heureDebut, service.duree) : ''

  const jours = useMemo(
    () =>
      Array.from({ length: JOURS_PROPOSES }, (_, i) => {
        const d = jourApres(todayISO, i)
        return {
          iso: d.toISOString().slice(0, 10),
          dow: JOURS_COURTS[d.getUTCDay()],
          num: d.getUTCDate(),
          mois: MOIS_COURTS[d.getUTCMonth()],
        }
      }),
    [todayISO],
  )

  // État (libre / complet / fermé) des prochains jours pour ce coiffeur et ce service.
  // Entonnoir : une étape est comptée quand le visiteur l'atteint (l'étape « coiffeur » est la page elle-même).
  useEffect(() => {
    if (step > 0) suivre('reservation_etape', { etape: ETAPES_SUIVI[step] })
  }, [step])

  useEffect(() => {
    if (!coiffeurId || !serviceId) {
      setEtats({})
      return
    }
    const controller = new AbortController()
    setLoadingJours(true)
    const params = new URLSearchParams({ coiffeurId, serviceId, from: todayISO, count: String(JOURS_PROPOSES) })
    fetch(`/api/disponibilites/jours?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data: { jours?: { date: string; etat: EtatJour }[] }) => {
        const liste = data.jours ?? []
        setEtats(Object.fromEntries(liste.map((j) => [j.date, j.etat])))
        const premier = liste.findIndex((j) => j.etat === 'libre')
        setDate((actuelle) => (actuelle && liste.some((j) => j.date === actuelle && j.etat === 'libre') ? actuelle : (liste[premier]?.date ?? '')))
        if (premier >= 0) setPage(Math.floor(premier / JOURS_PAR_PAGE))
      })
      .catch(() => {})
      .finally(() => setLoadingJours(false))
    return () => controller.abort()
  }, [coiffeurId, serviceId, todayISO])

  // Créneaux du jour choisi (libres et occupés).
  useEffect(() => {
    if (!coiffeurId || !serviceId || !date) {
      setGrille([])
      return
    }
    setLoadingGrille(true)
    setHeureDebut('')
    const controller = new AbortController()
    const params = new URLSearchParams({ coiffeurId, serviceId, date })
    fetch(`/api/disponibilites?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data: { grille?: CreneauGrille[]; creneaux?: string[] }) =>
        setGrille(data.grille ?? (data.creneaux ?? []).map((heure) => ({ heure, libre: true }))),
      )
      .catch(() => {})
      .finally(() => setLoadingGrille(false))
    return () => controller.abort()
  }, [coiffeurId, serviceId, date])

  // Saisie d'un champ du formulaire : l'erreur de ce champ disparaît dès qu'on le corrige.
  function saisir(champ: 'clientNom' | 'clientTelephone' | 'clientEmail', setter: (valeur: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value)
      if (fieldErrors[champ]) setFieldErrors(({ [champ]: _ignore, ...reste }) => reste)
    }
  }

  function choisirCoiffeur(id: string) {
    if (id !== coiffeurId) {
      setCoiffeurId(id)
      setDate('')
      setHeureDebut('')
    }
    setStep(serviceIds.length > 0 ? 2 : 1)
  }

  function choisirService(id: string) {
    // Bascule : on peut cumuler jusqu'à MAX_PRESTATIONS prestations.
    setServiceIds((actuels) => (actuels.includes(id) ? actuels.filter((x) => x !== id) : actuels.length >= MAX_PRESTATIONS ? actuels : [...actuels, id]))
    setDate('')
    setHeureDebut('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setSubmitError(null)

    const errors: Record<string, string> = {}
    if (clientNom.trim().length < 2) errors.clientNom = 'Nom requis (2 caractères minimum)'
    if (clientTelephone.trim().length < 6) errors.clientTelephone = 'Numéro de téléphone invalide'
    if (clientEmail && !/^\S+@\S+\.\S+$/.test(clientEmail)) errors.clientEmail = 'Email invalide'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    // Anti-robot : le widget Cloudflare doit être validé avant d'envoyer (s'il est configuré).
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) {
      setSubmitError('Merci de valider la vérification anti-robot avant de confirmer.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/rendez-vous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coiffeurId,
          serviceIds,
          date,
          heureDebut,
          clientNom: clientNom.trim(),
          clientTelephone: clientTelephone.trim(),
          clientEmail: clientEmail.trim() || undefined,
          notes: notes.trim() || undefined,
          website,
          turnstileToken,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? 'Une erreur est survenue, merci de réessayer.')
        setTurnstileToken('')
        setTurnstileKey((k) => k + 1)
        return
      }
      setConfirmation({ codeSuivi: data.codeSuivi })
      suivre('reservation_confirmee', { prestations: serviceIds.length })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setSubmitError('Impossible de contacter le serveur, merci de réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  // ───────────── Confirmation : billet horizontal avec le code de suivi ─────────────
  if (confirmation && coiffeur && service) {
    return (
      <div>
        <div className="done-h">
          <div className="lbl">Rendez-vous confirmé</div>
          <h2 className="page-h1">
            C&apos;est <em>confirmé.</em>
          </h2>
          <p className="lead" style={{ margin: '20px auto 0', maxWidth: 620 }}>
            Votre rendez-vous est confirmé, aucune validation supplémentaire n&apos;est nécessaire. Conservez votre code
            de suivi ou scannez le QR code pour le consulter, l&apos;annuler ou demander une modification à tout moment.
          </p>
        </div>

        <div className="hz">
          <div className="hz-main">
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <PortraitRond portrait={coiffeur.portrait} nom={`${coiffeur.prenom} ${coiffeur.nom}`} taille={60} />
              <div>
                <div style={{ font: '400 34px/1.05 var(--mc-serif)' }}>
                  {coiffeur.prenom} {coiffeur.nom}
                </div>
                <div style={{ marginTop: 6, fontSize: 13.5, color: 'var(--mc-muted)' }}>
                  {service.nom} · {service.duree} min · {formatPrix(service.prix)}
                </div>
              </div>
            </div>
            <div className="kv">
              <div>
                <div className="lbl dim" style={{ fontSize: 10.5 }}>
                  Date
                </div>
                <p>{dateLongue(date)}</p>
              </div>
              <div>
                <div className="lbl dim" style={{ fontSize: 10.5 }}>
                  Heure
                </div>
                <p style={{ color: 'var(--mc-gold-ink)' }}>
                  {heureDebut} — {heureFin}
                </p>
              </div>
            </div>
            <p style={{ margin: '30px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--mc-muted)' }}>
              {clientEmail.trim()
                ? `Un email de confirmation est envoyé à ${clientEmail.trim()}.`
                : 'Aucun email renseigné : aucune notification ne sera envoyée, notez bien votre code.'}{' '}
              Route Afran Km 5, Sfax.
            </p>
          </div>
          <div className="hz-cut" />
          <div className="hz-stub">
            <div className="lbl dim" style={{ fontSize: 10.5 }}>
              Code de suivi
            </div>
            <div className="code">{confirmation.codeSuivi}</div>
            {/* QR code : mène directement au suivi de ce rendez-vous (statut, annulation, modification) */}
            <div className="qr-tile">
              {/* eslint-disable-next-line @next/next/no-img-element -- image générée par /api/qr, déjà optimisée */}
              <img
                src={`/api/qr/${encodeURIComponent(confirmation.codeSuivi)}`}
                width={168}
                height={168}
                alt={`QR code du rendez-vous ${confirmation.codeSuivi} : scannez-le pour suivre votre réservation`}
              />
            </div>
            <p className="qr-hint">Scannez pour suivre votre rendez-vous</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 40, flexWrap: 'wrap' }}>
          <Link className="btn btn-gold" href={`/suivi?code=${encodeURIComponent(confirmation.codeSuivi)}`}>
            Suivre ma réservation
          </Link>
          <Link className="btn btn-ghost" href="/">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    )
  }

  const pageJours = jours.slice(page * JOURS_PAR_PAGE, (page + 1) * JOURS_PAR_PAGE)
  const peutContinuer = step === 2 && Boolean(heureDebut)
  const actionMobile = step === 2 ? 'Continuer' : step === 3 ? 'Confirmer' : null
  const afficherBarre = (step === 2 && Boolean(coiffeur && service)) || step === 3

  return (
    <div className={cn(afficherBarre && 'has-mbar')}>
      <ol className="steps" aria-label="Étapes de la réservation">
        {STEPS.map((label, i) => {
          const etat = i < step ? 'done' : i === step ? 'cur' : ''
          return (
            <li key={label}>
              <button
                type="button"
                className={cn('stp', etat)}
                disabled={i >= step}
                aria-current={i === step ? 'step' : undefined}
                onClick={() => setStep(i)}
              >
                <span className="n">{i < step ? <Check className="size-4" aria-hidden="true" /> : i + 1}</span>
                <span className="t">{label}</span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="cols">
        <div>
          {/* ───────── 1 · Coiffeur ───────── */}
          {step === 0 && (
            <div>
              <h2 className="sec-t">
                <b>Choisissez votre coiffeur</b>
              </h2>
              <div className="choices">
                {coiffeurs.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={cn('choice', coiffeurId === c.id && 'sel')}
                    aria-pressed={coiffeurId === c.id}
                    onClick={() => choisirCoiffeur(c.id)}
                  >
                    <PortraitRond portrait={c.portrait} nom={`${c.prenom} ${c.nom}`} taille={64} />
                    <span className="ct">
                      <div className="nm">
                        {c.prenom} {c.nom}
                      </div>
                      <div className="sb">
                        {c.role}
                        {c.specialites.length > 0 && ` · ${c.specialites.join(', ')}`}
                      </div>
                    </span>
                    <ChevronRight className="size-5" style={{ color: 'var(--mc-gold-ink)' }} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ───────── 2 · Service ───────── */}
          {step === 1 && (
            <div>
              <h2 className="sec-t">
                <b>Choisissez vos prestations</b>
              </h2>
              <p className="hint" style={{ margin: '-6px 0 18px' }}>
                Vous pouvez en cumuler plusieurs (jusqu&apos;à {MAX_PRESTATIONS}) : la durée et le prix s&apos;additionnent.
              </p>
              <div className="choices">
                {services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={cn('choice', serviceIds.includes(s.id) && 'sel')}
                    aria-pressed={serviceIds.includes(s.id)}
                    onClick={() => choisirService(s.id)}
                  >
                    <span className="ct">
                      <div className="nm">{s.nom}</div>
                      <div className="sb">
                        {s.description ? `${s.description} · ` : ''}
                        {s.duree} min
                      </div>
                    </span>
                    <span className="pr">{formatPrix(s.prix)}</span>
                  </button>
                ))}
              </div>
              {service && (
                <div className="svc-total" aria-live="polite">
                  <span>
                    {choisies.length} prestation{choisies.length > 1 ? 's' : ''} · {service.duree} min
                  </span>
                  <strong>{formatPrix(service.prix)}</strong>
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-ghost btn-sm back" onClick={() => setStep(0)}>
                  <ChevronLeft className="size-4" aria-hidden="true" /> Retour
                </button>
                <button type="button" className="btn btn-gold" disabled={!service || !coiffeurId} onClick={() => setStep(2)}>
                  {coiffeurId ? 'Continuer' : 'Choisissez d’abord un coiffeur'}
                </button>
              </div>
            </div>
          )}

          {/* ───────── 3 · Créneau ───────── */}
          {step === 2 && coiffeur && service && (
            <div>
              <div className="recap">
                <div className="rc">
                  <PortraitRond portrait={coiffeur.portrait} nom={`${coiffeur.prenom} ${coiffeur.nom}`} taille={44} />
                  <span>
                    <small>Coiffeur</small>
                    {coiffeur.prenom} {coiffeur.nom}
                  </span>
                </div>
                <div className="rc">
                  <span>
                    <small>{choisies.length > 1 ? 'Prestations' : 'Service'}</small>
                    {service.nom} · {service.duree} min · {formatPrix(service.prix)}
                  </span>
                </div>
              </div>

              <div className="week" style={{ marginTop: 34 }}>
                <h2 className="sec-t" style={{ margin: 0 }}>
                  <b>Choisissez le jour</b>
                </h2>
                <div className="week-btns">
                  <button type="button" aria-label="Jours précédents" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Jours suivants"
                    disabled={(page + 1) * JOURS_PAR_PAGE >= JOURS_PROPOSES}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="days" role="group" aria-label="Jours disponibles">
                {pageJours.map((j) => {
                  const etat = etats[j.iso]
                  const inconnu = loadingJours || etat === undefined
                  return (
                    <button
                      key={j.iso}
                      type="button"
                      className={cn('day', date === j.iso && 'sel')}
                      aria-pressed={date === j.iso}
                      disabled={inconnu || etat !== 'libre'}
                      onClick={() => setDate(j.iso)}
                    >
                      <span className="dw">{j.dow}</span>
                      <span className="dn">{j.num}</span>
                      <span className="dm">{inconnu || etat === 'libre' ? j.mois : etat === 'complet' ? 'Complet' : 'Fermé'}</span>
                    </button>
                  )
                })}
              </div>

              {!loadingJours && Object.keys(etats).length > 0 && !date && (
                <p className="empty" style={{ marginTop: 26 }}>
                  Plus aucun créneau disponible dans les {JOURS_PROPOSES} prochains jours pour cette prestation.
                  <br />
                  Essayez un autre coiffeur ou contactez le salon.
                </p>
              )}

              {date && (
                <div>
                  <h2 className="sec-t" style={{ margin: '38px 0 0' }}>
                    <b>Choisissez l&apos;heure</b> · {dateLongue(date)}
                  </h2>

                  {loadingGrille ? (
                    <div className="loading">
                      <Loader2 className="size-4" aria-hidden="true" /> Chargement des créneaux…
                    </div>
                  ) : grille.length === 0 ? (
                    <p className="empty" style={{ marginTop: 20 }}>
                      Aucun créneau disponible ce jour-là.
                    </p>
                  ) : (
                    <>
                      {PERIODES.map(([nom, debut, fin]) => {
                        const items = grille.filter((c) => enMinutes(c.heure) >= debut && enMinutes(c.heure) < fin)
                        if (items.length === 0) return null
                        return (
                          <div key={nom}>
                            <div className="gt">{nom}</div>
                            <div className="slots" role="group" aria-label={`Créneaux : ${nom.toLowerCase()}`}>
                              {items.map((c) => (
                                <button
                                  key={c.heure}
                                  type="button"
                                  className={cn('slot', heureDebut === c.heure && 'sel')}
                                  aria-pressed={heureDebut === c.heure}
                                  disabled={!c.libre}
                                  onClick={() => setHeureDebut(c.heure)}
                                >
                                  {c.heure}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                      <div className="legend">
                        <span>
                          <i style={{ background: 'var(--mc-gold)', borderColor: 'var(--mc-gold)' }} />
                          Votre choix
                        </span>
                        <span>
                          <i style={{ borderStyle: 'dashed' }} />
                          Déjà réservé ou passé
                        </span>
                        <span>
                          <i style={{ background: 'var(--mc-panel2)' }} />
                          Disponible
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}

              <button type="button" className="btn btn-ghost btn-sm back" style={{ marginTop: 30 }} onClick={() => setStep(1)}>
                <ChevronLeft className="size-4" aria-hidden="true" /> Retour
              </button>
            </div>
          )}

          {/* ───────── 4 · Coordonnées ───────── */}
          {step === 3 && coiffeur && service && (
            <form id="coord-form" onSubmit={handleSubmit} noValidate>
              <div className="recap">
                <div className="rc">
                  <PortraitRond portrait={coiffeur.portrait} nom={`${coiffeur.prenom} ${coiffeur.nom}`} taille={44} />
                  <span>
                    <small>Coiffeur</small>
                    {coiffeur.prenom} {coiffeur.nom}
                  </span>
                </div>
                <div className="rc">
                  <span>
                    <small>{choisies.length > 1 ? 'Prestations' : 'Service'}</small>
                    {service.nom} · {service.duree} min · {formatPrix(service.prix)}
                  </span>
                </div>
              </div>

              <h2 className="sec-t" style={{ margin: '34px 0 22px' }}>
                <b>Vos coordonnées</b>
              </h2>

              <label className="fld">
                <span>Nom complet *</span>
                <input
                  className={cn('inp', fieldErrors.clientNom && 'bad')}
                  type="text"
                  autoComplete="name"
                  value={clientNom}
                  onChange={saisir('clientNom', setClientNom)}
                  aria-invalid={Boolean(fieldErrors.clientNom)}
                />
                {fieldErrors.clientNom && (
                  <p className="err" role="alert">
                    {fieldErrors.clientNom}
                  </p>
                )}
              </label>
              <label className="fld">
                <span>Téléphone *</span>
                <input
                  className={cn('inp', fieldErrors.clientTelephone && 'bad')}
                  type="tel"
                  autoComplete="tel"
                  value={clientTelephone}
                  onChange={saisir('clientTelephone', setClientTelephone)}
                  aria-invalid={Boolean(fieldErrors.clientTelephone)}
                />
                {fieldErrors.clientTelephone && (
                  <p className="err" role="alert">
                    {fieldErrors.clientTelephone}
                  </p>
                )}
              </label>
              <label className="fld">
                <span>Email (optionnel)</span>
                <input
                  className={cn('inp', fieldErrors.clientEmail && 'bad')}
                  type="email"
                  autoComplete="email"
                  value={clientEmail}
                  onChange={saisir('clientEmail', setClientEmail)}
                  aria-invalid={Boolean(fieldErrors.clientEmail)}
                />
                {fieldErrors.clientEmail ? (
                  <p className="err" role="alert">
                    {fieldErrors.clientEmail}
                  </p>
                ) : (
                  <p className="hint">
                    Sans email, vous ne recevrez ni confirmation ni rappel : notez simplement votre code de suivi à l&apos;écran
                    suivant.
                  </p>
                )}
              </label>
              <label className="fld">
                <span>Note pour le coiffeur (optionnel)</span>
                <textarea className="inp" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </label>

              <div className="hidden" aria-hidden="true">
                <label htmlFor="website">Site web</label>
                <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>

              {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                <p className="hint" style={{ margin: '4px 0 10px' }}>
                  Vérification de sécurité : elle protège le salon contre les réservations automatiques.
                </p>
              )}
              <TurnstileWidget key={turnstileKey} onToken={setTurnstileToken} />

              {submitError && (
                <p className="err" role="alert" style={{ marginBottom: 18 }}>
                  {submitError}
                </p>
              )}

              <button type="button" className="btn btn-ghost btn-sm back" onClick={() => setStep(2)}>
                <ChevronLeft className="size-4" aria-hidden="true" /> Retour
              </button>
            </form>
          )}
        </div>

        {/* ───────── Billet récapitulatif ───────── */}
        <aside aria-label="Récapitulatif de votre rendez-vous">
          <div className="tk">
            <div className="tk-p">
              <div className="lbl">Votre rendez-vous</div>
              {coiffeur ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 22 }}>
                  <PortraitRond portrait={coiffeur.portrait} nom={`${coiffeur.prenom} ${coiffeur.nom}`} taille={60} />
                  <div>
                    <div style={{ font: '400 30px/1.05 var(--mc-serif)' }}>
                      {coiffeur.prenom} {coiffeur.nom}
                    </div>
                    <div className="mut" style={{ marginTop: 6, fontSize: 13 }}>
                      {coiffeur.role}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mut" style={{ margin: '22px 0 0', fontSize: 14, lineHeight: 1.6 }}>
                  Choisissez un coiffeur pour commencer votre réservation.
                </p>
              )}
              <div style={{ marginTop: 20, fontSize: 14.5, color: 'var(--mc-soft)' }}>
                {service ? `${service.nom} · ${service.duree} min` : <span className="mut">Prestation à choisir</span>}
              </div>
            </div>
            <div className="tk-cut" />
            <div className="tk-p">
              <div className="lbl dim" style={{ fontSize: 10.5 }}>
                Date
              </div>
              <div className="val">{date && step >= 2 ? dateLongue(date) : '—'}</div>
              <div className="lbl dim" style={{ marginTop: 22, fontSize: 10.5 }}>
                Heure
              </div>
              <div className="big">{heureDebut && heureFin ? `${heureDebut} — ${heureFin}` : '– – : – –'}</div>
            </div>
            <div className="tk-cut" />
            <div className="tk-p">
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span className="lbl dim" style={{ fontSize: 10.5 }}>
                  Total à régler au salon
                </span>
                <span style={{ font: '600 20px/1 var(--mc-sans)', color: 'var(--mc-gold-ink)', fontVariantNumeric: 'tabular-nums' }}>
                  {service ? formatPrix(service.prix) : '—'}
                </span>
              </div>
              <div className="bars" aria-hidden="true" style={{ marginTop: 22 }} />
              {step === 2 && (
                <button type="button" className="btn btn-gold" style={{ width: '100%', marginTop: 24 }} disabled={!peutContinuer} onClick={() => setStep(3)}>
                  Continuer
                </button>
              )}
              {step === 3 && (
                <button type="submit" form="coord-form" className="btn btn-gold" style={{ width: '100%', marginTop: 24 }} disabled={submitting}>
                  {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                  Confirmer la réservation
                </button>
              )}
            </div>
          </div>
          <ul className="assure">
            <li>
              <Check className="size-4" aria-hidden="true" />
              Confirmation immédiate, sans validation manuelle.
            </li>
            <li>
              <Check className="size-4" aria-hidden="true" />
              Annulation possible jusqu&apos;à 2 h avant le rendez-vous.
            </li>
          </ul>
        </aside>
      </div>

      {/* Barre fixe sur mobile : le billet reste visible pendant le défilement */}
      {afficherBarre && actionMobile && (
        <div className="mbar">
          <div>
            <div className="lbl dim" style={{ fontSize: 9.5 }}>
              Récapitulatif{date ? ` · ${dateLongue(date)}` : ''}
            </div>
            <div className="t">{heureDebut && heureFin ? `${heureDebut} — ${heureFin}` : '– – : – –'}</div>
            <div className="s">{service ? formatPrix(service.prix) : ''}</div>
          </div>
          {step === 2 ? (
            <button type="button" className="btn btn-gold btn-sm" disabled={!peutContinuer} onClick={() => setStep(3)}>
              {actionMobile}
            </button>
          ) : (
            <button type="submit" form="coord-form" className="btn btn-gold btn-sm" disabled={submitting}>
              {actionMobile}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
