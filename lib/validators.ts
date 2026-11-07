import { z } from 'zod'

const heureSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide')

export const loginSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

export const guestBookingSchema = z.object({
  coiffeurId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).min(1, 'Choisissez au moins une prestation').max(5, '5 prestations au maximum'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
  heureDebut: heureSchema,
  clientNom: z.string().min(2, 'Nom requis').max(100),
  clientTelephone: z
    .string()
    .min(6, 'Numéro de téléphone invalide')
    .max(20)
    .regex(/^[0-9+().\s-]+$/, 'Numéro de téléphone invalide'),
  clientEmail: z.string().email('Email invalide').optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  // Honeypot anti-bot : doit rester vide, un humain ne le remplit jamais.
  website: z.string().max(0).optional().or(z.literal('')),
  // Jeton Cloudflare Turnstile (requis seulement si TURNSTILE_SECRET_KEY est défini)
  turnstileToken: z.string().max(2048).optional().or(z.literal('')),
})

export const suiviSchema = z.object({
  codeSuivi: z.string().min(4).optional(),
  telephone: z.string().min(6).optional(),
})

export const avisSchema = z.object({
  rendezVousId: z.string().uuid(),
  note: z.number().int().min(1).max(5),
  commentaire: z.string().max(1000).optional().or(z.literal('')),
})

export const serviceSchema = z.object({
  nom: z.string().min(2).max(100),
  description: z.string().max(500).optional().or(z.literal('')),
  prix: z.number().positive(),
  duree: z.number().int().positive().max(480),
  categorie: z.string().max(50).optional().or(z.literal('')),
  actif: z.boolean().optional(),
})

export const coiffeurSchema = z.object({
  nom: z.string().min(2).max(100),
  prenom: z.string().min(2).max(100),
  email: z.string().email(),
  telephone: z.string().max(20).optional().or(z.literal('')),
  bio: z.string().max(500).optional().or(z.literal('')),
  specialites: z.array(z.string()).optional(),
  role: z.enum(['COIFFEUR', 'ADMIN']).optional(),
  // data URI (image redimensionnée côté client), ~quelques centaines de Ko max
  photo: z.string().max(3_000_000).optional().or(z.literal('')),
  // désactiver / réactiver un membre
  actif: z.boolean().optional(),
  // pause déjeuner (les deux ou aucune ; '' = pas de pause), cf. erreurPause()
  pauseDebut: heureSchema.optional().or(z.literal('')).nullable(),
  pauseFin: heureSchema.optional().or(z.literal('')).nullable(),
})

/** Message d'erreur si la pause déjeuner est incohérente (une seule borne, fin avant début), sinon null. */
export function erreurPause(debut: string | null | undefined, fin: string | null | undefined): string | null {
  if (!debut && !fin) return null
  if (!debut || !fin) return 'Indiquez le début et la fin de la pause déjeuner (ou laissez les deux vides).'
  if (fin <= debut) return 'La pause déjeuner doit se terminer après son début.'
  return null
}

export const photoSalonSchema = z.object({
  url: z.string().min(10).max(3_000_000),
  legende: z.string().max(200).optional().or(z.literal('')),
})

export const disponibiliteSchema = z
  .object({
    jourSemaine: z.number().int().min(0).max(6),
    heureDebut: heureSchema,
    heureFin: heureSchema,
  })
  .refine((d) => d.heureFin > d.heureDebut, {
    message: "L'heure de fin doit être postérieure à l'heure de début",
    path: ['heureFin'],
  })

export const accountUpdateSchema = z.object({
  nom: z.string().min(2).max(100).optional(),
  prenom: z.string().min(2).max(100).optional(),
  telephone: z.string().max(20).optional().or(z.literal('')),
})

export const rendezVousStatutSchema = z.object({
  statut: z.enum(['EN_ATTENTE', 'CONFIRME', 'TERMINE', 'ANNULE']),
})

export const changeEmailSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(1, 'Mot de passe requis pour confirmer'),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: z.string().min(8, 'Le nouveau mot de passe doit contenir au moins 8 caractères'),
})

export const demandeModificationSchema = z.object({
  id: z.string().uuid(),
  codeSuivi: z.string().min(4),
  message: z.string().min(5, 'Merci de préciser votre demande').max(500),
})

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide')

// Réservation saisie par le salon (appel téléphonique, client sur place...) :
// mêmes champs que la réservation publique, sans anti-bot.
export const salonBookingSchema = z.object({
  coiffeurId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).min(1, 'Choisissez au moins une prestation').max(5, '5 prestations au maximum'),
  date: dateSchema,
  heureDebut: heureSchema,
  clientNom: z.string().min(2, 'Nom requis').max(100),
  clientTelephone: z
    .string()
    .min(6, 'Numéro de téléphone invalide')
    .max(20)
    .regex(/^[0-9+().\s-]+$/, 'Numéro de téléphone invalide'),
  clientEmail: z.string().email('Email invalide').optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
})

export const deplacementSchema = z.object({
  date: dateSchema,
  heureDebut: heureSchema,
  coiffeurId: z.string().uuid().optional(),
})

export const fermetureSchema = z
  .object({
    coiffeurId: z.string().uuid().nullable().optional(), // absent/null = tout le salon
    dateDebut: dateSchema,
    dateFin: dateSchema,
    motif: z.string().max(200).optional().or(z.literal('')),
  })
  .refine((f) => f.dateFin >= f.dateDebut, {
    message: 'La date de fin doit être égale ou postérieure à la date de début',
    path: ['dateFin'],
  })

// ───────────────────────── Boutique ─────────────────────────

export const produitSchema = z.object({
  nom: z.string().trim().min(2, 'Nom requis').max(100),
  description: z.string().max(500).optional().or(z.literal('')),
  prix: z.number().positive('Le prix doit être supérieur à 0').max(100000),
  categorie: z.string().max(50).optional().or(z.literal('')),
  stock: z.number().int('Le stock doit être un nombre entier').min(0, 'Le stock ne peut pas être négatif').max(100000),
  actif: z.boolean().optional(),
  // data URI redimensionnée côté client ; null = retirer la photo, absent = ne pas y toucher
  image: z.string().max(3_000_000).nullable().optional(),
})

const jourFacultatif = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide').optional().or(z.literal('')).nullable()

export const packSchema = z
  .object({
    nom: z.string().trim().min(2, 'Nom requis').max(100),
    description: z.string().max(500).optional().or(z.literal('')),
    remiseType: z.enum(['POURCENTAGE', 'PRIX_FIXE']),
    remiseValeur: z.number().positive('La remise doit être supérieure à 0').max(100000),
    debut: jourFacultatif,
    fin: jourFacultatif,
    actif: z.boolean().optional(),
    lignes: z
      .array(
        z.object({
          type: z.enum(['produit', 'service']),
          id: z.string().uuid(),
          quantite: z.number().int().min(1).max(20),
        }),
      )
      .min(1, 'Choisissez au moins un élément')
      .max(20, '20 éléments au maximum'),
  })
  .refine((p) => p.remiseType !== 'POURCENTAGE' || p.remiseValeur < 100, {
    message: 'La remise doit être inférieure à 100 %',
    path: ['remiseValeur'],
  })
  .refine((p) => !p.debut || !p.fin || p.fin >= p.debut, {
    message: 'La date de fin doit être égale ou postérieure à la date de début',
    path: ['fin'],
  })

const ligneDemandeeSchema = z.object({
  type: z.enum(['produit', 'pack']),
  id: z.string().uuid(),
  quantite: z.number().int().min(1).max(10),
})

export const panierSchema = z.object({
  lignes: z.array(ligneDemandeeSchema).max(30),
})

export const commandeSchema = z.object({
  clientNom: z.string().trim().min(2, 'Nom requis').max(100),
  clientTelephone: z
    .string()
    .min(6, 'Numéro de téléphone invalide')
    .max(20)
    .regex(/^[0-9+().\s-]+$/, 'Numéro de téléphone invalide'),
  clientEmail: z.string().trim().email('Email invalide'),
  retrait: z.enum(['SALON', 'RDV']),
  jourSouhaite: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().max(300).optional().or(z.literal('')),
  lignes: z.array(ligneDemandeeSchema).min(1, 'Votre panier est vide').max(30),
  // Créneau de la prestation d'un pack (obligatoire quand le panier en contient une, vérifié par le serveur)
  rendezVous: z
    .object({
      coiffeurId: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
      heureDebut: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide'),
    })
    .optional(),
  // Honeypot anti-bot : un humain ne le remplit jamais ; la route répond alors par un faux succès.
  website: z.string().max(500).optional(),
  turnstileToken: z.string().max(2048).optional().or(z.literal('')),
})

export const statutCommandeSchema = z.object({
  statut: z.enum(['PRETE', 'RETIREE', 'ANNULEE']),
})
