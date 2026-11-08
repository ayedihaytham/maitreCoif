'use client'

import { useEffect, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Vue = 'services' | 'packs'

/**
 * Sélecteur « Services / Packs » de la page Nos services. Les deux listes sont rendues par le serveur
 * (passées en propriétés) ; seul l'onglet actif est affiché. Les packs s'ouvrent en premier ; `?vue=services` ouvre les services.
 */
export function ServicesOnglets({ nbServices, nbPacks, services, packs }: { nbServices: number; nbPacks: number; services: ReactNode; packs: ReactNode }) {
  // Les packs passent avant les services : ils s'ouvrent en premier dès qu'il y en a.
  const [vue, setVue] = useState<Vue>(nbPacks > 0 ? 'packs' : 'services')

  useEffect(() => {
    if (nbPacks > 0 && new URLSearchParams(window.location.search).get('vue') === 'services') setVue('services')
  }, [nbPacks])

  function choisir(v: Vue) {
    setVue(v)
    // L'adresse reflète l'onglet (lien partageable) sans recharger la page.
    const url = new URL(window.location.href)
    if (v === 'services') url.searchParams.set('vue', 'services')
    else url.searchParams.delete('vue')
    window.history.replaceState(null, '', url)
  }

  // Sans pack, pas de sélecteur : seulement les services.
  if (nbPacks === 0) return <>{services}</>

  return (
    <>
      <div className="bq-toolbar">
        <div className="bq-seg" role="tablist" aria-label="Packs et services">
          <button type="button" role="tab" id="onglet-packs" aria-selected={vue === 'packs'} aria-controls="panneau-packs" className={cn(vue === 'packs' && 'on')} onClick={() => choisir('packs')}>
            Packs <small>{nbPacks}</small>
          </button>
          <button type="button" role="tab" id="onglet-services" aria-selected={vue === 'services'} aria-controls="panneau-services" className={cn(vue === 'services' && 'on')} onClick={() => choisir('services')}>
            Services <small>{nbServices}</small>
          </button>
        </div>
      </div>
      <div role="tabpanel" id="panneau-packs" aria-labelledby="onglet-packs" hidden={vue !== 'packs'}>
        {packs}
      </div>
      <div role="tabpanel" id="panneau-services" aria-labelledby="onglet-services" hidden={vue !== 'services'}>
        {services}
      </div>
    </>
  )
}
