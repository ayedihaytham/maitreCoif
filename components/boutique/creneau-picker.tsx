'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'

import type { CreneauGrille, EtatJour } from '@/lib/slots'
import { cn } from '@/lib/utils'

export interface CreneauChoisi {
  coiffeurId: string
  date: string
  heureDebut: string
}

interface Coiffeur {
  id: string
  nom: string
  prenom: string
  role: string
}

const JOURS_PROPOSES = 14
const JOURS_COURTS = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM']
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** Jour courant dans le fuseau du salon (le serveur recontrôle de toute façon le créneau). */
const aujourdhui = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date())

function dateLongue(iso: string) {
  const t = new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/**
 * Choix du coiffeur, du jour et de l'heure pour la prestation d'un pack. Mêmes données et mêmes règles que la
 * réservation classique (/api/disponibilites) : seuls les créneaux réellement libres sont proposés.
 */
export function CreneauPicker({ serviceIds, onChange }: { serviceIds: string[]; onChange: (c: CreneauChoisi | null) => void }) {
  const services = serviceIds.join(',')
  const [coiffeurs, setCoiffeurs] = useState<Coiffeur[] | null>(null)
  const [coiffeurId, setCoiffeurId] = useState('')
  const [etats, setEtats] = useState<Record<string, EtatJour>>({})
  const [chargementJours, setChargementJours] = useState(false)
  const [date, setDate] = useState('')
  const [grille, setGrille] = useState<CreneauGrille[]>([])
  const [chargementGrille, setChargementGrille] = useState(false)
  const [heure, setHeure] = useState('')

  const today = useMemo(aujourdhui, [])
  const jours = useMemo(
    () =>
      Array.from({ length: JOURS_PROPOSES }, (_, i) => {
        const d = new Date(`${today}T00:00:00Z`)
        d.setUTCDate(d.getUTCDate() + i)
        return { iso: d.toISOString().slice(0, 10), dow: JOURS_COURTS[d.getUTCDay()], num: d.getUTCDate(), mois: MOIS_COURTS[d.getUTCMonth()] }
      }),
    [today],
  )

  useEffect(() => {
    fetch('/api/coiffeurs')
      .then((r) => r.json())
      .then((liste: Coiffeur[]) => {
        setCoiffeurs(liste)
        if (liste.length === 1) setCoiffeurId(liste[0].id)
      })
      .catch(() => setCoiffeurs([]))
  }, [])

  // Jours libres, complets ou fermés pour ce coiffeur et ces prestations.
  useEffect(() => {
    setHeure('')
    if (!coiffeurId || !services) {
      setEtats({})
      setDate('')
      return
    }
    const controleur = new AbortController()
    setChargementJours(true)
    const params = new URLSearchParams({ coiffeurId, serviceId: services, from: today, count: String(JOURS_PROPOSES) })
    fetch(`/api/disponibilites/jours?${params}`, { signal: controleur.signal })
      .then((r) => r.json())
      .then((data: { jours?: { date: string; etat: EtatJour }[] }) => {
        const liste = data.jours ?? []
        setEtats(Object.fromEntries(liste.map((j) => [j.date, j.etat])))
        setDate(liste.find((j) => j.etat === 'libre')?.date ?? '')
      })
      .catch(() => {})
      .finally(() => !controleur.signal.aborted && setChargementJours(false))
    return () => controleur.abort()
  }, [coiffeurId, services, today])

  // Créneaux du jour choisi.
  useEffect(() => {
    setHeure('')
    if (!coiffeurId || !services || !date) {
      setGrille([])
      return
    }
    const controleur = new AbortController()
    setChargementGrille(true)
    const params = new URLSearchParams({ coiffeurId, serviceId: services, date })
    fetch(`/api/disponibilites?${params}`, { signal: controleur.signal })
      .then((r) => r.json())
      .then((data: { grille?: CreneauGrille[] }) => setGrille(data.grille ?? []))
      .catch(() => {})
      .finally(() => !controleur.signal.aborted && setChargementGrille(false))
    return () => controleur.abort()
  }, [coiffeurId, services, date])

  useEffect(() => {
    onChange(coiffeurId && date && heure ? { coiffeurId, date, heureDebut: heure } : null)
  }, [coiffeurId, date, heure, onChange])

  return (
    <div>
      {coiffeurs === null ? (
        <p className="loading" role="status">
          <Loader2 className="size-4" aria-hidden="true" /> Chargement…
        </p>
      ) : (
        <div className="coif" role="radiogroup" aria-label="Coiffeur">
          {coiffeurs.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={coiffeurId === c.id} className={cn('choice', coiffeurId === c.id && 'sel')} onClick={() => setCoiffeurId(c.id)}>
              <span className="ct">
                <span className="nm" style={{ fontSize: 22 }}>
                  {c.prenom} {c.nom}
                </span>
                <span className="sb">{c.role === 'ADMIN' ? 'Gérant · Fondateur' : 'Coiffeur'}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {coiffeurId && (
        <>
          <div className="days" role="group" aria-label="Jours disponibles">
            {jours.map((j) => {
              const etat = etats[j.iso]
              const inconnu = chargementJours || etat === undefined
              return (
                <button key={j.iso} type="button" className={cn('day', date === j.iso && 'sel')} aria-pressed={date === j.iso} disabled={inconnu || etat !== 'libre'} onClick={() => setDate(j.iso)}>
                  <span className="dw">{j.dow}</span>
                  <span className="dn">{j.num}</span>
                  <span className="dm">{inconnu || etat === 'libre' ? j.mois : etat === 'complet' ? 'Complet' : 'Fermé'}</span>
                </button>
              )
            })}
          </div>

          {!chargementJours && Object.keys(etats).length > 0 && !date && <p className="empty" style={{ marginTop: 22 }}>Plus aucun créneau libre dans les {JOURS_PROPOSES} prochains jours avec ce coiffeur : essayez-en un autre ou contactez le salon.</p>}

          {date && (
            <div>
              <h3 className="sec-t" style={{ margin: '30px 0 14px' }}>
                <b>Choisissez l’heure</b> · {dateLongue(date)}
              </h3>
              {chargementGrille ? (
                <p className="loading" role="status">
                  <Loader2 className="size-4" aria-hidden="true" /> Chargement des créneaux…
                </p>
              ) : grille.length === 0 ? (
                <p className="empty">Aucun créneau disponible ce jour-là.</p>
              ) : (
                <div className="slots" role="group" aria-label="Créneaux">
                  {grille.map((c) => (
                    <button key={c.heure} type="button" className={cn('slot', heure === c.heure && 'sel')} aria-pressed={heure === c.heure} disabled={!c.libre} onClick={() => setHeure(c.heure)}>
                      {c.heure}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
