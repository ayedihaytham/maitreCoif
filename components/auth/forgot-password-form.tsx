'use client'

import { useState } from 'react'
import { Loader2, Mail } from 'lucide-react'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
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
      <button type="submit" className="btn btn-gold" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Mail className="size-4" aria-hidden="true" />}
        Envoyer le lien
      </button>
    </form>
  )
}
