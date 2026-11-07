'use client'

import { useRef, useState } from 'react'
import { Camera, Loader2, Mail, Pencil, Plus, Star, User, UserX, X, Trash2, UserCheck } from 'lucide-react'

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
import { attribuerPortraits } from '@/lib/portraits'
import { PortraitRond } from '@/components/site/portrait'
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
  photo: '',
}

const MESSAGES_INVITATION: Record<string, string> = {
  envoyee:
    "Invitation envoyée par email. Le compte Clerk est créé quand la personne ouvre le lien et choisit son mot de passe ; d'ici là, elle apparaît dans Clerk (Users, Invitations).",
  deja_inscrit: "Cette adresse a déjà un compte Clerk : elle peut se connecter à l'espace salon (« Mot de passe oublié » si besoin).",
  non_configure: "Aucune invitation envoyée : la configuration de Clerk ou du sous-domaine salon est incomplète.",
  echec: "Clerk a refusé l'invitation. Corrigez la cause, puis utilisez le bouton « Inviter » de ce membre.",
}

function messageInvitation(statut: unknown, detail: unknown) {
  const base = MESSAGES_INVITATION[statut as string]
  if (!base) return null
  return typeof detail === 'string' && detail ? `${base} Détail : ${detail}` : base
}

export function EquipeManager({ initial }: { initial: Coiffeur[] }) {
  const [equipe, setEquipe] = useState(initial)
  const portraits = attribuerPortraits(equipe)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Coiffeur | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [dispos, setDispos] = useState<Record<number, { active: boolean; heureDebut: string; heureFin: string }>>(
    () => Object.fromEntries(JOURS.map((j) => [j.value, { active: false, heureDebut: '10:00', heureFin: '19:30' }])),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setNotice(null)
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

      if (!editing) setNotice(messageInvitation(data.invitation, data.invitationDetail))

      const refreshed = await fetch('/api/admin/equipe').then((r) => r.json())
      setEquipe(refreshed)
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleInvite(c: Coiffeur) {
    setNotice(null)
    setInvitingId(c.id)
    try {
      const res = await fetch(`/api/admin/equipe/${c.id}/invitation`, { method: 'POST' })
      const data = await res.json()
      setNotice(res.ok ? messageInvitation(data.invitation, data.invitationDetail) : (data.error ?? 'Une erreur est survenue.'))
    } catch {
      setNotice('Impossible de contacter le serveur.')
    } finally {
      setInvitingId(null)
    }
  }

  async function changerActif(c: Coiffeur, actif: boolean) {
    setNotice(null)
    if (!actif && !confirm(`Désactiver ${c.prenom} ${c.nom} ? Il n'apparaîtra plus à la réservation et perdra l'accès au back-office. L'historique de ses rendez-vous est conservé et vous pourrez le réactiver.`)) return
    const res = await fetch(`/api/admin/equipe/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actif }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setNotice(typeof data.error === 'string' ? data.error : 'Impossible de modifier ce membre.')
      return
    }
    setEquipe((prev) => prev.map((e) => (e.id === c.id ? { ...e, actif } : e)))
    setNotice(actif ? `${c.prenom} ${c.nom} est de nouveau actif.` : `${c.prenom} ${c.nom} est désactivé.`)
  }

  async function supprimer(c: Coiffeur) {
    setNotice(null)
    const nom = `${c.prenom} ${c.nom}`
    if (!confirm(`Supprimer définitivement ${nom} ? Ses horaires seront effacés. Cette action est irréversible.`)) return

    let res = await fetch(`/api/admin/equipe/${c.id}`, { method: 'DELETE' })
    let data = await res.json().catch(() => ({}))

    // Des rendez-vous sont à son nom : on montre ce qui disparaîtrait et on demande une 2e confirmation.
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
          `${nom} a ${total} rendez-vous :\n- ${detail}\n\nLes supprimer avec lui, définitivement ?\n\nPour garder l'historique, annulez ici et choisissez plutôt « Désactiver ».`,
        )
      )
        return
      res = await fetch(`/api/admin/equipe/${c.id}?cascade=1`, { method: 'DELETE' })
      data = await res.json().catch(() => ({}))
    }

    if (!res.ok) {
      setNotice(data.error ?? 'Suppression impossible.')
      return
    }
    setEquipe((prev) => prev.filter((e) => e.id !== c.id))
    setNotice(
      data.rendezVousSupprimes
        ? `${nom} a été supprimé avec ${data.rendezVousSupprimes} rendez-vous${data.clientsPrevenus ? ` ; ${data.clientsPrevenus} client${data.clientsPrevenus > 1 ? 's' : ''} prévenu${data.clientsPrevenus > 1 ? 's' : ''} par email` : ''}.`
        : `${nom} a été supprimé.`,
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 22 }}>
        <button type="button" className="ad-btn gold" onClick={openCreate}>
          <Plus aria-hidden="true" /> Ajouter un coiffeur
        </button>
      </div>

      {notice && (
        <p role="status" className="ad-note">
          {notice}
        </p>
      )}

      <div className="ad-list">
        {portraits.map((c) => (
          <article key={c.id} className={`ad-card ad-item${c.actif ? '' : ' off'}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
              <PortraitRond portrait={c.portrait} nom={`${c.prenom} ${c.nom}`} taille={64} />
              <div style={{ minWidth: 0 }}>
                <div className="nm">
                  {c.prenom} {c.nom}
                </div>
                <div className="sub" style={{ overflowWrap: 'anywhere' }}>
                  {c.email}
                  {c.telephone ? ` · ${c.telephone}` : ''}
                </div>
                <div className="meta">
                  {c.role === 'ADMIN' && (
                    <span className="ad-tag">
                      <Star className="size-3" aria-hidden="true" /> Gérant
                    </span>
                  )}
                  {!c.actif && <span className="ad-tag mut">Désactivé</span>}
                  {c.specialites.map((sp) => (
                    <span className="ad-tag mut" key={sp}>
                      {sp}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button type="button" className="ad-btn line sm" onClick={() => openEdit(c)}>
                <Pencil aria-hidden="true" /> Modifier
              </button>
              {c.actif && (
                <button type="button" className="ad-btn line sm" disabled={invitingId === c.id} onClick={() => handleInvite(c)}>
                  {invitingId === c.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Mail aria-hidden="true" />} Inviter
                </button>
              )}
              {c.actif ? (
                <button type="button" className="ad-btn danger sm" onClick={() => changerActif(c, false)}>
                  <UserX aria-hidden="true" /> Désactiver
                </button>
              ) : (
                <button type="button" className="ad-btn line sm" onClick={() => changerActif(c, true)}>
                  <UserCheck aria-hidden="true" /> Activer
                </button>
              )}
              <button type="button" className="ad-btn danger sm" onClick={() => supprimer(c)}>
                <Trash2 aria-hidden="true" /> Supprimer
              </button>
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
            <p className="text-[11px] leading-5 text-muted-foreground">
              {editing
                ? "L'adresse email sert d'identifiant de connexion (Clerk) : la modifier ici sans la changer aussi dans Clerk coupe l'accès de la personne."
                : "Aucun mot de passe à définir : la personne reçoit une invitation par email pour créer son accès."}
            </p>

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
