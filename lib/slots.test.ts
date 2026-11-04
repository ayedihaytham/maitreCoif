import { describe, expect, it } from 'vitest'

import { estDatePassee, heuresAvantRendezVous, maintenantSalon, minutesToTime, timeToMinutes } from './slots'

describe('timeToMinutes', () => {
  it('convertit une heure en minutes depuis minuit', () => {
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('10:00')).toBe(600)
    expect(timeToMinutes('19:30')).toBe(1170)
    expect(timeToMinutes('23:59')).toBe(1439)
  })
})

describe('minutesToTime', () => {
  it('convertit des minutes en heure HH:MM avec zéro de tête', () => {
    expect(minutesToTime(0)).toBe('00:00')
    expect(minutesToTime(600)).toBe('10:00')
    expect(minutesToTime(605)).toBe('10:05')
    expect(minutesToTime(1439)).toBe('23:59')
  })

  it('est l\'inverse exact de timeToMinutes', () => {
    for (const time of ['09:00', '13:45', '19:30', '23:59']) {
      expect(minutesToTime(timeToMinutes(time))).toBe(time)
    }
  })
})

describe('maintenantSalon (fuseau Africa/Tunis, UTC+1)', () => {
  it('passe au jour suivant dès 23h UTC', () => {
    // 23:30 UTC le 10 = 00:30 le 11 à Tunis
    expect(maintenantSalon(new Date('2026-11-10T23:30:00Z'))).toEqual({ dateISO: '2026-11-11', minutes: 30 })
  })

  it("décale l'heure d'une heure par rapport à UTC", () => {
    expect(maintenantSalon(new Date('2026-11-10T09:15:00Z'))).toEqual({ dateISO: '2026-11-10', minutes: 10 * 60 + 15 })
  })
})

describe('estDatePassee', () => {
  const now = new Date('2026-11-10T23:30:00Z') // 11 novembre 00:30 à Tunis

  it("considère le 10 novembre comme passé alors qu'il est déjà le 11 à Tunis", () => {
    expect(estDatePassee('2026-11-10', now)).toBe(true)
  })

  it("ne considère pas le jour courant à Tunis comme passé", () => {
    expect(estDatePassee('2026-11-11', now)).toBe(false)
  })

  it('ne détecte pas une date future comme passée', () => {
    expect(estDatePassee('2026-11-12', now)).toBe(false)
  })
})

describe('heuresAvantRendezVous', () => {
  const now = new Date('2026-11-10T08:00:00Z') // 09:00 à Tunis

  it('mesure en heure locale du salon, pas en UTC', () => {
    expect(heuresAvantRendezVous('2026-11-10', '11:00', now)).toBe(2)
  })

  it('est négatif pour un rendez-vous passé', () => {
    expect(heuresAvantRendezVous('2026-11-10', '08:00', now)).toBe(-1)
  })

  it('gère le passage au jour suivant', () => {
    expect(heuresAvantRendezVous('2026-11-11', '09:00', now)).toBe(24)
  })
})
