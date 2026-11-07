'use client'

import { useMemo, useState } from 'react'
import { ImagePlus, Loader2, Package, Pencil, Plus, Power, Search, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SEUIL_STOCK_BAS } from '@/lib/boutique-constantes'
import type { ProduitAdmin } from '@/lib/boutique-admin'
import { resizeImageToDataUrl } from '@/lib/image-client'
import { formatPrix } from '@/lib/utils'

const vide = { nom: '', description: '', prix: '', stock: '', categorie: '' }

/** Niveau de stock : sert à la couleur de la jauge et au libellé. */
function niveau(p: ProduitAdmin): 'ok' | 'bas' | 'rupture' {
  return p.stock === 0 ? 'rupture' : p.stock <= SEUIL_STOCK_BAS ? 'bas' : 'ok'
}

export function ProduitsManager({ initial }: { initial: ProduitAdmin[] }) {
  const [produits, setProduits] = useState(initial)
  const [recherche, setRecherche] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const [ouvert, setOuvert] = useState(false)
  const [edition, setEdition] = useState<ProduitAdmin | null>(null)
  const [form, setForm] = useState(vide)
  // undefined : photo inchangée ; null : photo retirée ; texte : nouvelle photo (data URI)
  const [image, setImage] = useState<string | null | undefined>(undefined)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return q ? produits.filter((p) => `${p.nom} ${p.categorie ?? ''}`.toLowerCase().includes(q)) : produits
  }, [produits, recherche])

  const stats = useMemo(
    () => ({
      visibles: produits.filter((p) => p.actif).length,
      bas: produits.filter((p) => p.actif && niveau(p) === 'bas').length,
      ruptures: produits.filter((p) => p.actif && niveau(p) === 'rupture').length,
    }),
    [produits],
  )

  function ouvrirCreation() {
    setEdition(null)
    setForm(vide)
    setImage(undefined)
    setErreur(null)
    setOuvert(true)
  }

  function ouvrirEdition(p: ProduitAdmin) {
    setEdition(p)
    setForm({ nom: p.nom, description: p.description ?? '', prix: String(p.prix), stock: String(p.stock), categorie: p.categorie ?? '' })
    setImage(undefined)
    setErreur(null)
    setOuvert(true)
  }

  async function choisirImage(fichier: File | undefined) {
    if (!fichier) return
    setErreur(null)
    try {
      setImage(await resizeImageToDataUrl(fichier, 800, 0.82))
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Impossible de lire l'image.")
    }
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null)
    setChargement(true)
    try {
      const corps = {
        nom: form.nom,
        description: form.description,
        prix: Number(form.prix),
        stock: Number(form.stock),
        categorie: form.categorie,
        ...(image !== undefined ? { image } : {}),
      }
      const res = await fetch(edition ? `/api/admin/produits/${edition.id}` : '/api/admin/produits', {
        method: edition ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const champs = data.error?.fieldErrors as Record<string, string[]> | undefined
        setErreur(typeof data.error === 'string' ? data.error : (champs && Object.values(champs).flat()[0]) || 'Une erreur est survenue.')
        return
      }
      setProduits((prev) => (edition ? prev.map((p) => (p.id === data.id ? data : p)) : [data, ...prev]))
      setOuvert(false)
      setMessage(edition ? `« ${data.nom} » a été mis à jour.` : `« ${data.nom} » a été ajouté à la boutique.`)
    } finally {
      setChargement(false)
    }
  }

  async function basculer(p: ProduitAdmin) {
    setMessage(null)
    const res = await fetch(`/api/admin/produits/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actif: !p.actif }) })
    if (!res.ok) return setMessage('Impossible de modifier ce produit pour l’instant.')
    setProduits((prev) => prev.map((x) => (x.id === p.id ? { ...x, actif: !x.actif } : x)))
  }

  async function supprimer(p: ProduitAdmin) {
    setMessage(null)
    if (!confirm(`Supprimer définitivement « ${p.nom} » ? Les anciennes réservations gardent son nom et son prix.`)) return
    let res = await fetch(`/api/admin/produits/${p.id}`, { method: 'DELETE' })
    let data = await res.json().catch(() => ({}))

    // Le produit est dans des packs ou des réservations en cours : on montre ce qui changerait et on demande une 2e confirmation.
    if (res.status === 409 && data.impact) {
      const { packs, commandes } = data.impact as { packs: string[]; commandes: number }
      const detail = [
        packs.length > 0 ? `${packs.length > 1 ? 'Il sera retiré des packs' : 'Il sera retiré du pack'} : ${packs.join(', ')} (un pack qui n'a plus aucun élément est désactivé).` : '',
        commandes > 0 ? `${commandes} réservation${commandes > 1 ? 's' : ''} en cours ${commandes > 1 ? 'seront annulées' : 'sera annulée'} (stock remis en vente, clients prévenus par email).` : '',
      ]
        .filter(Boolean)
        .join('\n- ')
      if (!confirm(`« ${p.nom} » est utilisé :\n- ${detail}\n\nLe supprimer quand même, définitivement ?\n\nPour le garder sans le vendre, annulez ici et choisissez plutôt « Masquer ».`)) return
      res = await fetch(`/api/admin/produits/${p.id}?cascade=1`, { method: 'DELETE' })
      data = await res.json().catch(() => ({}))
    }

    if (!res.ok) return setMessage(data.error ?? 'Suppression impossible.')
    setProduits((prev) => prev.filter((x) => x.id !== p.id))
    const suite = [
      data.packsModifies ? `retiré de ${data.packsModifies} pack${data.packsModifies > 1 ? 's' : ''}` : '',
      data.commandesAnnulees ? `${data.commandesAnnulees} réservation${data.commandesAnnulees > 1 ? 's' : ''} annulée${data.commandesAnnulees > 1 ? 's' : ''}, client${data.clientsPrevenus > 1 ? 's' : ''} prévenu${data.clientsPrevenus > 1 ? 's' : ''} par email` : '',
    ].filter(Boolean)
    setMessage(`« ${p.nom} » a été supprimé${suite.length > 0 ? ` (${suite.join(' ; ')})` : ''}.`)
  }

  const apercu = image === undefined ? edition?.image : image

  return (
    <div>
      <div className="bo-kpis">
        <section className="ad-card bo-kpi" aria-label="Produits visibles">
          <span className="lbl dim">Visibles sur le site</span>
          <b>{stats.visibles}</b>
        </section>
        <section className="ad-card bo-kpi" aria-label="Produits dont le stock est bas">
          <span className="lbl dim">Stock bas</span>
          <b className={stats.bas ? 'warn' : ''}>{stats.bas}</b>
        </section>
        <section className="ad-card bo-kpi" aria-label="Produits en rupture">
          <span className="lbl dim">En rupture</span>
          <b className={stats.ruptures ? 'bad' : ''}>{stats.ruptures}</b>
        </section>
      </div>

      <div className="bo-tools">
        <div className="bo-search">
          <Search aria-hidden="true" />
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un produit" aria-label="Rechercher un produit" />
        </div>
        <button type="button" className="ad-btn gold" onClick={ouvrirCreation}>
          <Plus aria-hidden="true" /> Ajouter un produit
        </button>
      </div>

      {message && (
        <p role="status" className="ad-note">
          {message}
        </p>
      )}

      <div className="ad-list">
        {visibles.map((p) => {
          const n = niveau(p)
          return (
            <article key={p.id} className={`ad-card ad-item bo-item${p.actif ? '' : ' off'}`}>
              <div className="bo-main">
                <div className="bo-thumb" aria-hidden="true">
                  {p.image ? <img src={p.image} alt="" loading="lazy" /> : <Package />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="nm">{p.nom}</div>
                  {p.description && <div className="sub">{p.description}</div>}
                  <div className="meta">
                    <span className="ad-price">{formatPrix(p.prix)}</span>
                    {p.categorie && <span className="ad-tag mut">{p.categorie}</span>}
                    <span className={`ad-tag ${n === 'rupture' ? 'red' : n === 'bas' ? '' : 'green'}`}>
                      {n === 'rupture' ? 'Rupture de stock' : n === 'bas' ? `Stock bas : ${p.stock}` : `${p.stock} en stock`}
                    </span>
                    {!p.actif && <span className="ad-tag red">Masqué</span>}
                  </div>
                </div>
              </div>
              <div className="bo-actions">
                <button type="button" className="ad-btn line sm" onClick={() => ouvrirEdition(p)}>
                  <Pencil aria-hidden="true" /> Modifier
                </button>
                <button type="button" className={`ad-btn sm ${p.actif ? 'danger' : 'line'}`} onClick={() => basculer(p)}>
                  <Power aria-hidden="true" /> {p.actif ? 'Masquer' : 'Afficher'}
                </button>
                <button type="button" className="ad-btn sm danger" onClick={() => supprimer(p)} aria-label={`Supprimer ${p.nom}`}>
                  <Trash2 aria-hidden="true" /> Supprimer
                </button>
              </div>
            </article>
          )
        })}
        {visibles.length === 0 && (
          <p className="ad-empty">{produits.length === 0 ? 'Aucun produit pour le moment. Ajoutez votre premier produit pour ouvrir la boutique.' : 'Aucun produit ne correspond à cette recherche.'}</p>
        )}
      </div>

      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{edition ? 'Modifier le produit' : 'Ajouter un produit'}</DialogTitle>
            <DialogDescription>Le client le réserve en ligne, puis le retire et le règle au salon.</DialogDescription>
          </DialogHeader>

          <form onSubmit={enregistrer} className="space-y-4">
            <div className="bo-photo">
              <div className="bo-thumb lg" aria-hidden="true">
                {apercu ? <img src={apercu} alt="" /> : <Package />}
              </div>
              <div className="bo-photo-actions">
                <Label htmlFor="photo-produit">Photo (facultative)</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <label className="ad-btn line sm" htmlFor="photo-produit" style={{ cursor: 'pointer' }}>
                    <ImagePlus aria-hidden="true" /> {apercu ? 'Changer' : 'Choisir une photo'}
                  </label>
                  {apercu && (
                    <button type="button" className="ad-btn sm danger" onClick={() => setImage(null)}>
                      <X aria-hidden="true" /> Retirer
                    </button>
                  )}
                </div>
                <input id="photo-produit" type="file" accept="image/*" className="sr-only" onChange={(e) => choisirImage(e.target.files?.[0])} />
              </div>
            </div>

            <div>
              <Label htmlFor="p-nom">Nom</Label>
              <Input id="p-nom" required value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="p-desc">Description</Label>
              <Textarea id="p-desc" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="mt-1.5" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="p-prix">Prix (DT)</Label>
                <Input id="p-prix" type="number" inputMode="decimal" min="0" step="0.001" required value={form.prix} onChange={(e) => setForm((f) => ({ ...f, prix: e.target.value }))} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="p-stock">Stock</Label>
                <Input id="p-stock" type="number" inputMode="numeric" min="0" step="1" required value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="p-cat">Catégorie</Label>
                <Input id="p-cat" value={form.categorie} onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))} className="mt-1.5" placeholder="Barbe, Coiffage…" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Le stock baisse à chaque réservation et remonte si elle est annulée ou expire. Passé {SEUIL_STOCK_BAS} exemplaires, il est signalé « bas ».</p>

            {erreur && (
              <p role="alert" className="text-xs text-destructive">
                {erreur}
              </p>
            )}

            <DialogFooter>
              <Button type="submit" disabled={chargement}>
                {chargement && <Loader2 className="size-4 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
