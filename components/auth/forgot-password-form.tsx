'use client'

import { useState } from 'react'
import { MESSAGE_ANTI_ROBOT, useAntiRobot } from '@/components/reservation/turnstile'
import { Loader2, Mail } from 'lucide-react'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const robot = useAntiRobot()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null)
    if (robot.manquant) {
      setErreur(MESSAGE_ANTI_ROBOT)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstileToken: robot.token }),
      })
      robot.renouveler()
      if (res.status === 400 || res.status === 429) {
        const data = await res.json().catch(() => ({}))
        setErreur(typeof data.error === 'string' ? data.error : 'Une erreur est survenue, merci de réessayer.')
        return
      }
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="notice" role="status">
        <Mail className="size-4" aria-hidden="true" />
        <span>Si un compte existe avec cet email, un lien de réinitialisation vient de lui être envoyé.</span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="card-form">
      <label className="fld">
        <span>Email</span>
        <input className="inp" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {robot.widget}
      {erreur && (
        <p className="err" role="alert">
          {erreur}
        </p>
      )}
      <button type="submit" className="btn btn-gold" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Mail className="size-4" aria-hidden="true" />}
        Envoyer le lien
      </button>
    </form>
  )
}
