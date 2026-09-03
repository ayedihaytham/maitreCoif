'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Check, ChevronLeft, ChevronRight, Loader2, PartyPopper } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn, formatPrix } from '@/lib/utils'

interface Coiffeur {
  id: string
  nom: string
  prenom: string
  photo: string | null
  specialites: string[]
}

interface Service {
  id: string
  nom: string
  description: string | null
  prix: number
  duree: number
  categorie: string | null
}

const STEPS = ['Coiffeur', 'Service', 'Créneau', 'Coordonnées'] as const

function buildUpcomingDays(count: number) {
  const days: { iso: string; label: string; dayNumber: string }[] = []
  const today = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    days.push({
      iso: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
      dayNumber: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    })
  }
  return days
}

export function ReservationWizard({
  coiffeurs,
  services,
  preselectedCoiffeurId,
}: {
  coiffeurs: Coiffeur[]
  services: Service[]
  preselectedCoiffeurId?: string
}) {
  const [step, setStep] = useState(0)
  const [coiffeurId, setCoiffeurId] = useState(preselectedCoiffeurId ?? '')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState('')
  const [heureDebut, setHeureDebut] = useState('')
  const [creneaux, setCreneaux] = useState<string[]>([])
  const [loadingCreneaux, setLoadingCreneaux] = useState(false)

  const [clientNom, setClientNom] = useState('')
  const [clientTelephone, setClientTelephone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [website, setWebsite] = useState('') // honeypot

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<{ codeSuivi: string } | null>(null)

  const days = useMemo(() => buildUpcomingDays(21), [])
  const selectedCoiffeur = coiffeurs.find((c) => c.id === coiffeurId)
  const selectedService = services.find((s) => s.id === serviceId)

  useEffect(() => {
    if (!coiffeurId || !serviceId || !date) {
      setCreneaux([])
      return
    }
    setLoadingCreneaux(true)
    setHeureDebut('')
    const controller = new AbortController()
    fetch(`/api/disponibilites?coiffeurId=${coiffeurId}&serviceId=${serviceId}&date=${date}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => setCreneaux(data.creneaux ?? []))
      .catch(() => {})
      .finally(() => setLoadingCreneaux(false))
    return () => controller.abort()
  }, [coiffeurId, serviceId, date])

  function goNext() {
    if (step === 0 && !coiffeurId) return
    if (step === 1 && !serviceId) return
    if (step === 2 && (!date || !heureDebut)) return
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0))
  }

  async function handleSubmit() {
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

    setSubmitting(true)
    try {
      const res = await fetch('/api/rendez-vous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coiffeurId,
          serviceId,
          date,
          heureDebut,
          clientNom: clientNom.trim(),
          clientTelephone: clientTelephone.trim(),
          clientEmail: clientEmail.trim() || undefined,
          notes: notes.trim() || undefined,
          website,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? "Une erreur est survenue, merci de réessayer.")
        return
      }
      setConfirmation({ codeSuivi: data.codeSuivi })
    } catch {
      setSubmitError('Impossible de contacter le serveur, merci de réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmation) {
    return (
      <div className="border border-gold/40 bg-anthracite p-8 text-center sm:p-12">
        <PartyPopper className="mx-auto size-8 text-gold" aria-hidden="true" />
        <h2 className="mt-6 text-2xl font-light uppercase tracking-[0.1em]">Rendez-vous confirmé</h2>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Votre rendez-vous est confirmé, aucune validation supplémentaire n&apos;est nécessaire. Conservez votre
          code de suivi pour le consulter, l&apos;annuler ou demander une modification à tout moment.
        </p>
        <p className="mt-6 inline-block border border-gold px-6 py-3 font-display text-2xl tracking-[0.2em] text-gold">
          {confirmation.codeSuivi}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Button render={<a href="/suivi" />} nativeButton={false}>
            Suivre ma réservation
          </Button>
          <Button variant="outline" render={<a href="/" />} nativeButton={false}>
            Retour à l&apos;accueil
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <ol className="mb-10 flex items-center gap-2 sm:gap-4">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px]',
                  i < step
                    ? 'border-gold bg-gold text-background'
                    : i === step
                      ? 'border-gold text-gold'
                      : 'border-border text-muted-foreground',
                )}
              >
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  'hidden text-[10px] uppercase tracking-[0.14em] sm:inline',
                  i === step ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {coiffeurs.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCoiffeurId(c.id)}
              className={cn(
                'flex items-center gap-4 border p-4 text-left transition-colors',
                coiffeurId === c.id ? 'border-gold bg-anthracite' : 'border-border/70 hover:border-gold/60',
              )}
            >
              <div className="relative size-14 shrink-0 overflow-hidden rounded-full border border-gold/40">
                <Image src={c.photo || '/maitre-coif-team.png'} alt="" fill sizes="56px" className="object-cover" />
              </div>
              <div>
                <p className="text-sm font-light tracking-[0.04em]">
                  {c.prenom} {c.nom}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{c.specialites[0] ?? 'Coiffeur'}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setServiceId(s.id)}
              className={cn(
                'border p-4 text-left transition-colors',
                serviceId === s.id ? 'border-gold bg-anthracite' : 'border-border/70 hover:border-gold/60',
              )}
            >
              <p className="text-sm font-light tracking-[0.04em]">{s.nom}</p>
              {s.description && <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>}
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{s.duree} min</span>
                <span className="text-gold">{formatPrix(s.prix)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="mb-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Choisissez une date</p>
          <div className="flex gap-2 overflow-x-auto pb-3">
            {days.map((d) => (
              <button
                key={d.iso}
                type="button"
                onClick={() => setDate(d.iso)}
                className={cn(
                  'flex shrink-0 flex-col items-center gap-1 border px-3 py-2.5 text-center transition-colors',
                  date === d.iso ? 'border-gold bg-anthracite' : 'border-border/70 hover:border-gold/60',
                )}
              >
                <span className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">{d.label}</span>
                <span className="text-xs">{d.dayNumber}</span>
              </button>
            ))}
          </div>

          {date && (
            <div className="mt-6">
              <p className="mb-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Créneaux libres</p>
              {loadingCreneaux ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Chargement des créneaux...
                </div>
              ) : creneaux.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun créneau disponible ce jour-là.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {creneaux.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setHeureDebut(c)}
                      className={cn(
                        'border px-3 py-2 text-xs transition-colors',
                        heureDebut === c ? 'border-gold bg-gold text-background' : 'border-border/70 hover:border-gold/60',
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div className="border border-border/70 bg-anthracite p-4 text-xs leading-6 text-muted-foreground">
            <p>
              <span className="text-gold">Coiffeur :</span> {selectedCoiffeur?.prenom} {selectedCoiffeur?.nom}
            </p>
            <p>
              <span className="text-gold">Service :</span> {selectedService?.nom} ({selectedService?.duree} min —{' '}
              {selectedService && formatPrix(selectedService.prix)})
            </p>
            <p>
              <span className="text-gold">Créneau :</span> {date} à {heureDebut}
            </p>
          </div>

          <div>
            <Label htmlFor="clientNom">Nom complet *</Label>
            <Input id="clientNom" value={clientNom} onChange={(e) => setClientNom(e.target.value)} className="mt-1.5" />
            {fieldErrors.clientNom && <p className="mt-1 text-xs text-destructive">{fieldErrors.clientNom}</p>}
          </div>
          <div>
            <Label htmlFor="clientTelephone">Téléphone *</Label>
            <Input
              id="clientTelephone"
              type="tel"
              value={clientTelephone}
              onChange={(e) => setClientTelephone(e.target.value)}
              className="mt-1.5"
            />
            {fieldErrors.clientTelephone && <p className="mt-1 text-xs text-destructive">{fieldErrors.clientTelephone}</p>}
          </div>
          <div>
            <Label htmlFor="clientEmail">Email (optionnel)</Label>
            <Input
              id="clientEmail"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              className="mt-1.5"
            />
            {fieldErrors.clientEmail && <p className="mt-1 text-xs text-destructive">{fieldErrors.clientEmail}</p>}
          </div>
          <div>
            <Label htmlFor="notes">Note pour le coiffeur (optionnel)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1.5" rows={3} />
          </div>

          <div className="hidden" aria-hidden="true">
            <label htmlFor="website">Site web</label>
            <input
              id="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          {submitError && <p className="text-xs text-destructive">{submitError}</p>}
        </div>
      )}

      <div className="mt-10 flex items-center justify-between">
        <Button type="button" variant="outline" onClick={goBack} disabled={step === 0}>
          <ChevronLeft className="size-4" /> Précédent
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            onClick={goNext}
            disabled={(step === 0 && !coiffeurId) || (step === 1 && !serviceId) || (step === 2 && !heureDebut)}
          >
            Suivant <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Confirmer le rendez-vous
          </Button>
        )}
      </div>
    </div>
  )
}
