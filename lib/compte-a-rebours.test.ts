import { describe, expect, it } from 'vitest'

import { decomposer, etatRendezVous, secondesAvant } from '@/lib/compte-a-rebours'

// Tunis = UTC+1 toute l'année : 16:00 UTC = 17:00 à Tunis.
const maintenant = new Date('2026-11-05T16:00:00Z')

describe('secondesAvant', () => {
  it("compte depuis l'heure murale du salon", () => {
    expect(secondesAvant('2026-11-05', '17:30', maintenant)).toBe(30 * 60)
  })
  it('passe au jour suivant', () => {
    expect(secondesAvant('2026-11-06', '09:00', maintenant)).toBe(16 * 3600)
  })
  it('est négatif une fois passé', () => {
    expect(secondesAvant('2026-11-05', '16:00', maintenant)).toBe(-3600)
  })
  it("ne dépend pas du fuseau de l'appareil (minuit côté salon)", () => {
    expect(secondesAvant('2026-11-06', '00:00', new Date('2026-11-05T22:59:00Z'))).toBe(60)
  })
})

describe('decomposer', () => {
  it('sépare jours, heures, minutes, secondes', () => {
    expect(decomposer(2 * 86_400 + 3 * 3600 + 12 * 60 + 5)).toEqual({ jours: 2, heures: 3, minutes: 12, secondes: 5 })
  })
  it('ne descend jamais sous zéro', () => {
    expect(decomposer(-5)).toEqual({ jours: 0, heures: 0, minutes: 0, secondes: 0 })
  })
})

describe('etatRendezVous', () => {
  it('avant, en cours, passé', () => {
    expect(etatRendezVous('2026-11-05', '17:30', '17:40', maintenant).etat).toBe('avant')
    expect(etatRendezVous('2026-11-05', '16:50', '17:10', maintenant).etat).toBe('en_cours')
    expect(etatRendezVous('2026-11-05', '15:00', '15:30', maintenant).etat).toBe('passe')
  })
})
