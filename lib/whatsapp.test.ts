import { describe, expect, it } from 'vitest'

import { envoyerConfirmationWhatsapp } from './whatsapp'

describe('envoyerConfirmationWhatsapp', () => {
  it("reste en mode stub (aucun appel réseau) tant que les identifiants ne sont pas configurés", async () => {
    const result = await envoyerConfirmationWhatsapp({
      to: '20130289',
      coiffeurNom: 'Julien Moreau',
      serviceNom: 'Coloration',
      date: '2026-09-01',
      heureDebut: '10:00',
      codeSuivi: 'MC-TEST123',
    })
    expect(result).toEqual({ sent: false, stub: true })
  })
})
