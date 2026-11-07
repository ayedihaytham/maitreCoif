// Adresses publiques utilisées dans les emails, SMS et QR codes.
import { SALON_HOST, salonUrl, siteUrl } from '@/lib/salon-host'

/** Adresse du site public, sans « / » final. AUTH_URL en priorité, sinon déduite du sous-domaine du salon. */
export const SITE_URL = (process.env.AUTH_URL || (SALON_HOST ? siteUrl('') : '') || 'https://maitrecoif.fr').replace(/\/$/, '')

/** Adresse directe du suivi d'un rendez-vous : le code est déjà rempli et la recherche lancée. */
export function lienSuivi(codeSuivi: string): string {
  return `${SITE_URL}/suivi?code=${encodeURIComponent(codeSuivi)}`
}

/** Image PNG du QR code d'un rendez-vous (MC-...) ou d'une réservation de produits (PR-...) : cf. app/api/qr/[code]/route.ts. */
export function lienQr(codeSuivi: string): string {
  return `${SITE_URL}/api/qr/${encodeURIComponent(codeSuivi)}`
}

/** Page d'une réservation de produits : le code est dans l'adresse. */
export function lienCommande(code: string): string {
  return `${SITE_URL}/boutique/commande/${encodeURIComponent(code)}`
}

/** Boutique du site (catalogue). */
export function lienBoutique(vue?: 'packs'): string {
  return `${SITE_URL}/boutique${vue ? `?vue=${vue}` : ''}`
}

/** Planning du back-office (absolu), ou null quand le sous-domaine du salon n'est pas configuré. */
export function lienPlanning(): string | null {
  const url = salonUrl('/planning')
  return url.startsWith('http') ? url : null
}

/** Un code de suivi valide : « MC- » suivi de 4 à 12 caractères de l'alphabet des codes. */
export const CODE_SUIVI_VALIDE = /^MC-[A-Z0-9]{4,12}$/

/** Un code de réservation de produits valide : « PR- » suivi de 4 à 12 caractères. */
export const CODE_COMMANDE_VALIDE = /^PR-[A-Z0-9]{4,12}$/
