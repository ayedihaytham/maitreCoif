'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { suivre } from '@/lib/analytics'

/** Annulation d'une réservation par le client : le stock est remis en vente, le salon est prévenu. */
export function AnnulerCommande({ code }: { code: string }) {
  const router = useRouter()
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function annuler() {
    if (!confirm('Annuler cette réservation ? Les articles seront remis en vente.')) return
    setErreur(null)
    setEnvoi(true)
    try {
      const res = await fetch(`/api/boutique/commandes/${encodeURIComponent(code)}/annuler`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setErreur(data.error ?? "Impossible d'annuler pour l'instant.")
      suivre('boutique_commande_annulee')
      router.refresh()
    } catch {
      setErreur('Impossible de contacter le serveur, merci de réessayer.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div>
      <button type="button" className="btn btn-ghost btn-danger" onClick={annuler} disabled={envoi}>
        {envoi && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        Annuler la réservation
      </button>
      {erreur && (
        <p className="err" role="alert">
          {erreur}
        </p>
      )}
    </div>
  )
}
