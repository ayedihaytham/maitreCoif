'use client'

import type { CSSProperties } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarClock, Check, ChevronLeft, ChevronRight, Loader2, Phone, Plus, X } from 'lucide-react'

import { RdvDialog, type RdvADeplacer } from '@/components/admin/rdv-dialog'
import { cn, formatPrix } from '@/lib/utils'
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
  service: { id: string; nom: string; duree: number; prix: number | string }
  demandesModification: { id: string; message: string }[]
}

const STATUT_LABEL: Record<RendezVous['statut'], string> = {
  EN_ATTENTE: 'À confirmer',
  CONFIRME: 'Confirmé',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
}

const STATUT_TAG: Record<RendezVous['statut'], string> = {
  EN_ATTENTE: 'ad-tag',
  CONFIRME: 'ad-tag',
  TERMINE: 'ad-tag green',
  ANNULE: 'ad-tag red',
}

const PX_PAR_HEURE = 92
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
const enMinutes = (h: string) => {
  const [a, b] = h.split(':').map(Number)
  return a * 60 + b
}
const enHeure = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`

// Jour et heure courants dans le fuseau du salon (et non en UTC / fuseau du poste).
function maintenantSalon() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Tunis',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  )
  return { dateISO: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}

export function PlanningBoard({ role, currentUserId, coiffeurs }: { role: Role; currentUserId: string; coiffeurs: Coiffeur[] }) {
  const [maintenant, setMaintenant] = useState(maintenantSalon)
  const [date, setDate] = useState(() => maintenantSalon().dateISO)
  const [scope, setScope] = useState<'equipe' | 'moi'>(role === 'ADMIN' ? 'equipe' : 'moi')
  const [vue, setVue] = useState<'chrono' | 'liste'>('chrono')
  const [rendezVous, setRendezVous] = useState<RendezVous[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmerAnnulation, setConfirmerAnnulation] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deplacement, setDeplacement] = useState<RdvADeplacer | null>(null)
  const [colonneCible, setColonneCible] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)

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

  // Sur petit écran, la liste est plus lisible que la chronologie.
  useEffect(() => {
    if (window.innerWidth < 900) setVue('liste')
  }, [])

  // La tête de lecture avance : l'heure du salon est relue toutes les 30 s.
  useEffect(() => {
    const t = window.setInterval(() => setMaintenant(maintenantSalon()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  // Un plan sélectionné qui n'existe plus (changement de jour...) est désélectionné.
  useEffect(() => {
    if (selectedId && !rendezVous.some((r) => r.id === selectedId)) setSelectedId(null)
  }, [rendezVous, selectedId])
  useEffect(() => setConfirmerAnnulation(false), [selectedId])
  // Sous 1250 px la fiche passe sous la liste : on l'amène à l'écran à la sélection.
  useEffect(() => {
    if (selectedId && window.innerWidth < 1250) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedId])

  // Plage horaire affichée : 10h–20h par défaut, élargie si un rendez-vous déborde.
  const debutH = Math.min(10, ...rendezVous.map((r) => Math.floor(enMinutes(r.heureDebut) / 60)))
  const finH = Math.max(20, ...rendezVous.map((r) => Math.ceil(enMinutes(r.heureFin) / 60)))
  const hauteur = (finH - debutH) * PX_PAR_HEURE
  const estAujourdhui = date === maintenant.dateISO
  const tete = (maintenant.minutes - debutH * 60) * (PX_PAR_HEURE / 60)
  const teteVisible = estAujourdhui && tete >= 0 && tete <= hauteur

  // À l'ouverture du jour courant, on amène la tête de lecture à l'écran.
  useEffect(() => {
    if (loading || vue !== 'chrono') return
    scrollRef.current?.scrollTo({ top: estAujourdhui ? Math.max(0, tete - 160) : 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, date, vue, scope])

  const actifs = rendezVous.filter((r) => r.statut !== 'ANNULE')
  const aConfirmer = actifs.filter((r) => r.statut === 'EN_ATTENTE').length
  const demandes = actifs.filter((r) => r.demandesModification.length > 0).length
  const chiffre = actifs.reduce((somme, r) => somme + Number(r.service.prix), 0)
  const selected = rendezVous.find((r) => r.id === selectedId) ?? null

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
        setConfirmerAnnulation(false)
      }
    } finally {
      setActingId(null)
    }
  }

  function ouvrirCreation(coiffeurId: string) {
    setDeplacement(null)
    setColonneCible(coiffeurId)
    setDialogOpen(true)
  }

  function ouvrirDeplacement(rdv: RendezVous) {
    setDeplacement({ id: rdv.id, coiffeurId: rdv.coiffeurId, clientNom: rdv.clientNom, service: rdv.service })
    setColonneCible(rdv.coiffeurId)
    setDialogOpen(true)
  }

  function shiftDate(days: number) {
    const d = new Date(`${date}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    setDate(d.toISOString().slice(0, 10))
  }

  const dateLongue = new Date(`${date}T00:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
  const libelleDate = dateLongue.charAt(0).toUpperCase() + dateLongue.slice(1)
  const parColonne = (id: string) => rendezVous.filter((r) => r.coiffeurId === id).sort((a, b) => a.heureDebut.localeCompare(b.heureDebut))
  // Sur la chronologie, les rendez-vous annulés passent sous les actifs (même créneau, s'il a été re-réservé).
  const pourChronologie = (id: string) => [...parColonne(id)].sort((a, b) => Number(a.statut !== 'ANNULE') - Number(b.statut !== 'ANNULE'))

  return (
    <div>
      {/* ───── Barre : jour, nouveau rendez-vous, portée, vue ───── */}
      <div className="pl-bar">
        <div className="pl-date">
          <button type="button" className="btn-i" onClick={() => shiftDate(-1)} aria-label="Jour précédent">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <span className="d" aria-live="polite">
            {libelleDate}
          </span>
          <button type="button" className="btn-i" onClick={() => shiftDate(1)} aria-label="Jour suivant">
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
          <button type="button" className="ad-btn line sm" onClick={() => setDate(maintenantSalon().dateISO)} disabled={estAujourdhui}>
            Aujourd&apos;hui
          </button>
        </div>

        <div className="ad-actions">
          {role === 'ADMIN' && (
            <div className="ad-seg" role="group" aria-label="Portée du planning">
              <button type="button" className={cn(scope === 'equipe' && 'on')} aria-pressed={scope === 'equipe'} onClick={() => setScope('equipe')}>
                Toute l&apos;équipe
              </button>
              <button type="button" className={cn(scope === 'moi' && 'on')} aria-pressed={scope === 'moi'} onClick={() => setScope('moi')}>
                Mon planning
              </button>
            </div>
          )}
          <div className="ad-seg" role="group" aria-label="Affichage">
            <button type="button" className={cn(vue === 'chrono' && 'on')} aria-pressed={vue === 'chrono'} onClick={() => setVue('chrono')}>
              Chronologie
            </button>
            <button type="button" className={cn(vue === 'liste' && 'on')} aria-pressed={vue === 'liste'} onClick={() => setVue('liste')}>
              Liste
            </button>
          </div>
          <button type="button" className="ad-btn gold" onClick={() => ouvrirCreation(columns[0]?.id ?? currentUserId)}>
            <Plus aria-hidden="true" /> Nouveau rendez-vous
          </button>
        </div>
      </div>

      {/* ───── Synthèse du jour ───── */}
      {!loading && (
        <div className="pl-sum" aria-label="Synthèse du jour">
          <span>
            <b>{actifs.length}</b> {actifs.length > 1 ? 'plans' : 'plan'}
          </span>
          {aConfirmer > 0 && (
            <span className="alert">
              <b>{aConfirmer}</b> à confirmer
            </span>
          )}
          {demandes > 0 && (
            <span className="alert">
              <b>{demandes}</b> {demandes > 1 ? 'demandes' : 'demande'} de modification
            </span>
          )}
          <span className="gold">
            <b>{formatPrix(chiffre)}</b> prévus
          </span>
        </div>
      )}

      {loading ? (
        <div className="pl-load">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Chargement du planning…
        </div>
      ) : (
        <div className="pl-wrap">
          <div>
            {vue === 'chrono' ? (
              <div className="pl-scroll" ref={scrollRef}>
                <div className="pl-grid" style={{ '--cols': Math.max(columns.length, 1), '--h': `${hauteur}px`, '--px': `${PX_PAR_HEURE}px` } as CSSProperties}>
                  <div className="pl-corner" />
                  {columns.map((c) => (
                    <div className="pl-head" key={c.id}>
                      <div className="who">
                        <span className="ini" aria-hidden="true">
                          {c.prenom.charAt(0)}
                          {c.nom.charAt(0)}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className="nm" title={`${c.prenom} ${c.nom}`}>
                            {c.prenom} {c.nom.charAt(0)}.
                          </div>
                          <div className="ct">{parColonne(c.id).filter((r) => r.statut !== 'ANNULE').length} plans</div>
                        </div>
                      </div>
                      <button type="button" className="add" onClick={() => ouvrirCreation(c.id)} aria-label={`Nouveau rendez-vous pour ${c.prenom}`}>
                        <Plus className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}

                  <div className="pl-axis">
                    {Array.from({ length: finH - debutH }).map((_, i) => (
                      <div className="pl-hr" key={i} style={{ top: i * PX_PAR_HEURE }}>
                        {pad(debutH + i)}:00
                      </div>
                    ))}
                    {teteVisible && (
                      <span className="pl-nowlbl" style={{ '--t': `${tete}px` } as CSSProperties}>
                        {enHeure(maintenant.minutes)}
                      </span>
                    )}
                  </div>

                  {columns.map((c) => (
                    <div className="pl-lane" key={c.id}>
                      {pourChronologie(c.id).map((rdv) => {
                        const top = (enMinutes(rdv.heureDebut) - debutH * 60) * (PX_PAR_HEURE / 60)
                        const h = Math.max(26, (enMinutes(rdv.heureFin) - enMinutes(rdv.heureDebut)) * (PX_PAR_HEURE / 60) - 3)
                        return (
                          <button
                            key={rdv.id}
                            type="button"
                            className={cn('pl-b', `st-${rdv.statut}`, h < 62 && 'compact', h < 36 && 'tiny', selectedId === rdv.id && 'sel')}
                            style={{ '--t': `${top + 1}px`, '--hh': `${h}px` } as CSSProperties}
                            aria-pressed={selectedId === rdv.id}
                            onClick={() => setSelectedId(selectedId === rdv.id ? null : rdv.id)}
                          >
                            <span className="t">
                              {rdv.heureDebut}
                              {h >= 62 ? ` — ${rdv.heureFin}` : ''}
                            </span>
                            <strong>{rdv.clientNom}</strong>
                            <span className="s">{rdv.service.nom}</span>
                            {rdv.demandesModification.length > 0 && <i className="dm" title="Demande de modification du client" />}
                            <span className="sr-only">
                              {STATUT_LABEL[rdv.statut]}
                              {rdv.demandesModification.length > 0 ? ', demande de modification du client' : ''}
                            </span>
                          </button>
                        )
                      })}
                      {teteVisible && <div className="pl-now" style={{ '--t': `${tete}px` } as CSSProperties} />}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="pl-lists" style={{ '--cols': Math.max(columns.length, 1) } as CSSProperties}>
                {columns.map((c) => {
                  const liste = parColonne(c.id)
                  return (
                    <section className="pl-col" key={c.id} aria-label={`${c.prenom} ${c.nom}`}>
                      <h3>
                        {c.prenom} {c.nom}
                        <small>{liste.filter((r) => r.statut !== 'ANNULE').length} plans</small>
                      </h3>
                      {liste.length === 0 && <p className="ad-empty" style={{ border: 0 }}>Aucun rendez-vous</p>}
                      {liste.map((rdv) => (
                        <button
                          key={rdv.id}
                          type="button"
                          className={cn('pl-row', selectedId === rdv.id && 'sel')}
                          aria-pressed={selectedId === rdv.id}
                          onClick={() => setSelectedId(selectedId === rdv.id ? null : rdv.id)}
                        >
                          <span>
                            <span className="t">
                              {rdv.heureDebut} — {rdv.heureFin}
                            </span>
                            <strong>{rdv.clientNom}</strong>
                            <small>{rdv.service.nom}</small>
                          </span>
                          <span className={STATUT_TAG[rdv.statut]}>{STATUT_LABEL[rdv.statut]}</span>
                        </button>
                      ))}
                    </section>
                  )
                })}
              </div>
            )}
          </div>

          {/* ───── Fiche du plan sélectionné ───── */}
          <aside className="pl-panel" ref={panelRef} aria-label="Détail du rendez-vous">
            {selected ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span className="lbl">Fiche du plan</span>
                  <span className={STATUT_TAG[selected.statut]}>{STATUT_LABEL[selected.statut]}</span>
                </div>
                <div className="tm">
                  {selected.heureDebut} — {selected.heureFin}
                </div>
                <h2>{selected.clientNom}</h2>

                <div className="kv">
                  <div>
                    <small>Prestation</small>
                    {selected.service.nom} · {selected.service.duree} min · {formatPrix(Number(selected.service.prix))}
                  </div>
                  <div>
                    <small>Coiffeur</small>
                    {(() => {
                      const c = coiffeurs.find((x) => x.id === selected.coiffeurId)
                      return c ? `${c.prenom} ${c.nom}` : '—'
                    })()}
                  </div>
                  <div>
                    <small>Téléphone</small>
                    <a href={`tel:${selected.clientTelephone}`}>
                      <Phone className="mr-1.5 inline size-3.5" aria-hidden="true" />
                      {selected.clientTelephone}
                    </a>
                  </div>
                  {selected.notes && (
                    <div>
                      <small>Note du client</small>
                      <span style={{ whiteSpace: 'pre-line', fontStyle: 'italic' }}>« {selected.notes} »</span>
                    </div>
                  )}
                </div>

                {selected.demandesModification.map((d) => (
                  <div className="req" key={d.id} role="note">
                    <b>Demande du client</b>« {d.message} »
                  </div>
                ))}

                {(selected.statut === 'EN_ATTENTE' || selected.statut === 'CONFIRME') && (
                  <div className="act">
                    {confirmerAnnulation ? (
                      <>
                        <span className="hint" style={{ width: '100%' }}>
                          Annuler ce rendez-vous ? Le créneau redevient disponible.
                        </span>
                        <button type="button" className="ad-btn danger sm" disabled={actingId === selected.id} onClick={() => changeStatut(selected.id, 'ANNULE')}>
                          {actingId === selected.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" />} Oui, annuler
                        </button>
                        <button type="button" className="ad-btn line sm" onClick={() => setConfirmerAnnulation(false)}>
                          Non
                        </button>
                      </>
                    ) : (
                      <>
                        {selected.statut === 'EN_ATTENTE' && (
                          <button type="button" className="ad-btn gold sm" disabled={actingId === selected.id} onClick={() => changeStatut(selected.id, 'CONFIRME')}>
                            <Check aria-hidden="true" /> Confirmer
                          </button>
                        )}
                        {selected.statut === 'CONFIRME' && (
                          <button type="button" className="ad-btn gold sm" disabled={actingId === selected.id} onClick={() => changeStatut(selected.id, 'TERMINE')}>
                            <Check aria-hidden="true" /> Terminé
                          </button>
                        )}
                        <button type="button" className="ad-btn line sm" disabled={actingId === selected.id} onClick={() => ouvrirDeplacement(selected)}>
                          <CalendarClock aria-hidden="true" /> Déplacer
                        </button>
                        <button type="button" className="ad-btn danger sm" disabled={actingId === selected.id} onClick={() => setConfirmerAnnulation(true)}>
                          <X aria-hidden="true" /> Annuler
                        </button>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <span className="lbl">Fiche du plan</span>
                <p className="hint" style={{ marginTop: 16 }}>
                  Sélectionnez un rendez-vous sur la chronologie pour voir le client, ses demandes et agir : confirmer, terminer, déplacer ou
                  annuler.
                </p>
                {aConfirmer > 0 && (
                  <p className="hint" style={{ marginTop: 14, color: 'var(--a-gold-soft)' }}>
                    {aConfirmer} {aConfirmer > 1 ? 'rendez-vous attendent' : 'rendez-vous attend'} votre confirmation.
                  </p>
                )}
              </>
            )}
          </aside>
        </div>
      )}

      <RdvDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        coiffeurs={role === 'ADMIN' ? coiffeurs : coiffeurs.filter((c) => c.id === currentUserId)}
        defaultCoiffeurId={colonneCible || currentUserId}
        defaultDate={date}
        coiffeurFige={role !== 'ADMIN'}
        deplacement={deplacement}
        onDone={load}
      />
    </div>
  )
}
