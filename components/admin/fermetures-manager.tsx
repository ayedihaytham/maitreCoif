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
      <form onSubmit={handleSubmit} className="ad-card" style={{ display: 'grid', gap: 18, padding: 26, gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        <div>
          <Label htmlFor="fermeture-portee">Concerne</Label>
          <select
            id="fermeture-portee"
            value={coiffeurId}
            onChange={(e) => setCoiffeurId(e.target.value)}
            className="mt-1.5 w-full px-3 text-sm"
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
        <div style={{ gridColumn: '1 / -1' }}>
          <button type="submit" className="ad-btn gold" disabled={loading || !dateDebut}>
            {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
            Ajouter la fermeture
          </button>
          {error && <p role="alert" style={{ marginTop: 14, fontSize: 13, color: 'var(--a-red)' }}>{error}</p>}
          {avertissement && <p className="ad-note" style={{ marginTop: 14, marginBottom: 0 }}>{avertissement}</p>}
        </div>
      </form>

      <div>
        <h2 className="lbl dim" style={{ marginBottom: 14 }}>
          Fermetures en cours et à venir
        </h2>
        {fermetures.length === 0 ? (
          <p className="ad-empty">Aucune fermeture planifiée.</p>
        ) : (
          <ul className="ad-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {fermetures.map((f) => (
              <li key={f.id} className="ad-card ad-item ad-ticket">
                <div className="when">
                  <span className="lbl">{f.dateDebut === f.dateFin ? 'Un jour' : 'À partir du'}</span>
                  <span className="d">{formatJour(f.dateDebut)}</span>
                  {f.dateDebut !== f.dateFin && <span className="sub" style={{ margin: 0 }}>jusqu&apos;au {formatJour(f.dateFin)}</span>}
                </div>
                <div className="what">
                  <div>
                    <div className="nm" style={{ fontSize: 22 }}>
                      {f.coiffeur ? `${f.coiffeur.prenom} ${f.coiffeur.nom}` : 'Tout le salon'}
                    </div>
                    <div className="sub">{f.motif || (f.coiffeur ? 'Congé / absence' : 'Fermeture du salon')}</div>
                  </div>
                  <button
                    type="button"
                    className="ad-btn line sm"
                    disabled={deletingId === f.id}
                    onClick={() => handleDelete(f.id)}
                    aria-label="Supprimer cette fermeture"
                  >
                    {deletingId === f.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
