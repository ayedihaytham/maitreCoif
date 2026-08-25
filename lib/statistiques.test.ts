import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getPlage } from './statistiques'

describe('getPlage', () => {
  beforeEach(() => {
    // "Aujourd'hui" fixé au 15 août 2026 pour des bornes de mois/année
    // reproductibles.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("'mois' couvre tout le mois en cours, y compris les jours à venir", () => {
    const { from, to } = getPlage('mois')
    expect(from.toISOString()).toBe('2026-08-01T00:00:00.000Z')
    // Régression : "to" doit être le dernier jour du mois, pas "aujourd'hui"
    // (sinon un rendez-vous à venir plus tard dans le mois disparaît des
    // statistiques, y compris s'il est déjà marqué "terminé").
    expect(to.toISOString()).toBe('2026-08-31T23:59:59.999Z')
  })

  it("'annee' couvre toute l'année en cours", () => {
    const { from, to } = getPlage('annee')
    expect(from.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(to.toISOString()).toBe('2026-12-31T23:59:59.999Z')
  })

  it("'semaine' couvre les 7 derniers jours jusqu'à aujourd'hui inclus", () => {
    const { from, to } = getPlage('semaine')
    expect(from.toISOString()).toBe('2026-08-09T00:00:00.000Z')
    expect(to.toISOString()).toBe('2026-08-15T23:59:59.999Z')
  })
})
