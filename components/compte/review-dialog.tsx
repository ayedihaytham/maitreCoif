'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export function ReviewDialog({ rendezVousId, serviceNom }: { rendezVousId: string; serviceNom: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState(5)
  const [commentaire, setCommentaire] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/avis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rendezVousId, note, commentaire: commentaire || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Une erreur est survenue.')
        return
      }
      setOpen(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Laisser un avis</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Votre avis sur : {serviceNom}</DialogTitle>
          <DialogDescription>Votre retour aide l&apos;équipe à s&apos;améliorer.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setNote(n)} aria-label={`${n} étoiles`}>
              <Star className={cn('size-6', n <= note ? 'fill-gold text-gold' : 'text-muted-foreground')} />
            </button>
          ))}
        </div>

        <Textarea
          placeholder="Votre commentaire (optionnel)"
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          rows={3}
        />

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Envoyer mon avis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
