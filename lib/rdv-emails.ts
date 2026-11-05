import { envoyerNotificationCoiffeurEmail } from '@/lib/notifications'
import { prestationsDuRendezVous } from '@/lib/prestations'

interface RendezVousPourEmail {
  clientEmail: string | null
  clientNom: string
  codeSuivi: string
  date: Date
  heureDebut: string
  coiffeur: { prenom: string; nom: string }
  service: { nom: string; prix: unknown; duree: number }
  lignes?: { nom: string; prix: unknown; duree: number; ordre: number }[]
}

/** Détails communs des emails envoyés au client d'un rendez-vous ; null s'il n'a pas laissé d'email. */
export function detailsEmailClient(rdv: RendezVousPourEmail) {
  if (!rdv.clientEmail) return null
  return {
    to: rdv.clientEmail,
    clientNom: rdv.clientNom,
    coiffeurNom: `${rdv.coiffeur.prenom} ${rdv.coiffeur.nom}`,
    serviceNom: prestationsDuRendezVous(rdv).nom,
    date: rdv.date.toISOString().slice(0, 10),
    heureDebut: rdv.heureDebut,
    codeSuivi: rdv.codeSuivi,
  }
}

interface RendezVousPourCoiffeur {
  clientNom: string
  clientTelephone: string
  clientEmail: string | null
  date: Date
  heureDebut: string
  coiffeur: { prenom: string; email: string; actif: boolean }
  service: { nom: string; prix: unknown; duree: number }
  lignes?: { nom: string; prix: unknown; duree: number; ordre: number }[]
}

/**
 * Prévient par email le coiffeur choisi par le client. Ne lève jamais : une panne d'envoi ne doit pas
 * faire échouer l'action du client. N'écrit pas au coiffeur s'il est désactivé, ni s'il reçoit déjà
 * l'alerte du salon à la même adresse (SALON_NOTIFY_EMAIL) : il n'aurait pas deux courriers identiques.
 */
export async function prevenirCoiffeur(rdv: RendezVousPourCoiffeur, evenement: 'annulation' | 'modification', message?: string) {
  const { coiffeur } = rdv
  if (!coiffeur.actif || !coiffeur.email) return
  if (process.env.SALON_NOTIFY_EMAIL?.trim().toLowerCase() === coiffeur.email.toLowerCase()) return
  try {
    await envoyerNotificationCoiffeurEmail({
      to: coiffeur.email,
      coiffeurPrenom: coiffeur.prenom,
      evenement,
      clientNom: rdv.clientNom,
      clientTelephone: rdv.clientTelephone,
      clientEmail: rdv.clientEmail,
      serviceNom: prestationsDuRendezVous(rdv).nom,
      date: rdv.date.toISOString().slice(0, 10),
      heureDebut: rdv.heureDebut,
      message,
    })
  } catch (error) {
    console.error(`Échec de l'email au coiffeur (${evenement}) :`, error)
  }
}
