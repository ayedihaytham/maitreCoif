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

import { envoyerConfirmationEmail, htmlRdv, texteRdv, type ContenuRdv } from './notifications'
import { lienQr } from './liens'

describe('email de rendez-vous', () => {
  const contenu: ContenuRdv = {
    apercu: 'Aperçu',
    titre: 'Votre rendez-vous est confirmé',
    intro: ['Bonjour Sami,'],
    lignes: [['Prestation', 'Coupe + Barbe'], ['Coiffeur', 'ahmed kallel']],
    codeSuivi: 'MC-ABC2345',
    action: { libelle: 'Suivre mon rendez-vous', url: 'https://exemple.test/suivi?code=MC-ABC2345' },
  }

  it('contient le QR code, le code, le détail et le bouton de suivi', () => {
    const html = htmlRdv(contenu)
    expect(html).toContain(`src="${lienQr('MC-ABC2345')}"`)
    expect(html).toContain('MC-ABC2345')
    expect(html).toContain('Coupe + Barbe')
    expect(html).toContain('href="https://exemple.test/suivi?code=MC-ABC2345"')
    expect(html).toContain('Suivre mon rendez-vous')
  })

  it('sans code de suivi, pas de QR code', () => {
    expect(htmlRdv({ ...contenu, codeSuivi: undefined })).not.toContain('/api/qr/')
  })

  it('échappe ce que le client a saisi', () => {
    const html = htmlRdv({ ...contenu, lignes: [['Demande', '<img src=x onerror=alert(1)>']] })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })

  it('a une version texte avec le lien', () => {
    const texte = texteRdv(contenu)
    expect(texte).toContain('https://exemple.test/suivi?code=MC-ABC2345')
    expect(texte).toContain('MC-ABC2345')
  })

  it('part sans clé Resend en mode stub (journalisé, jamais d’exception)', async () => {
    const r = await envoyerConfirmationEmail({ to: 'a@b.fr', clientNom: 'Sami', coiffeurNom: 'ahmed kallel', serviceNom: 'Coupe', date: '2099-01-05', heureDebut: '10:00', codeSuivi: 'MC-ABC2345' })
    expect(r).toEqual({ sent: false, stub: true })
  })
})
