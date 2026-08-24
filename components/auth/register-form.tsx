'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Loader2, UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function RegisterForm() {
  const router = useRouter()
  const [form, setForm] = useState({ prenom: '', nom: '', email: '', telephone: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Une erreur est survenue.')
        return
      }
      await signIn('credentials', { email: form.email, password: form.password, redirect: false })
      router.push('/compte')
      router.refresh()
    } catch {
      setError('Impossible de contacter le serveur.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 border border-border/70 bg-anthracite p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="prenom">Prénom</Label>
          <Input id="prenom" required value={form.prenom} onChange={(e) => update('prenom', e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="nom">Nom</Label>
          <Input id="nom" required value={form.nom} onChange={(e) => update('nom', e.target.value)} className="mt-1.5" />
        </div>
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="telephone">Téléphone (optionnel)</Label>
        <Input
          id="telephone"
          type="tel"
          value={form.telephone}
          onChange={(e) => update('telephone', e.target.value)}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
          className="mt-1.5"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
        Créer mon compte
      </Button>
    </form>
  )
}
