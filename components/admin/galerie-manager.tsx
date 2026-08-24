'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { resizeImageToDataUrl } from '@/lib/image-client'

interface Photo {
  id: string
  url: string
  legende: string | null
}

export function GalerieManager({ initial }: { initial: Photo[] }) {
  const [photos, setPhotos] = useState(initial)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [legende, setLegende] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError(null)
    setUploading(true)
    try {
      const dataUrl = await resizeImageToDataUrl(file, 1200, 0.82)
      const res = await fetch('/api/admin/galerie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: dataUrl, legende: legende || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Une erreur est survenue.')
        return
      }
      setPhotos((prev) => [...prev, data])
      setLegende('')
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de traiter l'image.")
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette photo de la galerie du salon ?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/galerie/${id}`, { method: 'DELETE' })
      if (res.ok) setPhotos((prev) => prev.filter((p) => p.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end gap-4 border border-border/70 bg-anthracite p-5">
        <div className="flex-1">
          <label htmlFor="legende" className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Légende (optionnel)
          </label>
          <Input
            id="legende"
            value={legende}
            onChange={(e) => setLegende(e.target.value)}
            className="mt-1.5"
            placeholder="Ex. Notre espace d'attente"
          />
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          Ajouter une photo
        </Button>
      </div>

      {error && <p className="mb-4 text-xs text-destructive">{error}</p>}

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune photo pour le moment. Les photos ajoutées ici apparaissent sur la page d&apos;accueil du site.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p) => (
            <div key={p.id} className="group relative overflow-hidden border border-border/70">
              <img src={p.url} alt={p.legende ?? ''} className="aspect-[4/3] w-full object-cover" />
              {p.legende && (
                <p className="absolute inset-x-0 bottom-0 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                  {p.legende}
                </p>
              )}
              <button
                type="button"
                onClick={() => handleDelete(p.id)}
                disabled={deletingId === p.id}
                aria-label="Supprimer cette photo"
                className="absolute right-2 top-2 flex size-8 items-center justify-center bg-background/90 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
              >
                {deletingId === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
