import { describe, expect, it } from 'vitest'

import { resumerHoraires } from '@/lib/horaires'

const d = (jourSemaine: number, heureDebut = '10:00', heureFin = '20:30') => ({ jourSemaine, heureDebut, heureFin })

describe('resumerHoraires', () => {
  it('regroupe les jours consécutifs, dimanche compris (la semaine finit le dimanche)', () => {
    expect(resumerHoraires([2, 3, 4, 5, 6, 0].map((j) => d(j)))).toEqual([{ jours: 'Mardi — Dimanche', heures: '10h00 — 20h30' }])
  })

  it('prend l’ouverture la plus tôt et la fermeture la plus tard de l’équipe', () => {
    expect(resumerHoraires([d(2, '10:00', '18:00'), d(2, '09:30', '19:30')])).toEqual([{ jours: 'Mardi', heures: '09h30 — 19h30' }])
  })

  it('sépare les jours aux horaires différents et garde l’ordre de la semaine', () => {
    expect(resumerHoraires([d(0, '10:00', '14:00'), d(2), d(3), d(4)])).toEqual([
      { jours: 'Mardi — Jeudi', heures: '10h00 — 20h30' },
      { jours: 'Dimanche', heures: '10h00 — 14h00' },
    ])
  })

  it('aucune disponibilité : rien à afficher', () => {
    expect(resumerHoraires([])).toEqual([])
  })
})
