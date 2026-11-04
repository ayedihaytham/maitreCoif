import { describe, expect, it } from 'vitest'

import { changePasswordSchema, deplacementSchema, disponibiliteSchema, fermetureSchema, guestBookingSchema } from './validators'

const validBooking = {
  coiffeurId: '11111111-1111-1111-1111-111111111111',
  serviceId: '22222222-2222-2222-2222-222222222222',
  date: '2026-09-01',
  heureDebut: '10:00',
  clientNom: 'Ahmed Kallel',
  clientTelephone: '20130289',
}

describe('guestBookingSchema', () => {
  it('accepte une réservation valide sans email ni note', () => {
    expect(guestBookingSchema.safeParse(validBooking).success).toBe(true)
  })

  it('rejette un email mal formé', () => {
    const result = guestBookingSchema.safeParse({ ...validBooking, clientEmail: 'pas-un-email' })
    expect(result.success).toBe(false)
  })

  it('rejette un numéro de téléphone trop court ou invalide', () => {
    expect(guestBookingSchema.safeParse({ ...validBooking, clientTelephone: '123' }).success).toBe(false)
    expect(guestBookingSchema.safeParse({ ...validBooking, clientTelephone: 'abcde12345' }).success).toBe(false)
  })

  it('rejette une soumission avec le champ honeypot rempli', () => {
    const result = guestBookingSchema.safeParse({ ...validBooking, website: 'http://spam.example' })
    expect(result.success).toBe(false)
  })

  it('rejette une date ou une heure mal formée', () => {
    expect(guestBookingSchema.safeParse({ ...validBooking, date: '01/09/2026' }).success).toBe(false)
    expect(guestBookingSchema.safeParse({ ...validBooking, heureDebut: '10h00' }).success).toBe(false)
  })
})

describe('changePasswordSchema', () => {
  it('exige un nouveau mot de passe d\'au moins 8 caractères', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'x', newPassword: 'short' }).success).toBe(false)
    expect(changePasswordSchema.safeParse({ currentPassword: 'x', newPassword: 'longenough' }).success).toBe(true)
  })
})

describe('disponibiliteSchema', () => {
  const base = { jourSemaine: 2, heureDebut: '09:00', heureFin: '18:00' }

  it('accepte une plage valide', () => {
    expect(disponibiliteSchema.safeParse(base).success).toBe(true)
  })

  it('rejette une fin antérieure ou égale au début', () => {
    expect(disponibiliteSchema.safeParse({ ...base, heureFin: '09:00' }).success).toBe(false)
    expect(disponibiliteSchema.safeParse({ ...base, heureFin: '08:00' }).success).toBe(false)
  })

  it('rejette des heures impossibles', () => {
    expect(disponibiliteSchema.safeParse({ ...base, heureFin: '99:99' }).success).toBe(false)
    expect(disponibiliteSchema.safeParse({ ...base, heureDebut: '24:00' }).success).toBe(false)
  })
})

describe('fermetureSchema', () => {
  it('accepte une fermeture du salon ou d’un coiffeur', () => {
    expect(fermetureSchema.safeParse({ dateDebut: '2026-12-25', dateFin: '2026-12-25' }).success).toBe(true)
    expect(
      fermetureSchema.safeParse({ coiffeurId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', dateDebut: '2026-08-01', dateFin: '2026-08-15', motif: 'Congés' }).success,
    ).toBe(true)
  })

  it('rejette une fin antérieure au début', () => {
    expect(fermetureSchema.safeParse({ dateDebut: '2026-12-25', dateFin: '2026-12-24' }).success).toBe(false)
  })
})

describe('deplacementSchema', () => {
  it('exige une date et une heure valides', () => {
    expect(deplacementSchema.safeParse({ date: '2026-12-01', heureDebut: '10:30' }).success).toBe(true)
    expect(deplacementSchema.safeParse({ date: '1er décembre', heureDebut: '10:30' }).success).toBe(false)
    expect(deplacementSchema.safeParse({ date: '2026-12-01', heureDebut: '25:00' }).success).toBe(false)
  })
})
