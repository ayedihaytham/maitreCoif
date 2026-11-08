'use client'

import { useMemo, useState } from 'react'
import { Gift, Loader2, Pencil, Plus, Power, Scissors, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { PackAdmin } from '@/lib/boutique-admin'
import { prixPack, type TypeRemise } from '@/lib/boutique-constantes'
import { cn, formatPrix } from '@/lib/utils'

export interface ChoixService {
  id: string
  nom: string
  prix: number
  duree: number
  actif: boolean
}

const vide = { nom: '', description: '', remiseType: 'POURCENTAGE' as TypeRemise, remiseValeur: '15', debut: '', fin: '', actif: true }

const RAISONS: Record<string, string> = {
  desactive: 'Désactivé',
  periode: 'Hors de sa période de validité',
  'element-inactif': 'Masqué : une prestation est désactivée',
  rupture: 'Masqué',
}

const cle = (type: 'produit' | 'service', id: string) => `${type}:${id}`

export function PacksManager({ initial, services }: { initial: PackAdmin[]; services: ChoixService[] }) {
  const [packs, setPacks] = useState(initial)
  const [message, setMessage] = useState<string | null>(null)

  const [ouvert, setOuvert] = useState(false)
  const [edition, setEdition] = useState<PackAdmin | null>(null)
  const [form, setForm] = useState(vide)
  // Éléments cochés : « produit:id » ou « service:id » -> quantité
  const [choix, setChoix] = useState<Record<string, number>>({})
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const prixDe = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of services) m.set(cle('service', s.id), s.prix)
    return m
  }, [services])

  const elements = Object.entries(choix).map(([k, quantite]) => ({ quantite, prix: prixDe.get(k) ?? 0 }))
  const valeur = Number(form.remiseValeur.replace(',', '.'))
  const calcul = prixPack(elements, form.remiseType, Number.isFinite(valeur) ? valeur : 0)
  const nbElements = Object.keys(choix).length

  function ouvrirCreation() {
    setEdition(null)
    setForm(vide)
    setChoix({})
    setErreur(null)
    setOuvert(true)
  }

  function ouvrirEdition(p: PackAdmin) {
    setEdition(p)
    setForm({
      nom: p.nom,
      description: p.description ?? '',
      remiseType: p.remiseType,
      remiseValeur: String(p.remiseValeur),
      debut: p.debut ?? '',
      fin: p.fin ?? '',
      actif: p.actif,
    })
    setChoix(Object.fromEntries(p.lignes.map((l) => [cle(l.type, l.id), l.quantite])))
    setErreur(null)
    setOuvert(true)
  }

  function cocher(k: string, coche: boolean) {
    setChoix((c) => {
      const suite = { ...c }
      if (coche) suite[k] = 1
      else delete suite[k]
      return suite
    })
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null)
    if (nbElements === 0) return setErreur('Cochez au moins une prestation.')
    setChargement(true)
    try {
      const corps = {
        nom: form.nom,
        description: form.description,
        remiseType: form.remiseType,
        remiseValeur: valeur,
        debut: form.debut || null,
        fin: form.fin || null,
        actif: form.actif,
        lignes: Object.entries(choix).map(([k, q]) => {
          const [type, id] = k.split(':')
          return { type, id, quantite: q }
        }),
      }
      const res = await fetch(edition ? `/api/admin/packs/${edition.id}` : '/api/admin/packs', {
        method: edition ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const champs = data.error?.fieldErrors as Record<string, string[]> | undefined
        setErreur(typeof data.error === 'string' ? data.error : (champs && Object.values(champs).flat()[0]) || 'Une erreur est survenue.')
        return
      }
      setPacks((prev) => (edition ? prev.map((p) => (p.id === data.id ? data : p)) : [data, ...prev]))
      setOuvert(false)
      setMessage(edition ? `Le pack « ${data.nom} » a été mis à jour.` : `Le pack « ${data.nom} » est créé${data.actif ? ' et visible sur le site' : ''}.`)
    } finally {
      setChargement(false)
    }
  }

  async function basculer(p: PackAdmin) {
    setMessage(null)
    const res = await fetch(`/api/admin/packs/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actif: !p.actif }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return setMessage('Impossible de modifier ce pack pour l’instant.')
    setPacks((prev) => prev.map((x) => (x.id === p.id ? data : x)))
  }

  async function supprimer(p: PackAdmin) {
    setMessage(null)
    if (!confirm(`Supprimer définitivement le pack « ${p.nom} » ? Les anciennes réservations gardent son contenu et son prix.`)) return
    const res = await fetch(`/api/admin/packs/${p.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return setMessage(data.error ?? 'Suppression impossible.')
    setPacks((prev) => prev.filter((x) => x.id !== p.id))
    setMessage(`Le pack « ${p.nom} » a été supprimé.`)
  }

  const enLigne = packs.filter((p) => p.actif && !p.raison).length
  const remiseMoyenne = packs.length ? Math.round(packs.reduce((s, p) => s + p.prix.pourcentage, 0) / packs.length) : 0

  return (
    <div>
      <div className="bo-kpis">
        <section className="ad-card bo-kpi" aria-label="Packs en ligne">
          <span className="lbl dim">Packs en ligne</span>
          <b>{enLigne}</b>
        </section>
        <section className="ad-card bo-kpi" aria-label="Packs au total">
          <span className="lbl dim">Packs créés</span>
          <b>{packs.length}</b>
        </section>
        <section className="ad-card bo-kpi" aria-label="Remise moyenne">
          <span className="lbl dim">Remise moyenne</span>
          <b>{remiseMoyenne} %</b>
        </section>
      </div>

      <div className="bo-tools" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="ad-btn gold" onClick={ouvrirCreation}>
          <Plus aria-hidden="true" /> Créer un pack
        </button>
      </div>

      {message && (
        <p role="status" className="ad-note">
          {message}
        </p>
      )}

      <div className="bo-packs">
        {packs.map((p) => (
          <article key={p.id} className={cn('ad-card bo-pack', !p.actif && 'off')}>
            <div className="bo-pack-top">
              <div style={{ minWidth: 0 }}>
                <h2>{p.nom}</h2>
                {p.description && <p>{p.description}</p>}
              </div>
              {p.prix.pourcentage > 0 && <span className="bo-off">−{p.prix.pourcentage} %</span>}
            </div>
            <ul className="bo-incl">
              {p.lignes.map((l) => (
                <li key={`${l.type}${l.id}`}>
                  <Scissors aria-hidden="true" />
                  <span>{l.nom}</span>
                  <span>{formatPrix(l.prix * l.quantite)}</span>
                </li>
              ))}
            </ul>
            <div className="bo-pack-prix">
              <div>
                {p.prix.economie > 0 && <s>{formatPrix(p.prix.normal)}</s>}
                <b>{formatPrix(p.prix.final)}</b>
                {p.prix.economie > 0 && <span className="econ">Économie : {formatPrix(p.prix.economie)}</span>}
              </div>
              <span className={cn('ad-tag', !p.actif ? 'mut' : p.raison ? 'red' : 'green')}>{!p.actif ? 'Désactivé' : p.raison ? RAISONS[p.raison] : 'En ligne'}</span>
            </div>
            {(p.debut || p.fin) && (
              <p className="bo-periode">
                {p.debut ? `À partir du ${p.debut.split('-').reverse().join('/')}` : ''}
                {p.debut && p.fin ? ' · ' : ''}
                {p.fin ? `Jusqu’au ${p.fin.split('-').reverse().join('/')}` : ''}
              </p>
            )}
            <div className="bo-pack-actions">
              <button type="button" className="ad-btn line sm" onClick={() => ouvrirEdition(p)}>
                <Pencil aria-hidden="true" /> Modifier
              </button>
              <button type="button" className={`ad-btn sm ${p.actif ? 'danger' : 'line'}`} onClick={() => basculer(p)}>
                <Power aria-hidden="true" /> {p.actif ? 'Désactiver' : 'Activer'}
              </button>
              <button type="button" className="ad-btn sm danger" onClick={() => supprimer(p)} aria-label={`Supprimer le pack ${p.nom}`}>
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          </article>
        ))}
        {packs.length === 0 && (
          <div className="ad-card bo-pack-vide">
            <Gift aria-hidden="true" />
            <b>Aucun pack pour le moment</b>
            <span>Par exemple : coupe + barbe + soin à prix réduit.</span>
          </div>
        )}
      </div>

      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{edition ? 'Modifier le pack' : 'Créer un pack'}</DialogTitle>
            <DialogDescription>Cochez les prestations du pack, choisissez la remise : le prix se calcule tout seul. Le client le réserve comme une prestation, en choisissant son créneau.</DialogDescription>
          </DialogHeader>

          <form onSubmit={enregistrer} className="bo-pack-form">
            <div className="bo-pack-form-main space-y-4">
              <div>
                <Label htmlFor="k-nom">Nom du pack</Label>
                <Input id="k-nom" required value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className="mt-1.5" placeholder="Pack Barbier" />
              </div>
              <div>
                <Label htmlFor="k-desc">Description</Label>
                <Textarea id="k-desc" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="mt-1.5" />
              </div>

              <fieldset className="bo-pick">
                <legend>Ce qu’il contient</legend>
                {services.length > 0 && (
                  <>
                    <div className="lbl">Prestations</div>
                    <ul>
                      {services.map((s) => (
                        <LigneChoix key={s.id} k={cle('service', s.id)} nom={s.nom} sous={`${s.duree} min${s.actif ? '' : ' · désactivée'}`} prix={s.prix} choix={choix} cocher={cocher} />
                      ))}
                    </ul>
                  </>
                )}
                {services.length === 0 && <p className="ad-empty">Créez d’abord des services.</p>}
              </fieldset>

              <div className="bo-remise">
                <div>
                  <span className="cap">Type de remise</span>
                  <div className="ad-seg" role="group" aria-label="Type de remise">
                    <button type="button" className={form.remiseType === 'POURCENTAGE' ? 'on' : ''} aria-pressed={form.remiseType === 'POURCENTAGE'} onClick={() => setForm((f) => ({ ...f, remiseType: 'POURCENTAGE', remiseValeur: f.remiseType === 'POURCENTAGE' ? f.remiseValeur : '15' }))}>
                      Pourcentage
                    </button>
                    <button type="button" className={form.remiseType === 'PRIX_FIXE' ? 'on' : ''} aria-pressed={form.remiseType === 'PRIX_FIXE'} onClick={() => setForm((f) => ({ ...f, remiseType: 'PRIX_FIXE', remiseValeur: f.remiseType === 'PRIX_FIXE' ? f.remiseValeur : calcul.normal ? String(Math.round(calcul.normal * 0.85 * 100) / 100) : '' }))}>
                      Prix fixe
                    </button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="k-val">{form.remiseType === 'POURCENTAGE' ? 'Remise (%)' : 'Prix du pack (DT)'}</Label>
                  <Input id="k-val" required inputMode="decimal" value={form.remiseValeur} onChange={(e) => setForm((f) => ({ ...f, remiseValeur: e.target.value }))} className="mt-1.5" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="k-debut">Valable à partir du (facultatif)</Label>
                  <Input id="k-debut" type="date" value={form.debut} onChange={(e) => setForm((f) => ({ ...f, debut: e.target.value }))} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="k-fin">Jusqu’au (facultatif)</Label>
                  <Input id="k-fin" type="date" min={form.debut || undefined} value={form.fin} onChange={(e) => setForm((f) => ({ ...f, fin: e.target.value }))} className="mt-1.5" />
                </div>
              </div>

              <label className="bo-visible">
                <input type="checkbox" checked={form.actif} onChange={(e) => setForm((f) => ({ ...f, actif: e.target.checked }))} />
                <span>
                  <b>Visible sur le site</b>
                  <small>Un pack dont une prestation est désactivée est automatiquement masqué.</small>
                </span>
              </label>
            </div>

            <aside className="bo-pack-sum" aria-label="Récapitulatif du prix" aria-live="polite">
              <div className="lbl">Récapitulatif</div>
              <dl>
                <div>
                  <dt>Prix normal ({nbElements} prestation{nbElements > 1 ? 's' : ''})</dt>
                  <dd>{formatPrix(calcul.normal)}</dd>
                </div>
                <div>
                  <dt>{form.remiseType === 'POURCENTAGE' ? `Remise de ${Number.isFinite(valeur) ? valeur : 0} %` : 'Remise'}</dt>
                  <dd className="econ">−{formatPrix(calcul.economie)}</dd>
                </div>
                <div className="big">
                  <dt>Prix du pack</dt>
                  <dd>{formatPrix(calcul.final)}</dd>
                </div>
              </dl>
              <p>{calcul.economie > 0 ? `Le client économise ${formatPrix(calcul.economie)} (−${calcul.pourcentage} %).` : 'Aucune remise pour le moment.'}</p>
            </aside>

            {erreur && (
              <p role="alert" className="text-xs text-destructive bo-pack-erreur">
                {erreur}
              </p>
            )}

            <DialogFooter className="bo-pack-footer">
              <Button type="submit" disabled={chargement}>
                {chargement && <Loader2 className="size-4 animate-spin" />}
                Enregistrer le pack
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LigneChoix({
  k,
  nom,
  sous,
  prix,
  choix,
  cocher,
}: {
  k: string
  nom: string
  sous: string
  prix: number
  choix: Record<string, number>
  cocher: (k: string, coche: boolean) => void
}) {
  const coche = k in choix
  return (
    <li className={coche ? 'on' : ''}>
      <input type="checkbox" id={`c-${k}`} checked={coche} onChange={(e) => cocher(k, e.target.checked)} />
      <label htmlFor={`c-${k}`} className="t">
        {nom}
        <small>{sous}</small>
      </label>
      <b>{formatPrix(prix)}</b>
    </li>
  )
}
