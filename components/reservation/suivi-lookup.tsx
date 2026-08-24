'use client'

import { useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn, formatPrix } from '@/lib/utils'

interface RendezVousSuivi {
  id: string
  codeSuivi: string
  statut: 'EN_ATTENTE' | 'CONFIRME' | 'TERMINE' | 'ANNULE'
  date: string
  heureDebut: string
  heureFin: string
  notes: string | null
  coiffeur: string
  service: string
  prix: number
  duree: number
}

const STATUT_LABEL: Record<RendezVousSuivi['statut'], string> = {
  EN_ATTENTE: 'En attente de confirmation',
  CONFIRME: 'Confirmé',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
}

const STATUT_STYLE: Record<RendezVousSuivi['statut'], string> = {
  EN_ATTENTE: 'bg-secondary text-secondary-foreground',
  CONFIRME: 'bg-primary text-primary-foreground',
  TERMINE: 'border border-border text-muted-foreground',
  ANNULE: 'bg-destructive/10 text-destructive',
}

export function SuiviLookup() {
  const [mode, setMode] = useState<'code' | 'telephone'>('code')
  const [codeSuivi, setCodeSuivi] = useState('')
  const [telephone, setTelephone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<RendezVousSuivi[] | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResults(null)
    setLoading(true)
    try {
      const params = new URLSearchParams(mode === 'code' ? { codeSuivi } : { telephone })
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

  async function handleCancel(rdv: RendezVousSuivi) {
    setCancellingId(rdv.id)
    setError(null)
    try {
      const res = await fetch('/api/rendez-vous/suivi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rdv.id, codeSuivi: rdv.codeSuivi }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Impossible d\'annuler ce rendez-vous.')
        return
      }
      setResults((prev) => prev?.map((r) => (r.id === rdv.id ? { ...r, statut: 'ANNULE' } : r)) ?? null)
    } catch {
      setError('Impossible de contacter le serveur.')
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="border border-border/70 bg-anthracite p-6">
        <div className="mb-5 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('code')}
            className={cn(
              'flex-1 border px-3 py-2 text-[10px] uppercase tracking-[0.14em] transition-colors',
              mode === 'code' ? 'border-gold bg-gold text-background' : 'border-border/70 text-muted-foreground',
            )}
          >
            Code de suivi
          </button>
          <button
            type="button"
            onClick={() => setMode('telephone')}
            className={cn(
              'flex-1 border px-3 py-2 text-[10px] uppercase tracking-[0.14em] transition-colors',
              mode === 'telephone' ? 'border-gold bg-gold text-background' : 'border-border/70 text-muted-foreground',
            )}
          >
            Numéro de téléphone
          </button>
        </div>

        {mode === 'code' ? (
          <div>
            <Label htmlFor="codeSuivi">Code de suivi</Label>
            <Input
              id="codeSuivi"
              placeholder="MC-XXXXXXX"
              value={codeSuivi}
              onChange={(e) => setCodeSuivi(e.target.value)}
              className="mt-1.5"
            />
          </div>
        ) : (
          <div>
            <Label htmlFor="telephone">Numéro de téléphone</Label>
            <Input
              id="telephone"
              type="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              className="mt-1.5"
            />
          </div>
        )}

        <Button type="submit" className="mt-5 w-full" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Rechercher
        </Button>

        {error && <p className="mt-4 text-xs text-destructive">{error}</p>}
      </form>

      {results && results.length > 0 && (
        <div className="mt-8 space-y-4">
          {results.map((rdv) => (
            <article key={rdv.id} className="border border-border/70 bg-background p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-display text-xl tracking-[0.1em] text-gold">{rdv.codeSuivi}</p>
                <Badge className={STATUT_STYLE[rdv.statut]}>{STATUT_LABEL[rdv.statut]}</Badge>
              </div>
              <div className="mt-4 grid gap-1 text-xs leading-6 text-muted-foreground sm:grid-cols-2">
                <p>
                  <span className="text-foreground">Service :</span> {rdv.service} ({rdv.duree} min — {formatPrix(rdv.prix)})
                </p>
                <p>
                  <span className="text-foreground">Coiffeur :</span> {rdv.coiffeur}
                </p>
                <p>
                  <span className="text-foreground">Date :</span> {rdv.date}
                </p>
                <p>
                  <span className="text-foreground">Heure :</span> {rdv.heureDebut} — {rdv.heureFin}
                </p>
              </div>
              {rdv.notes && <p className="mt-3 text-xs italic text-muted-foreground">&quot;{rdv.notes}&quot;</p>}

              {(rdv.statut === 'EN_ATTENTE' || rdv.statut === 'CONFIRME') && (
                <div className="mt-5 border-t border-border/60 pt-4">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleCancel(rdv)}
                    disabled={cancellingId === rdv.id}
                  >
                    {cancellingId === rdv.id ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                    Annuler ce rendez-vous
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
