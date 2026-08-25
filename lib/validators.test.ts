import { describe, expect, it } from 'vitest'

import { changePasswordSchema, guestBookingSchema } from './validators'

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
