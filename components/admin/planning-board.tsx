'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Role } from '@prisma/client'

interface Coiffeur {
  id: string
  nom: string
  prenom: string
}

interface RendezVous {
  id: string
  coiffeurId: string
  clientNom: string
  clientTelephone: string
  heureDebut: string
  heureFin: string
  statut: 'EN_ATTENTE' | 'CONFIRME' | 'TERMINE' | 'ANNULE'
  notes: string | null
  service: { nom: string; duree: number; prix: number | string }
}

const STATUT_LABEL: Record<RendezVous['statut'], string> = {
  EN_ATTENTE: 'En attente',
  CONFIRME: 'Confirmé',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
}

const STATUT_STYLE: Record<RendezVous['statut'], string> = {
  EN_ATTENTE: 'bg-secondary text-secondary-foreground',
  CONFIRME: 'bg-primary text-primary-foreground',
  TERMINE: 'border border-border text-muted-foreground',
  ANNULE: 'bg-destructive/10 text-destructive',
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function PlanningBoard({ role, currentUserId, coiffeurs }: { role: Role; currentUserId: string; coiffeurs: Coiffeur[] }) {
  const [date, setDate] = useState(todayISO())
  const [scope, setScope] = useState<'equipe' | 'moi'>(role === 'ADMIN' ? 'equipe' : 'moi')
  const [rendezVous, setRendezVous] = useState<RendezVous[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  const columns = scope === 'moi' ? coiffeurs.filter((c) => c.id === currentUserId) : coiffeurs

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from: date, to: date })
      if (scope === 'moi') params.set('coiffeurId', currentUserId)
      const res = await fetch(`/api/rendez-vous?${params}`)
      const data = await res.json()
      setRendezVous(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [date, scope, currentUserId])

  useEffect(() => {
    load()
  }, [load])

  async function changeStatut(id: string, statut: string) {
    setActingId(id)
    try {
      const res = await fetch(`/api/rendez-vous/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
      })
      if (res.ok) {
        const updated = await res.json()
        setRendezVous((prev) => prev.map((r) => (r.id === id ? { ...r, statut: updated.statut } : r)))
      }
    } finally {
      setActingId(null)
    }
  }

  function shiftDate(days: number) {
    const d = new Date(`${date}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    setDate(d.toISOString().slice(0, 10))
  }

  return (
    <div className="p-5 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="icon-sm" onClick={() => shiftDate(-1)} aria-label="Jour précédent">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-40 text-center text-sm">
            {new Date(`${date}T00:00:00Z`).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </span>
          <Button type="button" variant="outline" size="icon-sm" onClick={() => shiftDate(1)} aria-label="Jour suivant">
            <ChevronRight className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setDate(todayISO())}>
            Aujourd&apos;hui
          </Button>
        </div>

        {role === 'ADMIN' && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setScope('equipe')}
              className={cn(
                'border px-3 py-1.5 text-[10px] uppercase tracking-[0.14em]',
                scope === 'equipe' ? 'border-gold bg-gold text-background' : 'border-border/70 text-muted-foreground',
              )}
            >
              Toute l&apos;équipe
            </button>
            <button
              type="button"
              onClick={() => setScope('moi')}
              className={cn(
                'border px-3 py-1.5 text-[10px] uppercase tracking-[0.14em]',
                scope === 'moi' ? 'border-gold bg-gold text-background' : 'border-border/70 text-muted-foreground',
              )}
            >
              Mon planning
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Chargement du planning...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(240px, 1fr))`, minWidth: columns.length * 260 }}
          >
            {columns.map((c) => {
              const rdvDuJour = rendezVous
                .filter((r) => r.coiffeurId === c.id)
                .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut))
              return (
                <div key={c.id} className="border border-border/70 bg-anthracite">
                  <div className="border-b border-border/60 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.1em]">
                      {c.prenom} {c.nom}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{rdvDuJour.length} rendez-vous</p>
                  </div>
                  <div className="space-y-2 p-3">
                    {rdvDuJour.length === 0 && (
                      <p className="px-1 py-4 text-center text-[11px] text-muted-foreground">Aucun rendez-vous</p>
                    )}
                    {rdvDuJour.map((rdv) => (
                      <div key={rdv.id} className="border border-border/60 bg-background p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs">
                            {rdv.heureDebut} — {rdv.heureFin}
                          </span>
                          <Badge className={STATUT_STYLE[rdv.statut]}>{STATUT_LABEL[rdv.statut]}</Badge>
                        </div>
                        <p className="mt-2 text-xs">{rdv.service.nom}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {rdv.clientNom} · {rdv.clientTelephone}
                        </p>
                        {rdv.notes && (
                          <p className="mt-1 whitespace-pre-line text-[11px] italic text-muted-foreground">&quot;{rdv.notes}&quot;</p>
                        )}

                        {(rdv.statut === 'EN_ATTENTE' || rdv.statut === 'CONFIRME') && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {rdv.statut === 'EN_ATTENTE' && (
                              <Button
                                type="button"
                                size="sm"
                                disabled={actingId === rdv.id}
                                onClick={() => changeStatut(rdv.id, 'CONFIRME')}
                              >
                                Confirmer
                              </Button>
                            )}
                            {rdv.statut === 'CONFIRME' && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={actingId === rdv.id}
                                onClick={() => changeStatut(rdv.id, 'TERMINE')}
                              >
                                Terminé
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={actingId === rdv.id}
                              onClick={() => changeStatut(rdv.id, 'ANNULE')}
                            >
                              Annuler
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
