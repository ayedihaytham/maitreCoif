'use client'

import { useState } from 'react'
import { Loader2, Pencil, Plus, Power, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatPrix } from '@/lib/utils'

interface Service {
  id: string
  nom: string
  description: string | null
  prix: number
  duree: number
  categorie: string | null
  actif: boolean
}

const emptyForm = { nom: '', description: '', prix: '', duree: '', categorie: '' }

export function ServicesManager({ initial }: { initial: Service[] }) {
  const [services, setServices] = useState(initial)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError(null)
    setOpen(true)
  }

  function openEdit(s: Service) {
    setEditing(s)
    setForm({
      nom: s.nom,
      description: s.description ?? '',
      prix: String(s.prix),
      duree: String(s.duree),
      categorie: s.categorie ?? '',
    })
    setError(null)
    setOpen(true)
  }

  async function refresh() {
    const res = await fetch('/api/services')
    if (res.ok) setServices(await res.json())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const payload = {
        nom: form.nom,
        description: form.description || undefined,
        prix: Number(form.prix),
        duree: Number(form.duree),
        categorie: form.categorie || undefined,
      }
      const res = await fetch(editing ? `/api/services/${editing.id}` : '/api/services', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(typeof data.error === 'string' ? data.error : 'Une erreur est survenue.')
        return
      }
      await refresh()
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const [message, setMessage] = useState<string | null>(null)

  async function toggleActif(s: Service) {
    setMessage(null)
    const res = await fetch(`/api/services/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actif: !s.actif }),
    })
    if (!res.ok) {
      setMessage("Impossible de modifier ce service pour l'instant.")
      return
    }
    setServices((prev) => prev.map((p) => (p.id === s.id ? { ...p, actif: !p.actif } : p)))
  }

  async function supprimer(s: Service) {
    setMessage(null)
    if (!confirm(`Supprimer définitivement « ${s.nom} » ? Cette action est irréversible.`)) return

    let res = await fetch(`/api/services/${s.id}`, { method: 'DELETE' })
    let data = await res.json().catch(() => ({}))

    // Des rendez-vous contiennent ce service : on montre ce qui disparaîtrait et on demande une 2e confirmation.
    if (res.status === 409 && data.rendezVous) {
      const { total, aVenir, passes } = data.rendezVous as { total: number; aVenir: number; passes: number }
      const detail = [
        passes > 0 ? `${passes} rendez-vous terminé${passes > 1 ? 's' : ''} ou annulé${passes > 1 ? 's' : ''} (leur historique et le chiffre d'affaires associé seront effacés)` : '',
        aVenir > 0 ? `${aVenir} rendez-vous à venir (les clients qui ont laissé un email seront prévenus de l'annulation)` : '',
      ]
        .filter(Boolean)
        .join('\n- ')
      if (
        !confirm(
          `« ${s.nom} » figure dans ${total} rendez-vous :\n- ${detail}\n\nCes rendez-vous seront supprimés en entier, même s'ils contiennent d'autres prestations. Les supprimer avec ce service, définitivement ?\n\nPour garder l'historique, annulez ici et choisissez plutôt « Désactiver ».`,
        )
      )
        return
      res = await fetch(`/api/services/${s.id}?cascade=1`, { method: 'DELETE' })
      data = await res.json().catch(() => ({}))
    }

    if (!res.ok) {
      setMessage(data.error ?? 'Suppression impossible.')
      return
    }
    setServices((prev) => prev.filter((p) => p.id !== s.id))
    if (data.rendezVousSupprimes) {
      setMessage(`« ${s.nom} » a été supprimé avec ${data.rendezVousSupprimes} rendez-vous${data.clientsPrevenus ? ` ; ${data.clientsPrevenus} client${data.clientsPrevenus > 1 ? 's' : ''} prévenu${data.clientsPrevenus > 1 ? 's' : ''} par email` : ''}.`)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 22 }}>
        <button type="button" className="ad-btn gold" onClick={openCreate}>
          <Plus aria-hidden="true" /> Ajouter un service
        </button>
      </div>

      {message && (
        <p role="status" className="ad-note">
          {message}
        </p>
      )}

      <div className="ad-list">
        {services.map((s, i) => (
          <article key={s.id} className={`ad-card ad-item${s.actif ? '' : ' off'}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, minWidth: 0 }}>
              <div className="ad-no" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="nm">{s.nom}</div>
                {s.description && <div className="sub">{s.description}</div>}
                <div className="meta">
                  <span className="ad-price">{formatPrix(Number(s.prix))}</span>
                  <span className="ad-tag mut">{s.duree} min</span>
                  {s.categorie && <span className="ad-tag mut">{s.categorie}</span>}
                  {!s.actif && <span className="ad-tag red">Désactivé</span>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button type="button" className="ad-btn line sm" onClick={() => openEdit(s)}>
                <Pencil aria-hidden="true" /> Modifier
              </button>
              <button type="button" className={`ad-btn sm ${s.actif ? 'danger' : 'line'}`} onClick={() => toggleActif(s)}>
                <Power aria-hidden="true" /> {s.actif ? 'Désactiver' : 'Activer'}
              </button>
              <button type="button" className="ad-btn sm danger" onClick={() => supprimer(s)}>
                <Trash2 aria-hidden="true" /> Supprimer
              </button>
            </div>
          </article>
        ))}
        {services.length === 0 && <p className="ad-empty">Aucun service pour le moment.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le service' : 'Ajouter un service'}</DialogTitle>
            <DialogDescription>Renseignez le nom, le prix et la durée de la prestation.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="nom">Nom</Label>
              <Input id="nom" required value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-1.5"
                rows={2}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="prix">Prix (DT)</Label>
                <Input
                  id="prix"
                  type="number"
                  min="0"
                  step="0.1"
                  required
                  value={form.prix}
                  onChange={(e) => setForm((f) => ({ ...f, prix: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="duree">Durée (minutes)</Label>
                <Input
                  id="duree"
                  type="number"
                  min="5"
                  step="5"
                  required
                  value={form.duree}
                  onChange={(e) => setForm((f) => ({ ...f, duree: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="categorie">Catégorie</Label>
              <Input
                id="categorie"
                value={form.categorie}
                onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))}
                className="mt-1.5"
                placeholder="Coupe, Barbe, Couleur..."
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
