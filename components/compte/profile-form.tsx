'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ProfileFormProps {
  initial: { nom: string; prenom: string; telephone: string | null }
}

export function ProfileForm({ initial }: ProfileFormProps) {
  const [nom, setNom] = useState(initial.nom)
  const [prenom, setPrenom] = useState(initial.prenom)
  const [telephone, setTelephone] = useState(initial.telephone ?? '')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSaved(false)
    try {
      await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom, prenom, telephone }),
      })
      setSaved(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 border border-border/70 bg-anthracite p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="prenom">Prénom</Label>
          <Input id="prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="nom">Nom</Label>
          <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} className="mt-1.5" />
        </div>
      </div>
      <div>
        <Label htmlFor="telephone">Téléphone</Label>
        <Input id="telephone" value={telephone} onChange={(e) => setTelephone(e.target.value)} className="mt-1.5" />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
        Enregistrer
      </Button>
    </form>
  )
}
