import { z } from 'zod'

export const registerSchema = z.object({
  nom: z.string().min(2).max(100),
  prenom: z.string().min(2).max(100),
  email: z.string().email(),
  telephone: z.string().max(20).optional().or(z.literal('')),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
})
