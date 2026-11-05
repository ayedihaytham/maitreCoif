import { describe, expect, it } from 'vitest'

import { choisirProchain, libelleJour } from '@/lib/prochain-rdv'

const r = (date: string, heureDebut: string, heureFin: string) => ({ date, heureDebut, heureFin })

describe('choisirProchain', () => {
  const liste = [r('2026-11-05', '10:00', '10:30'), r('2026-11-05', '16:30', '17:00'), r('2026-11-06', '09:00', '09:30')]

  it('ignore les rendez-vous déjà terminés', () => {
    expect(choisirProchain(liste, '2026-11-05', 16 * 60 + 19)).toEqual(liste[1])
  })
  it('garde un rendez-vous en cours', () => {
    expect(choisirProchain(liste, '2026-11-05', 16 * 60 + 40)).toEqual(liste[1])
  })
  it('passe au lendemain quand la journée est finie', () => {
    expect(choisirProchain(liste, '2026-11-05', 18 * 60)).toEqual(liste[2])
  })
  it('renvoie null quand il ne reste rien', () => {
    expect(choisirProchain(liste, '2026-11-07', 8 * 60)).toBeNull()
  })
})

describe('libelleJour', () => {
  it("dit « aujourd'hui » pour le jour courant", () => {
    expect(libelleJour('2026-11-05', '2026-11-05')).toBe("aujourd'hui")
  })
  it('donne une date courte sinon', () => {
    expect(libelleJour('2026-11-06', '2026-11-05')).toMatch(/6/)
  })
})
