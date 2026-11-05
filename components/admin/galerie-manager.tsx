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
      <div className="ad-card" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16, padding: 22, marginBottom: 28 }}>
        <div className="min-w-[min(100%,240px)] flex-1">
          <label htmlFor="legende" className="lbl dim">
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
        <button type="button" className="ad-btn gold" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ImagePlus aria-hidden="true" />}
          Ajouter une photo
        </button>
      </div>

      {error && <p role="alert" style={{ marginBottom: 16, fontSize: 13, color: 'var(--a-red)' }}>{error}</p>}

      {photos.length === 0 ? (
        <p className="ad-empty">
          Aucune photo pour le moment. Les photos ajoutées ici apparaissent sur la page d&apos;accueil du site.
        </p>
      ) : (
        <div className="ad-gal">
          {photos.map((p) => (
            <div key={p.id} className="ad-photo">
              <img src={p.url} alt={p.legende ?? ''} />
              {p.legende && <p className="cap">{p.legende}</p>}
              <button type="button" className="del" onClick={() => handleDelete(p.id)} disabled={deletingId === p.id} aria-label="Supprimer cette photo">
                {deletingId === p.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
