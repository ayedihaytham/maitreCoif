'use client'

import { useState } from 'react'
import { Loader2, Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
      <div className="border border-gold/40 bg-anthracite p-6 text-sm leading-6 text-muted-foreground">
        Si un compte existe avec cet email, un lien de réinitialisation vient de lui être envoyé.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 border border-border/70 bg-anthracite p-6 sm:p-8">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
        Envoyer le lien de réinitialisation
      </Button>
    </form>
  )
}
