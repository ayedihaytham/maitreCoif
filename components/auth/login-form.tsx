'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, getSession } from 'next-auth/react'
import { Loader2, LogIn } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) {
        setError('Email ou mot de passe incorrect.')
        return
      }
      const session = await getSession()
      const redirect = searchParams.get('redirect')
      if (session?.user.role === 'COIFFEUR' || session?.user.role === 'ADMIN') {
        router.push(redirect?.startsWith('/admin') ? redirect : '/admin/planning')
      } else {
        router.push(redirect?.startsWith('/compte') ? redirect : '/compte')
      }
      router.refresh()
    } catch {
      setError('Impossible de contacter le serveur.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 border border-border/70 bg-anthracite p-6 sm:p-8">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
        Se connecter
      </Button>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <Link href="/mot-de-passe-oublie" className="text-gold hover:text-foreground">
          Mot de passe oublié ?
        </Link>
        <Link href="/inscription" className="hover:text-foreground">
          Créer un compte
        </Link>
      </div>
    </form>
  )
}
