import { describe, expect, it } from 'vitest'

import { nettoyerEvenement, nettoyerUrl } from '@/lib/analytics-vie-privee'

describe('nettoyerUrl', () => {
  it('retire le code de suivi', () => {
    expect(nettoyerUrl('https://maitrecoif.com/suivi?code=MC-ABC2345')).toBe('https://maitrecoif.com/suivi')
  })
  it('retire le jeton de réinitialisation de mot de passe', () => {
    expect(nettoyerUrl('https://maitrecoif.com/reinitialiser-mot-de-passe?token=abc123def')).toBe('https://maitrecoif.com/reinitialiser-mot-de-passe')
  })
  it('garde les paramètres de campagne et retire le reste', () => {
    expect(nettoyerUrl('https://maitrecoif.com/?utm_source=instagram&utm_campaign=ete&code=MC-X&email=a@b.fr')).toBe(
      'https://maitrecoif.com/?utm_source=instagram&utm_campaign=ete',
    )
  })
  it('retire le fragment', () => {
    expect(nettoyerUrl('https://maitrecoif.com/services#prix')).toBe('https://maitrecoif.com/services')
  })
  it('laisse inchangé ce qui n’est pas une adresse', () => {
    expect(nettoyerUrl('$direct')).toBe('$direct')
    expect(nettoyerUrl('/suivi?code=MC-X')).toBe('/suivi?code=MC-X')
  })
})

describe('nettoyerEvenement', () => {
  it('nettoie toutes les adresses de l’événement, y compris $set_once', () => {
    const r = nettoyerEvenement({
      properties: { $current_url: 'https://maitrecoif.com/suivi?code=MC-ABC2345', $referrer: 'https://google.com/search?q=coiffeur+sfax', cible: 'reserver-barre', n: 3 },
      $set_once: { $initial_current_url: 'https://maitrecoif.com/suivi?code=MC-ABC2345', $initial_referrer: '$direct' },
    })
    expect(r?.properties).toEqual({ $current_url: 'https://maitrecoif.com/suivi', $referrer: 'https://google.com/search', cible: 'reserver-barre', n: 3 })
    expect(r?.$set_once).toEqual({ $initial_current_url: 'https://maitrecoif.com/suivi', $initial_referrer: '$direct' })
  })
  it('laisse passer null (événement déjà écarté)', () => {
    expect(nettoyerEvenement(null)).toBeNull()
  })
  it('ne contient plus aucun code de suivi', () => {
    const r = nettoyerEvenement({ properties: { $current_url: 'https://maitrecoif.com/suivi?code=MC-ABC2345' } })
    expect(JSON.stringify(r)).not.toContain('MC-ABC2345')
  })
})
