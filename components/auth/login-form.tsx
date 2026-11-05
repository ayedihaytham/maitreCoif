'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Loader2, LogIn } from 'lucide-react'
import Link from 'next/link'

import { salonUrl } from '@/lib/salon-host'

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
      // Cette connexion ne concerne que les clients (le personnel utilise le
      // sous-domaine salon, géré par Clerk).
      const redirect = searchParams.get('redirect')
      router.push(redirect?.startsWith('/compte') ? redirect : '/compte')
      router.refresh()
    } catch {
      setError('Impossible de contacter le serveur.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card-form">
      <label className="fld">
        <span>Email</span>
        <input className="inp" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="fld">
        <span>Mot de passe</span>
        <input
          className="inp"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {error && (
        <p className="err" role="alert" style={{ margin: '-6px 0 16px' }}>
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-gold" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <LogIn className="size-4" aria-hidden="true" />}
        Se connecter
      </button>

      <div className="form-links">
        <Link href="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
        <Link href="/inscription">Créer un compte</Link>
      </div>
      <p className="form-foot">
        Membre de l&apos;équipe ? <a href={salonUrl('/connexion')}>Accéder à l&apos;espace équipe</a>
      </p>
    </form>
  )
}
