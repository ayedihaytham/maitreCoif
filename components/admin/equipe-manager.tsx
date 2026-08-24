'use client'

import { useRef, useState } from 'react'
import { Camera, Loader2, Pencil, Plus, Star, User, UserX, X } from 'lucide-react'

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { resizeImageToDataUrl } from '@/lib/image-client'
import type { Role } from '@prisma/client'

interface Coiffeur {
  id: string
  nom: string
  prenom: string
  email: string
  telephone: string | null
  role: Role
  photo: string | null
  specialites: string[]
  bio: string | null
  actif: boolean
}

interface Disponibilite {
  jourSemaine: number
  heureDebut: string
  heureFin: string
}

const JOURS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 0, label: 'Dimanche' },
]

const emptyForm = {
  nom: '',
  prenom: '',
  email: '',
  telephone: '',
  bio: '',
  specialites: '',
  role: 'COIFFEUR' as Role,
  password: '',
  photo: '',
}

export function EquipeManager({ initial }: { initial: Coiffeur[] }) {
  const [equipe, setEquipe] = useState(initial)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Coiffeur | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [dispos, setDispos] = useState<Record<number, { active: boolean; heureDebut: string; heureFin: string }>>(
    () => Object.fromEntries(JOURS.map((j) => [j.value, { active: false, heureDebut: '10:00', heureFin: '19:30' }])),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setDispos(Object.fromEntries(JOURS.map((j) => [j.value, { active: false, heureDebut: '10:00', heureFin: '19:30' }])))
    setError(null)
    setOpen(true)
  }

  async function openEdit(c: Coiffeur) {
    setEditing(c)
    setForm({
      nom: c.nom,
      prenom: c.prenom,
      email: c.email,
      telephone: c.telephone ?? '',
      bio: c.bio ?? '',
      specialites: c.specialites.join(', '),
      role: c.role,
      password: '',
      photo: c.photo ?? '',
    })
    setError(null)
    setOpen(true)

    const res = await fetch(`/api/admin/equipe/${c.id}/disponibilites`)
    if (res.ok) {
      const data: Disponibilite[] = await res.json()
      const next = Object.fromEntries(
        JOURS.map((j) => {
          const found = data.find((d) => d.jourSemaine === j.value)
          return [j.value, found ? { active: true, heureDebut: found.heureDebut, heureFin: found.heureFin } : { active: false, heureDebut: '10:00', heureFin: '19:30' }]
        }),
      )
      setDispos(next)
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError(null)
    setPhotoUploading(true)
    try {
      const dataUrl = await resizeImageToDataUrl(file, 500, 0.85)
      setForm((f) => ({ ...f, photo: dataUrl }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de traiter l'image.")
    } finally {
      setPhotoUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const payload = {
        nom: form.nom,
        prenom: form.prenom,
        email: form.email,
        telephone: form.telephone || undefined,
        bio: form.bio || undefined,
        specialites: form.specialites
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        role: form.role,
        photo: form.photo,
        ...(form.password ? { password: form.password } : {}),
      }

      const res = await fetch(editing ? `/api/admin/equipe/${editing.id}` : '/api/admin/equipe', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Une erreur est survenue.')
        return
      }

      const coiffeurId = editing ? editing.id : data.id
      await fetch(`/api/admin/equipe/${coiffeurId}/disponibilites`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disponibilites: Object.entries(dispos)
            .filter(([, v]) => v.active)
            .map(([jourSemaine, v]) => ({ jourSemaine: Number(jourSemaine), heureDebut: v.heureDebut, heureFin: v.heureFin })),
        }),
      })

      const refreshed = await fetch('/api/admin/equipe').then((r) => r.json())
      setEquipe(refreshed)
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeactivate(c: Coiffeur) {
    if (!confirm(`Désactiver ${c.prenom} ${c.nom} ? L'historique de ses rendez-vous sera conservé.`)) return
    const res = await fetch(`/api/admin/equipe/${c.id}`, { method: 'DELETE' })
    if (res.ok) {
      setEquipe((prev) => prev.map((e) => (e.id === c.id ? { ...e, actif: false } : e)))
    }
  }

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" /> Ajouter un coiffeur
        </Button>
      </div>

      <div className="space-y-3">
        {equipe.map((c) => (
          <article key={c.id} className="flex flex-wrap items-center justify-between gap-4 border border-border/70 bg-anthracite p-5">
            <div className="flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gold/30 bg-background">
                {c.photo ? (
                  <img src={c.photo} alt="" className="size-full object-cover" />
                ) : (
                  <User className="size-5 text-muted-foreground" />
                )}
              </div>
              <div>
              <div className="flex items-center gap-2">
                <p className="text-sm">
                  {c.prenom} {c.nom}
                </p>
                {c.role === 'ADMIN' && (
                  <Badge>
                    <Star className="size-3" /> Gérant
                  </Badge>
                )}
                {!c.actif && <Badge variant="outline">Désactivé</Badge>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.email} {c.telephone ? `· ${c.telephone}` : ''}
              </p>
              {c.specialites.length > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">{c.specialites.join(', ')}</p>
              )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => openEdit(c)}>
                <Pencil className="size-3.5" /> Modifier
              </Button>
              {c.actif && (
                <Button type="button" variant="destructive" size="sm" onClick={() => handleDeactivate(c)}>
                  <UserX className="size-3.5" /> Désactiver
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le coiffeur' : 'Ajouter un coiffeur'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Mettez à jour les informations et les disponibilités.' : "Créez un compte pour un nouveau membre de l'équipe."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Photo</Label>
              <div className="mt-1.5 flex items-center gap-4">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gold/30 bg-anthracite">
                  {photoUploading ? (
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  ) : form.photo ? (
                    <img src={form.photo} alt="" className="size-full object-cover" />
                  ) : (
                    <User className="size-6 text-muted-foreground" />
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={photoUploading}>
                  <Camera className="size-3.5" /> {form.photo ? 'Changer' : 'Choisir une photo'}
                </Button>
                {form.photo && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, photo: '' }))}>
                    <X className="size-3.5" /> Retirer
                  </Button>
                )}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="prenom">Prénom</Label>
                <Input id="prenom" required value={form.prenom} onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="nom">Nom</Label>
                <Input id="nom" required value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="telephone">Téléphone</Label>
              <Input id="telephone" value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="specialites">Spécialités (séparées par des virgules)</Label>
              <Input
                id="specialites"
                value={form.specialites}
                onChange={(e) => setForm((f) => ({ ...f, specialites: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} className="mt-1.5" rows={2} />
            </div>
            <div>
              <Label>Rôle</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}>
                <SelectTrigger className="mt-1.5 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COIFFEUR">Coiffeur</SelectItem>
                  <SelectItem value="ADMIN">Administrateur (gérant)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="password">{editing ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe'}</Label>
              <Input
                id="password"
                type="password"
                required={!editing}
                minLength={8}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Disponibilités hebdomadaires</Label>
              <div className="mt-2 space-y-2">
                {JOURS.map((j) => {
                  const d = dispos[j.value]
                  return (
                    <div key={j.value} className={cn('flex flex-wrap items-center gap-3 border p-2.5', d.active ? 'border-gold/50' : 'border-border/50')}>
                      <button
                        type="button"
                        onClick={() => setDispos((prev) => ({ ...prev, [j.value]: { ...prev[j.value], active: !prev[j.value].active } }))}
                        className={cn(
                          'w-24 shrink-0 border px-2 py-1 text-[10px] uppercase tracking-[0.1em]',
                          d.active ? 'border-gold bg-gold text-background' : 'border-border/70 text-muted-foreground',
                        )}
                      >
                        {j.label}
                      </button>
                      {d.active && (
                        <>
                          <Input
                            type="time"
                            value={d.heureDebut}
                            onChange={(e) => setDispos((prev) => ({ ...prev, [j.value]: { ...prev[j.value], heureDebut: e.target.value } }))}
                            className="w-28"
                          />
                          <span className="text-xs text-muted-foreground">à</span>
                          <Input
                            type="time"
                            value={d.heureFin}
                            onChange={(e) => setDispos((prev) => ({ ...prev, [j.value]: { ...prev[j.value], heureFin: e.target.value } }))}
                            className="w-28"
                          />
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="submit" disabled={loading || photoUploading}>
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
