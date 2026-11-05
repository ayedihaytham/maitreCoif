'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

export function EmailForm({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/account/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Une erreur est survenue.')
        return
      }
      setDone(true)
      const { signOut } = await import('next-auth/react')
      setTimeout(() => signOut({ callbackUrl: '/connexion' }), 1800)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="notice" role="status">
        <Check className="size-4" aria-hidden="true" />
        <span>Email mis à jour. Reconnectez-vous avec votre nouvelle adresse…</span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="card-form">
      <label className="fld">
        <span>Adresse email</span>
        <input className="inp" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="fld">
        <span>Mot de passe actuel (pour confirmer)</span>
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
      <button type="submit" className="btn btn-gold" disabled={loading || email === initialEmail}>
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        Mettre à jour l&apos;email
      </button>
    </form>
  )
}

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(false)
    if (newPassword !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Une erreur est survenue.')
        return
      }
      setDone(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card-form">
      <label className="fld">
        <span>Mot de passe actuel</span>
        <input
          className="inp"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </label>
      <div className="grid2">
        <label className="fld">
          <span>Nouveau mot de passe</span>
          <input
            className="inp"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </label>
        <label className="fld">
          <span>Confirmer</span>
          <input
            className="inp"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <p className="err" role="alert" style={{ margin: '-6px 0 16px' }}>
          {error}
        </p>
      )}
      {done && (
        <p className="ok-inline" role="status">
          <Check className="size-3.5" aria-hidden="true" /> Mot de passe mis à jour.
        </p>
      )}
      <button type="submit" className="btn btn-gold" disabled={loading}>
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        Changer le mot de passe
      </button>
    </form>
  )
}
