import { describe, expect, it } from 'vitest'

import { lieuDepuisEntetes, nomDePays } from '@/lib/lieu-visiteur'

const entetes = (valeurs: Record<string, string>) => new Headers(valeurs)

describe('nomDePays', () => {
  it('traduit un code pays en français', () => {
    expect(nomDePays('TN')).toBe('Tunisie')
    expect(nomDePays('fr')).toBe('France')
  })
  it('ignore les codes inconnus ou invalides', () => {
    expect(nomDePays('XX')).toBeNull()
    expect(nomDePays('T1')).toBeNull()
    expect(nomDePays('')).toBeNull()
    expect(nomDePays(null)).toBeNull()
    expect(nomDePays('TUN')).toBeNull()
  })
})

describe('lieuDepuisEntetes', () => {
  it('lit le pays et la ville', () => {
    expect(lieuDepuisEntetes(entetes({ 'cf-ipcountry': 'TN', 'cf-ipcity': 'Sfax' }))).toEqual({ pays: 'Tunisie', ville: 'Sfax' })
  })
  it('retrouve les accents encodés en UTF-8', () => {
    // « Zürich » lu comme du latin1 par Node : « ZÃ¼rich »
    const brut = Buffer.from('Zürich', 'utf8').toString('latin1')
    expect(lieuDepuisEntetes(entetes({ 'cf-ipcountry': 'CH', 'cf-ipcity': brut })).ville).toBe('Zürich')
  })
  it('renvoie null sans en-tête', () => {
    expect(lieuDepuisEntetes(entetes({}))).toEqual({ pays: null, ville: null })
  })
  it('ignore la ville si le pays est inconnu', () => {
    expect(lieuDepuisEntetes(entetes({ 'cf-ipcountry': 'XX', 'cf-ipcity': 'Sfax' }))).toEqual({ pays: null, ville: null })
  })
  it('refuse une ville suspecte ou trop longue', () => {
    expect(lieuDepuisEntetes(entetes({ 'cf-ipcountry': 'TN', 'cf-ipcity': '<script>' })).ville).toBeNull()
    expect(lieuDepuisEntetes(entetes({ 'cf-ipcountry': 'TN', 'cf-ipcity': 'a'.repeat(200) })).ville).toBeNull()
  })
})
