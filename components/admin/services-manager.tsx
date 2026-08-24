'use client'

import { useState } from 'react'
import { Loader2, Pencil, Plus, Power } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
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

  async function toggleActif(s: Service) {
    if (s.actif) {
      await fetch(`/api/services/${s.id}`, { method: 'DELETE' })
    } else {
      await fetch(`/api/services/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actif: true }),
      })
    }
    setServices((prev) => prev.map((p) => (p.id === s.id ? { ...p, actif: !p.actif } : p)))
  }

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" /> Ajouter un service
        </Button>
      </div>

      <div className="space-y-3">
        {services.map((s) => (
          <article key={s.id} className="flex flex-wrap items-center justify-between gap-4 border border-border/70 bg-anthracite p-5">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm">{s.nom}</p>
                {!s.actif && <Badge variant="outline">Désactivé</Badge>}
                {s.categorie && <Badge variant="secondary">{s.categorie}</Badge>}
              </div>
              {s.description && <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {s.duree} min · {formatPrix(Number(s.prix))}
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => openEdit(s)}>
                <Pencil className="size-3.5" /> Modifier
              </Button>
              <Button type="button" variant={s.actif ? 'destructive' : 'outline'} size="sm" onClick={() => toggleActif(s)}>
                <Power className="size-3.5" /> {s.actif ? 'Désactiver' : 'Activer'}
              </Button>
            </div>
          </article>
        ))}
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
