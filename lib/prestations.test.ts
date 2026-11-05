import { describe, expect, it } from 'vitest'

import { idsUniques, MAX_PRESTATIONS } from '@/lib/prestations'
import { prestationsDuRendezVous, totaux } from '@/lib/prestations-utils'

describe('totaux', () => {
  it('additionne durées et prix et joint les noms', () => {
    expect(totaux([{ nom: 'Coupe', prix: 28, duree: 30 }, { nom: 'Barbe', prix: '18.50', duree: 20 }])).toEqual({
      nom: 'Coupe + Barbe',
      prix: 46.5,
      duree: 50,
    })
  })
})

describe('idsUniques', () => {
  it('retire les doublons, les vides et limite le nombre', () => {
    expect(idsUniques('a, b,a,,c')).toEqual(['a', 'b', 'c'])
    expect(idsUniques(Array.from({ length: 9 }, (_, i) => `s${i}`))).toHaveLength(MAX_PRESTATIONS)
  })
})

describe('prestationsDuRendezVous', () => {
  const service = { nom: 'Coupe', prix: 28, duree: 30 }
  it('utilise les lignes, dans leur ordre', () => {
    const t = prestationsDuRendezVous({
      service,
      lignes: [
        { nom: 'Barbe', prix: 18, duree: 20, ordre: 1 },
        { nom: 'Coupe', prix: 28, duree: 30, ordre: 0 },
      ],
    })
    expect(t).toEqual({ nom: 'Coupe + Barbe', prix: 46, duree: 50 })
  })
  it('retombe sur le service unique sans lignes (anciens rendez-vous)', () => {
    expect(prestationsDuRendezVous({ service, lignes: [] })).toEqual({ nom: 'Coupe', prix: 28, duree: 30 })
  })
})
