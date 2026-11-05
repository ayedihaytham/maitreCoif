import { describe, expect, it } from 'vitest'

import { attribuerPortraits, PHOTO_PLANCHE } from './portraits'
import { construireGrille } from './slots'

const DISPOS = [{ heureDebut: '10:00', heureFin: '12:00' }]

describe('construireGrille', () => {
  it('propose un créneau toutes les 30 min tant que le service tient avant la fin', () => {
    // 30 min : 10:00, 10:30, 11:00, 11:30 ; 60 min : 10:00, 10:30, 11:00 seulement
    expect(construireGrille(DISPOS, [], 30, null).map((c) => c.heure)).toEqual(['10:00', '10:30', '11:00', '11:30'])
    expect(construireGrille(DISPOS, [], 60, null).map((c) => c.heure)).toEqual(['10:00', '10:30', '11:00'])
  })

  it('marque occupé tout créneau qui chevauche un rendez-vous, mais le garde dans la grille', () => {
    const grille = construireGrille(DISPOS, [{ heureDebut: '11:00', heureFin: '11:30' }], 30, null)
    expect(grille.find((c) => c.heure === '11:00')?.libre).toBe(false)
    expect(grille.find((c) => c.heure === '10:30')?.libre).toBe(true)
    expect(grille.find((c) => c.heure === '11:30')?.libre).toBe(true)
    // un service de 60 min démarrant à 10:30 déborde sur le rendez-vous de 11:00
    expect(construireGrille(DISPOS, [{ heureDebut: '11:00', heureFin: '11:30' }], 60, null).find((c) => c.heure === '10:30')?.libre).toBe(false)
  })

  it('marque passés les créneaux de ce matin (heure courante en minutes)', () => {
    const grille = construireGrille(DISPOS, [], 30, 10 * 60 + 30) // il est 10:30
    expect(grille.map((c) => [c.heure, c.libre])).toEqual([
      ['10:00', false],
      ['10:30', false],
      ['11:00', true],
      ['11:30', true],
    ])
  })

  it('trie par heure et ne duplique pas un départ couvert par deux plages', () => {
    const grille = construireGrille(
      [
        { heureDebut: '14:00', heureFin: '15:00' },
        { heureDebut: '10:00', heureFin: '11:00' },
        { heureDebut: '10:30', heureFin: '11:30' },
      ],
      [],
      30,
      null,
    )
    const heures = grille.map((c) => c.heure)
    expect(heures).toEqual([...heures].sort())
    expect(new Set(heures).size).toBe(heures.length)
  })
})

describe('attribuerPortraits', () => {
  const m = (prenom: string, nom: string, photo: string | null) => ({ prenom, nom, photo })

  it('découpe un portrait de la planche par personne, puis passe au monogramme', () => {
    const r = attribuerPortraits([
      m('Thomas', 'Martin', PHOTO_PLANCHE),
      m('Julien', 'Moreau', PHOTO_PLANCHE),
      m('Lucas', 'Bernard', PHOTO_PLANCHE),
    ])
    expect(r.map((x) => x.portrait)).toEqual([
      { type: 'planche', position: 'tl' },
      { type: 'planche', position: 'bl' },
      { type: 'monogramme', initiales: 'LB' },
    ])
  })

  it('privilégie une vraie photo et donne un monogramme quand il n’y en a pas', () => {
    const r = attribuerPortraits([m('Ana', 'Ben', 'data:image/png;base64,AAAA'), m('Sami', 'Trabelsi', null)])
    expect(r[0].portrait).toEqual({ type: 'photo', src: 'data:image/png;base64,AAAA' })
    expect(r[1].portrait).toEqual({ type: 'monogramme', initiales: 'ST' })
  })

  it('une vraie photo ne consomme pas de portrait de la planche', () => {
    const r = attribuerPortraits([m('A', 'B', 'data:image/png;base64,AAAA'), m('C', 'D', PHOTO_PLANCHE)])
    expect(r[1].portrait).toEqual({ type: 'planche', position: 'tl' })
  })
})
