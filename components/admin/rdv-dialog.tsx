'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface Coiffeur {
  id: string
  nom: string
  prenom: string
}

interface Service {
  id: string
  nom: string
  duree: number
}

export interface RdvADeplacer {
  id: string
  coiffeurId: string
  clientNom: string
  service: { id?: string; nom: string; duree: number }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  coiffeurs: Coiffeur[]
  /** Coiffeur présélectionné (colonne cliquée ou planning perso). */
  defaultCoiffeurId: string
  defaultDate: string
  /** Un coiffeur simple ne peut pas changer de coiffeur. */
  coiffeurFige: boolean
  /** Absent = création ; présent = déplacement de ce rendez-vous. */
  deplacement?: RdvADeplacer | null
  onDone: () => void
}

const selectClass = 'mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm'

export function RdvDialog({ open, onOpenChange, coiffeurs, defaultCoiffeurId, defaultDate, coiffeurFige, deplacement, onDone }: Props) {
  const deplace = Boolean(deplacement)
  const [services, setServices] = useState<Service[]>([])
  const [coiffeurId, setCoiffeurId] = useState(defaultCoiffeurId)
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [heureDebut, setHeureDebut] = useState('')
  const [horsHoraires, setHorsHoraires] = useState(false)
  const [creneaux, setCreneaux] = useState<string[]>([])
  const [loadingCreneaux, setLoadingCreneaux] = useState(false)
  const [clientNom, setClientNom] = useState('')
  const [clientTelephone, setClientTelephone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Réinitialise le formulaire à chaque ouverture.
  useEffect(() => {
    if (!open) return
    setCoiffeurId(deplacement?.coiffeurId ?? defaultCoiffeurId)
    setServiceId('')
    setDate(defaultDate)
    setHeureDebut('')
    setHorsHoraires(false)
    setClientNom('')
    setClientTelephone('')
    setClientEmail('')
    setNotes('')
    setError(null)
  }, [open, deplacement, defaultCoiffeurId, defaultDate])

  useEffect(() => {
    if (!open || deplace) return
    fetch('/api/services')
      .then((r) => r.json())
      .then((data) => setServices(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [open, deplace])

  // Pour un déplacement on reprend le service du rendez-vous (donc sa durée).
  const serviceIdEffectif = deplace ? deplacement?.service.id : serviceId

  useEffect(() => {
    if (!open || !coiffeurId || !serviceIdEffectif || !date) {
      setCreneaux([])
      return
    }
    setLoadingCreneaux(true)
    setHeureDebut('')
    const controller = new AbortController()
    fetch(`/api/disponibilites?coiffeurId=${coiffeurId}&serviceId=${serviceIdEffectif}&date=${date}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setCreneaux(data.creneaux ?? []))
      .catch(() => {})
      .finally(() => setLoadingCreneaux(false))
    return () => controller.abort()
  }, [open, coiffeurId, serviceIdEffectif, date])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!heureDebut) {
      setError('Choisissez un créneau.')
      return
    }
    setSubmitting(true)
    try {
      const res = deplace
        ? await fetch(`/api/rendez-vous/${deplacement!.id}/deplacer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, heureDebut, coiffeurId }),
          })
        : await fetch('/api/admin/rendez-vous', {
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
            }),
          })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Données invalides, vérifiez le formulaire.')
        return
      }
      onOpenChange(false)
      onDone()
    } catch {
      setError('Impossible de contacter le serveur.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{deplace ? 'Déplacer le rendez-vous' : 'Nouveau rendez-vous'}</DialogTitle>
          <DialogDescription>
            {deplace
              ? `${deplacement!.clientNom} — ${deplacement!.service.nom} (${deplacement!.service.duree} min). Le client est prévenu par email s'il en a renseigné un.`
              : 'Réservation saisie pour un client (appel, passage au salon). Il est prévenu par WhatsApp et par email si possible.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="rdv-coiffeur">Coiffeur</Label>
            <select
              id="rdv-coiffeur"
              value={coiffeurId}
              onChange={(e) => setCoiffeurId(e.target.value)}
              disabled={coiffeurFige}
              className={selectClass}
            >
              {coiffeurs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.prenom} {c.nom}
                </option>
              ))}
            </select>
          </div>

          {!deplace && (
            <div>
              <Label htmlFor="rdv-service">Service</Label>
              <select id="rdv-service" required value={serviceId} onChange={(e) => setServiceId(e.target.value)} className={selectClass}>
                <option value="">Choisir…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom} ({s.duree} min)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label htmlFor="rdv-date">Date</Label>
            <Input id="rdv-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5" />
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Créneaux libres</p>
            {loadingCreneaux ? (
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Chargement…
              </p>
            ) : horsHoraires ? (
              <div className="mt-2">
                <Label htmlFor="rdv-heure">Heure de début</Label>
                <Input
                  id="rdv-heure"
                  type="time"
                  step={300}
                  required
                  value={heureDebut}
                  onChange={(e) => setHeureDebut(e.target.value)}
                  className="mt-1.5 w-32"
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Hors horaires habituels : seuls les chevauchements, fermetures et dates passées restent refusés.
                </p>
              </div>
            ) : !serviceIdEffectif ? (
              <p className="mt-2 text-xs text-muted-foreground">Choisissez d&apos;abord un service.</p>
            ) : creneaux.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">Aucun créneau libre ce jour-là (horaires, fermeture ou complet).</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {creneaux.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setHeureDebut(c)}
                    aria-pressed={heureDebut === c}
                    className={cn(
                      'border px-3 py-1.5 text-xs transition-colors',
                      heureDebut === c ? 'border-gold bg-gold text-background' : 'border-border/70 hover:border-gold/60',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={horsHoraires}
              onChange={(e) => {
                setHorsHoraires(e.target.checked)
                setHeureDebut('')
              }}
            />
            Choisir une heure hors des créneaux proposés
          </label>

          {!deplace && (
            <>
              <div>
                <Label htmlFor="rdv-nom">Nom du client *</Label>
                <Input id="rdv-nom" required minLength={2} value={clientNom} onChange={(e) => setClientNom(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="rdv-tel">Téléphone *</Label>
                <Input id="rdv-tel" type="tel" required minLength={6} value={clientTelephone} onChange={(e) => setClientTelephone(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="rdv-email">Email (optionnel)</Label>
                <Input id="rdv-email" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="rdv-notes">Note (optionnel)</Label>
                <Input id="rdv-notes" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1.5" />
              </div>
            </>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting || !heureDebut}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {deplace ? 'Déplacer' : 'Créer le rendez-vous'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
