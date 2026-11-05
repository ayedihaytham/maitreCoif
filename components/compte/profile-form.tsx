'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

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
    <form onSubmit={handleSubmit} className="card-form">
      <div className="grid2">
        <label className="fld">
          <span>Prénom</span>
          <input className="inp" value={prenom} autoComplete="given-name" onChange={(e) => setPrenom(e.target.value)} />
        </label>
        <label className="fld">
          <span>Nom</span>
          <input className="inp" value={nom} autoComplete="family-name" onChange={(e) => setNom(e.target.value)} />
        </label>
      </div>
      <label className="fld">
        <span>Téléphone</span>
        <input className="inp" type="tel" value={telephone} autoComplete="tel" onChange={(e) => setTelephone(e.target.value)} />
      </label>
      {saved && (
        <p className="ok-inline" role="status">
          <Check className="size-3.5" aria-hidden="true" /> Informations enregistrées.
        </p>
      )}
      <button type="submit" className="btn btn-gold" disabled={loading}>
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        Enregistrer
      </button>
    </form>
  )
}
