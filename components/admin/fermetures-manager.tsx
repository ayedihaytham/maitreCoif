'use client'

import { useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Fermeture {
  id: string
  coiffeurId: string | null
  coiffeur: { prenom: string; nom: string } | null
  dateDebut: string
  dateFin: string
  motif: string | null
}

interface Coiffeur {
  id: string
  prenom: string
  nom: string
}

function formatJour(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function FermeturesManager({ initial, coiffeurs }: { initial: Fermeture[]; coiffeurs: Coiffeur[] }) {
  const [fermetures, setFermetures] = useState(initial)
  const [coiffeurId, setCoiffeurId] = useState('') // '' = tout le salon
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [motif, setMotif] = useState('')
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [avertissement, setAvertissement] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setAvertissement(null)
    setLoading(true)
    try {
      const res = await fetch('/api/admin/fermetures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coiffeurId: coiffeurId || null,
          dateDebut,
          dateFin: dateFin || dateDebut,
          motif: motif.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Données invalides, vérifiez les dates.')
        return
      }
      const { rdvImpactes, ...fermeture } = data
      setFermetures((prev) => [...prev, fermeture].sort((a, b) => a.dateDebut.localeCompare(b.dateDebut)))
      if (rdvImpactes > 0) {
        setAvertissement(
          `${rdvImpactes} rendez-vous déjà pris sur cette période : ils ne sont pas annulés automatiquement. Déplacez-les ou annulez-les depuis le planning.`,
        )
      }
      setCoiffeurId('')
      setDateDebut('')
      setDateFin('')
      setMotif('')
    } catch {
      setError('Impossible de contacter le serveur.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/fermetures/${id}`, { method: 'DELETE' })
      if (res.ok) setFermetures((prev) => prev.filter((f) => f.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="grid gap-4 border border-border/70 bg-anthracite p-6 sm:grid-cols-2">
        <div>
          <Label htmlFor="fermeture-portee">Concerne</Label>
          <select
            id="fermeture-portee"
            value={coiffeurId}
            onChange={(e) => setCoiffeurId(e.target.value)}
            className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Tout le salon (jour férié, fermeture)</option>
            {coiffeurs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.prenom} {c.nom} (congé / absence)
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="fermeture-motif">Motif (optionnel)</Label>
          <Input id="fermeture-motif" value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={200} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="fermeture-debut">Du</Label>
          <Input id="fermeture-debut" type="date" required value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="fermeture-fin">Au (inclus, vide = un seul jour)</Label>
          <Input id="fermeture-fin" type="date" min={dateDebut} value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="mt-1.5" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={loading || !dateDebut}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Ajouter la fermeture
          </Button>
          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
          {avertissement && <p className="mt-3 text-xs text-gold">{avertissement}</p>}
        </div>
      </form>

      <div>
        <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">Fermetures en cours et à venir</h2>
        {fermetures.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune fermeture planifiée.</p>
        ) : (
          <ul className="space-y-2">
            {fermetures.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-4 border border-border/70 bg-background p-4">
                <div className="text-sm">
                  <p>
                    {f.dateDebut === f.dateFin ? formatJour(f.dateDebut) : `${formatJour(f.dateDebut)} → ${formatJour(f.dateFin)}`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {f.coiffeur ? `${f.coiffeur.prenom} ${f.coiffeur.nom}` : 'Tout le salon'}
                    {f.motif ? ` · ${f.motif}` : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deletingId === f.id}
                  onClick={() => handleDelete(f.id)}
                  aria-label="Supprimer cette fermeture"
                >
                  {deletingId === f.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
