'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Une erreur est survenue.')
        return
      }
      setDone(true)
      setTimeout(() => router.push('/connexion'), 2000)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="notice" role="status">
        <Check className="size-4" aria-hidden="true" />
        <span>Mot de passe mis à jour, redirection vers la connexion…</span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="card-form">
      <label className="fld">
        <span>Nouveau mot de passe</span>
        <input
          className="inp"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="hint">8 caractères minimum.</p>
      </label>
      <label className="fld">
        <span>Confirmer le mot de passe</span>
        <input
          className="inp"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      {error && (
        <p className="err" role="alert" style={{ margin: '-6px 0 16px' }}>
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-gold" disabled={loading}>
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        Réinitialiser le mot de passe
      </button>
    </form>
  )
}
