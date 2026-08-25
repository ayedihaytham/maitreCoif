import { describe, expect, it } from 'vitest'

import { normaliserTelephoneTunisien } from './notifications'

describe('normaliserTelephoneTunisien', () => {
  it('ajoute l\'indicatif +216 à un numéro local à 8 chiffres', () => {
    expect(normaliserTelephoneTunisien('20130289')).toBe('+21620130289')
  })

  it('retire les espaces et tirets avant de normaliser', () => {
    expect(normaliserTelephoneTunisien('20 130 289')).toBe('+21620130289')
    expect(normaliserTelephoneTunisien('20-130-289')).toBe('+21620130289')
  })

  it('laisse un numéro déjà au format E.164 inchangé', () => {
    expect(normaliserTelephoneTunisien('+21620130289')).toBe('+21620130289')
  })

  it('convertit le préfixe international 00 en +', () => {
    expect(normaliserTelephoneTunisien('0021620130289')).toBe('+21620130289')
  })

  it('retire un zéro de tête accidentel', () => {
    expect(normaliserTelephoneTunisien('020130289')).toBe('+21620130289')
  })
})
