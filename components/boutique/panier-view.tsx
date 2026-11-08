'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, Check, Loader2, Package, Scissors, ShoppingBag, Trash2 } from 'lucide-react'

import { Quantite } from '@/components/boutique/catalogue'
import { CreneauPicker, type CreneauChoisi } from '@/components/boutique/creneau-picker'
import { usePanier } from '@/components/boutique/panier'
import { MESSAGE_ANTI_ROBOT, useAntiRobot } from '@/components/reservation/turnstile'
import { suivre } from '@/lib/analytics'
import type { PanierResolu } from '@/lib/boutique'
import { cn, formatPrix } from '@/lib/utils'

const vide: PanierResolu = { lignes: [], rendezVous: null, total: 0, economie: 0, problemes: [] }

export function PanierView() {
  const panier = usePanier()
  const router = useRouter()
  const antiRobot = useAntiRobot()

  const [resolu, setResolu] = useState<PanierResolu>(vide)
  const [chargement, setChargement] = useState(true)
  const [avertissements, setAvertissements] = useState<string[]>([])
  // Incrémenté pour forcer une nouvelle lecture des prix et du stock (après un refus du serveur).
  const [relecture, setRelecture] = useState(0)

  const [clientNom, setClientNom] = useState('')
  const [clientTelephone, setClientTelephone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [retrait, setRetrait] = useState<'SALON' | 'RDV'>('SALON')
  const [jourSouhaite, setJourSouhaite] = useState('')
  const [creneau, setCreneau] = useState<CreneauChoisi | null>(null)
  const [website, setWebsite] = useState('')
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  // Relit les prix et le stock actuels à chaque changement du panier (légèrement différé pendant les clics).
  const signature = JSON.stringify(panier.lignes)
  const derniereSignature = useRef('')
  const { remplacer, lignes, pret } = panier
  useEffect(() => {
    if (!pret) return
    if (lignes.length === 0) {
      setResolu(vide)
      setChargement(false)
      return
    }
    const controleur = new AbortController()
    const minuteur = setTimeout(async () => {
      try {
        const res = await fetch('/api/boutique/panier', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lignes }), signal: controleur.signal })
        if (!res.ok) throw new Error()
        const data = (await res.json()) as PanierResolu
        setResolu(data)
        if (data.problemes.length > 0) setAvertissements(data.problemes)
        // Le serveur a corrigé le panier (article retiré, quantité réduite) : on s'aligne dessus.
        const corrige = data.lignes.map((l) => ({ type: l.type, id: l.id, quantite: l.quantite }))
        const sig = JSON.stringify(corrige)
        if (sig !== signature && sig !== derniereSignature.current) {
          derniereSignature.current = sig
          remplacer(corrige)
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setAvertissements(['Impossible de vérifier les prix pour le moment. Réessayez dans un instant.'])
      } finally {
        if (!controleur.signal.aborted) setChargement(false)
      }
    }, 200)
    return () => {
      clearTimeout(minuteur)
      controleur.abort()
    }
  }, [signature, lignes, pret, remplacer, relecture])

  const saisir = (champ: string, setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value)
    if (erreurs[champ]) setErreurs(({ [champ]: _ignore, ...reste }) => reste)
  }

  const valider = useCallback(() => {
    const e: Record<string, string> = {}
    if (clientNom.trim().length < 2) e.clientNom = 'Nom requis (2 caractères minimum)'
    if (clientTelephone.trim().length < 6 || !/^[0-9+().\s-]+$/.test(clientTelephone)) e.clientTelephone = 'Numéro de téléphone invalide'
    if (resolu.rendezVous && !creneau) e.creneau = 'Choisissez le coiffeur, le jour et l’heure de votre prestation.'
    if (!/^\S+@\S+\.\S+$/.test(clientEmail.trim())) e.clientEmail = 'Email requis : c’est là que nous envoyons votre confirmation'
    return e
  }, [clientNom, clientTelephone, clientEmail, resolu.rendezVous, creneau])

  async function confirmer(ev: React.FormEvent) {
    ev.preventDefault()
    setErreurEnvoi(null)
    const e = valider()
    setErreurs(e)
    if (Object.keys(e).length > 0) return
    if (antiRobot.manquant) return setErreurEnvoi(MESSAGE_ANTI_ROBOT)
    if (resolu.lignes.length === 0) return setErreurEnvoi('Votre panier est vide.')

    setEnvoi(true)
    try {
      const res = await fetch('/api/boutique/commandes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientNom: clientNom.trim(),
          clientTelephone: clientTelephone.trim(),
          clientEmail: clientEmail.trim(),
          retrait,
          jourSouhaite: jourSouhaite.trim(),
          rendezVous: resolu.rendezVous ? (creneau ?? undefined) : undefined,
          lignes: resolu.lignes.map((l) => ({ type: l.type, id: l.id, quantite: l.quantite })),
          website,
          turnstileToken: antiRobot.token,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErreurEnvoi(typeof data.error === 'string' ? data.error : 'Une erreur est survenue, merci de réessayer.')
        if (Array.isArray(data.problemes)) setAvertissements(data.problemes)
        antiRobot.renouveler()
        // Stock ou prix changés entre-temps : on relit le panier pour que le client voie la situation réelle.
        if (res.status === 409) setRelecture((n) => n + 1)
        return
      }
      suivre('boutique_commande_confirmee', { articles: panier.nombre, avecPack: resolu.lignes.some((l) => l.type === 'pack') })
      panier.vider()
      router.push(`/boutique/commande/${encodeURIComponent(data.code)}`)
    } catch {
      setErreurEnvoi('Impossible de contacter le serveur, merci de réessayer.')
    } finally {
      setEnvoi(false)
    }
  }

  if (!pret || (chargement && lignes.length > 0)) {
    return (
      <p className="loading" role="status">
        <Loader2 className="size-4" aria-hidden="true" /> Chargement de votre panier…
      </p>
    )
  }

  if (resolu.lignes.length === 0) {
    return (
      <div className="bq-vide">
        {avertissements.length > 0 && (
          <div className="notice" role="status">
            <AlertCircle className="size-4" aria-hidden="true" />
            <span>{avertissements.join(' ')}</span>
          </div>
        )}
        <ShoppingBag aria-hidden="true" />
        <h2>Votre panier est vide</h2>
        <p>Choisissez des produits : vous les réservez en ligne, puis vous les retirez et les réglez au salon.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 14 }}>
          <Link className="btn btn-gold" href="/boutique">
            Voir les produits
          </Link>
        </div>
      </div>
    )
  }

  const total = formatPrix(resolu.total)

  return (
    <div className="has-mbar">
      <div className="cols">
        <div>
          {avertissements.length > 0 && (
            <div className="notice" role="status" style={{ marginBottom: 24 }}>
              <AlertCircle className="size-4" aria-hidden="true" />
              <span>{avertissements.join(' ')}</span>
            </div>
          )}

          <h2 className="sec-t">
            <b>1.</b> Vos articles
          </h2>
          <ul className="bq-lignes">
            {resolu.lignes.map((l) => (
              <li key={`${l.type}${l.id}`}>
                <div className="bq-th" aria-hidden="true">
                  {l.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- photo servie par /api/boutique
                    <img src={l.image} alt="" width={96} height={96} />
                  ) : l.type === 'pack' ? (
                    <ShoppingBag />
                  ) : (
                    <Package />
                  )}
                </div>
                <div className="bq-li">
                  <b>{l.nom}</b>
                  {l.type === 'pack' ? (
                    <ul className="bq-contenu">
                      {l.elements.map((e) => (
                        <li key={`${e.type}${e.id}`}>
                          {e.type === 'service' ? <Scissors aria-hidden="true" /> : <Package aria-hidden="true" />}
                          {e.nom}
                          {e.quantite > 1 ? ` ×${e.quantite}` : ''}
                          {e.type === 'service' ? ' (prestation)' : ''}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <small>{formatPrix(l.prixUnitaire)} l’unité</small>
                  )}
                  {l.type === 'pack' && l.prixNormalUnitaire > l.prixUnitaire && (
                    <small className="econ">
                      <s>{formatPrix(l.prixNormalUnitaire)}</s> · vous économisez {formatPrix(l.prixNormalUnitaire - l.prixUnitaire)}
                    </small>
                  )}
                </div>
                <Quantite nom={l.nom} valeur={l.quantite} max={l.max} onChange={(v) => panier.regler(l.type, l.id, v)} />
                <b className="bq-lt">{formatPrix(l.prixUnitaire * l.quantite)}</b>
                <button type="button" className="icon-btn" aria-label={`Retirer ${l.nom} du panier`} onClick={() => panier.regler(l.type, l.id, 0)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          <form id="boutique-form" onSubmit={confirmer} noValidate style={{ marginTop: 52 }}>
            {resolu.rendezVous && (
              <section className="bq-creneau" style={{ marginTop: 0, marginBottom: 52 }} aria-label="Rendez-vous de la prestation">
                <h2 className="sec-t">
                  <b>2.</b> Votre rendez-vous
                </h2>
                <p className="hint" style={{ margin: '-6px 0 22px' }}>
                  « {resolu.rendezVous.packNom} » comprend une prestation ({resolu.rendezVous.nom} · {resolu.rendezVous.duree} min) : choisissez dès maintenant votre créneau. Vos produits vous attendent ce jour-là.
                </p>
                <CreneauPicker key={resolu.rendezVous.serviceIds.join(',')} serviceIds={resolu.rendezVous.serviceIds} onChange={setCreneau} />
                {erreurs.creneau && (
                  <p className="err" role="alert" style={{ marginTop: 14 }}>
                    {erreurs.creneau}
                  </p>
                )}
              </section>
            )}
            <h2 className="sec-t">
              <b>{resolu.rendezVous ? '3.' : '2.'}</b> Vos coordonnées
            </h2>
            <div className="grid2">
              <label className="fld">
                <span>Nom complet *</span>
                <input className={cn('inp', erreurs.clientNom && 'bad')} type="text" autoComplete="name" value={clientNom} onChange={saisir('clientNom', setClientNom)} aria-invalid={Boolean(erreurs.clientNom)} />
                {erreurs.clientNom && (
                  <p className="err" role="alert">
                    {erreurs.clientNom}
                  </p>
                )}
              </label>
              <label className="fld">
                <span>Téléphone *</span>
                <input className={cn('inp', erreurs.clientTelephone && 'bad')} type="tel" autoComplete="tel" value={clientTelephone} onChange={saisir('clientTelephone', setClientTelephone)} aria-invalid={Boolean(erreurs.clientTelephone)} />
                {erreurs.clientTelephone && (
                  <p className="err" role="alert">
                    {erreurs.clientTelephone}
                  </p>
                )}
              </label>
            </div>
            <label className="fld">
              <span>Email *</span>
              <input className={cn('inp', erreurs.clientEmail && 'bad')} type="email" autoComplete="email" value={clientEmail} onChange={saisir('clientEmail', setClientEmail)} aria-invalid={Boolean(erreurs.clientEmail)} />
              {erreurs.clientEmail ? (
                <p className="err" role="alert">
                  {erreurs.clientEmail}
                </p>
              ) : (
                <p className="hint">Nous vous envoyons la confirmation avec votre code, puis un message dès que votre commande est prête.</p>
              )}
            </label>

            {!resolu.rendezVous && (
              <>
            <h2 className="sec-t" style={{ marginTop: 40 }}>
              <b>3.</b> Retrait au salon
            </h2>
            <div className="choices" role="radiogroup" aria-label="Mode de retrait">
              {(
                [
                  ['SALON', 'Passer au salon', 'Récupérez vos articles pendant les horaires d’ouverture (mardi — samedi, 10h00 — 20h30).'],
                  ['RDV', 'Avec mon prochain rendez-vous', 'Vos articles vous attendent le jour de votre coupe.'],
                ] as const
              ).map(([valeur, titre, sous]) => (
                <button key={valeur} type="button" role="radio" aria-checked={retrait === valeur} className={cn('choice', retrait === valeur && 'sel')} onClick={() => setRetrait(valeur)}>
                  <span className="chk" aria-hidden="true">
                    {retrait === valeur && <Check className="size-3.5" />}
                  </span>
                  <span className="ct">
                    <span className="nm" style={{ fontSize: 24 }}>
                      {titre}
                    </span>
                    <span className="sb" style={{ display: 'block' }}>
                      {sous}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <label className="fld" style={{ marginTop: 22 }}>
              <span>{retrait === 'RDV' ? 'Date de votre rendez-vous (optionnel)' : 'Jour de passage souhaité (optionnel)'}</span>
              <input className="inp" type="text" value={jourSouhaite} onChange={(e) => setJourSouhaite(e.target.value)} maxLength={100} placeholder={retrait === 'RDV' ? 'Ex. jeudi 13 novembre' : 'Ex. samedi 8 novembre'} />
            </label>
              </>
            )}

            <div className="hidden" aria-hidden="true">
              <label htmlFor="b-website">Site web</label>
              <input id="b-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>

            {antiRobot.widget}

            {erreurEnvoi && (
              <p className="err" role="alert" style={{ margin: '18px 0' }}>
                {erreurEnvoi}
              </p>
            )}
          </form>
        </div>

        {/* ───────── Récapitulatif ───────── */}
        <aside aria-label="Récapitulatif de votre réservation">
          <div className="tk">
            <div className="tk-p">
              <div className="lbl">Votre réservation</div>
              <div className="bq-sum">
                <div>
                  <span>Prix normal</span>
                  <span>{formatPrix(resolu.total + resolu.economie)}</span>
                </div>
                {resolu.economie > 0 && (
                  <div>
                    <span>Remise du pack</span>
                    <span className="econ">−{formatPrix(resolu.economie)}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="tk-cut" />
            <div className="tk-p">
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <span className="lbl dim" style={{ fontSize: 10.5 }}>
                  Total à régler au salon
                </span>
                <span className="bq-total" style={{ font: '600 22px/1 var(--mc-sans)', color: 'var(--mc-gold-ink)', fontVariantNumeric: 'tabular-nums' }}>{total}</span>
              </div>
              <div className="bars" aria-hidden="true" style={{ marginTop: 22 }} />
              <button type="submit" form="boutique-form" className="btn btn-gold" style={{ width: '100%', marginTop: 24 }} disabled={envoi} data-ph="boutique-confirmer">
                {envoi ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                Confirmer la réservation
              </button>
            </div>
          </div>
          <ul className="assure">
            <li>
              <Check className="size-4" aria-hidden="true" />
              Aucun paiement en ligne : vous réglez au salon.
            </li>
            <li>
              <Check className="size-4" aria-hidden="true" />
              Articles gardés 7 jours à votre nom.
            </li>
            <li>
              <Check className="size-4" aria-hidden="true" />
              Annulation gratuite depuis l’email de confirmation.
            </li>
          </ul>
          <Link className="tlink" href="/boutique" style={{ marginTop: 22 }}>
            Continuer mes achats <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </aside>
      </div>

      <div className="mbar">
        <div>
          <div className="lbl dim" style={{ fontSize: 9.5 }}>
            Total à régler au salon
          </div>
          <div className="t">{total}</div>
        </div>
        <button type="submit" form="boutique-form" className="btn btn-gold btn-sm" disabled={envoi}>
          Confirmer
        </button>
      </div>
    </div>
  )
}
