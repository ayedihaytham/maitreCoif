'use client'

import { useState } from 'react'
import { MESSAGE_ANTI_ROBOT, useAntiRobot } from '@/components/reservation/turnstile'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Loader2, UserPlus } from 'lucide-react'

export function RegisterForm() {
  const router = useRouter()
  const [form, setForm] = useState({ prenom: '', nom: '', email: '', telephone: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const robot = useAntiRobot()

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (robot.manquant) {
      setError(MESSAGE_ANTI_ROBOT)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, turnstileToken: robot.token }),
      })
      robot.renouveler()
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
    <form onSubmit={handleSubmit} className="card-form">
      <div className="grid2">
        <label className="fld">
          <span>Prénom</span>
          <input className="inp" required autoComplete="given-name" value={form.prenom} onChange={(e) => update('prenom', e.target.value)} />
        </label>
        <label className="fld">
          <span>Nom</span>
          <input className="inp" required autoComplete="family-name" value={form.nom} onChange={(e) => update('nom', e.target.value)} />
        </label>
      </div>
      <label className="fld">
        <span>Email</span>
        <input
          className="inp"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
        />
      </label>
      <label className="fld">
        <span>Téléphone (optionnel)</span>
        <input className="inp" type="tel" autoComplete="tel" value={form.telephone} onChange={(e) => update('telephone', e.target.value)} />
      </label>
      <label className="fld">
        <span>Mot de passe</span>
        <input
          className="inp"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
        />
        <p className="hint">8 caractères minimum.</p>
      </label>

      {error && (
        <p className="err" role="alert" style={{ margin: '-6px 0 16px' }}>
          {error}
        </p>
      )}

      {robot.widget}

      <button type="submit" className="btn btn-gold" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
        Créer mon compte
      </button>
    </form>
  )
}
