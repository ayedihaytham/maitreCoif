import { describe, expect, it } from 'vitest'

import { formaterDateLongue, htmlEmail, lienSuivi, normaliserTelephoneTunisien } from './notifications'

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

describe('formaterDateLongue', () => {
  it('formate un jour civil en français sans décalage de fuseau', () => {
    expect(formaterDateLongue('2026-11-10')).toBe('mardi 10 novembre 2026')
  })
})

describe('lienSuivi', () => {
  it('pointe vers le suivi avec le code déjà rempli', () => {
    expect(lienSuivi('MC-ABC123')).toMatch(/\/suivi\?code=MC-ABC123$/)
  })
})

describe('htmlEmail', () => {
  it("met le lien dans un bouton et l'écrit aussi en clair", () => {
    const html = htmlEmail('Bonjour', { libelle: 'Suivre mon rendez-vous', url: 'https://exemple.test/suivi?code=MC-1' })
    expect(html).toContain('href="https://exemple.test/suivi?code=MC-1"')
    expect(html).toContain('Suivre mon rendez-vous')
    expect(html.match(/suivi\?code=MC-1/g)?.length).toBeGreaterThanOrEqual(3)
  })
  it('échappe le contenu saisi par le client', () => {
    expect(htmlEmail('<script>alert(1)</script>')).not.toContain('<script>')
  })
})
