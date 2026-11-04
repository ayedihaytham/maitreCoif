// Logique de réservation partagée entre la réservation publique, la saisie
// par le salon et le déplacement de rendez-vous.
import { Prisma, type RendezVous } from '@prisma/client'

import { envoyerConfirmationEmail, envoyerDeplacementEmail } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'
import { creneauEstLibre, minutesToTime, timeToMinutes } from '@/lib/slots'
import { envoyerConfirmationWhatsapp } from '@/lib/whatsapp'

/**
 * Exécute `fn` dans une transaction Serializable. Si deux requêtes
 * concurrentes entrent en conflit, Postgres en fait échouer une (P2034) :
 * on renvoie alors null, comme pour un créneau pris.
 */
async function enSerializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T | null>): Promise<T | null> {
  try {
    return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return null
    throw error
  }
}

interface NouveauRendezVous {
  codeSuivi: string
  coiffeurId: string
  serviceId: string
  dureeService: number
  clientUserId: string | null
  clientNom: string
  clientTelephone: string
  clientEmail: string | null
  date: string
  heureDebut: string
  notes: string | null
}

/** Un rendez-vous doit se terminer avant minuit (le créneau est une heure murale du jour). */
export function finitAvantMinuit(heureDebut: string, dureeMinutes: number): boolean {
  return timeToMinutes(heureDebut) + dureeMinutes <= 24 * 60
}

/** Crée un rendez-vous confirmé si le créneau est libre ; null sinon. */
export function creerRendezVousConfirme(input: NouveauRendezVous): Promise<RendezVous | null> {
  const heureFin = minutesToTime(timeToMinutes(input.heureDebut) + input.dureeService)

  return enSerializable(async (tx) => {
    if (!(await creneauEstLibre(input.coiffeurId, input.date, input.heureDebut, heureFin, undefined, tx))) return null

    return tx.rendezVous.create({
      data: {
        codeSuivi: input.codeSuivi,
        coiffeurId: input.coiffeurId,
        serviceId: input.serviceId,
        clientUserId: input.clientUserId,
        clientNom: input.clientNom,
        clientTelephone: input.clientTelephone,
        clientEmail: input.clientEmail,
        date: new Date(`${input.date}T00:00:00Z`),
        heureDebut: input.heureDebut,
        heureFin,
        notes: input.notes,
        // Confirmation automatique : le créneau est libre à cet instant.
        statut: 'CONFIRME',
      },
    })
  })
}

/**
 * Déplace un rendez-vous actif vers un autre créneau (et éventuellement un
 * autre coiffeur). Les demandes de modification en attente sont marquées
 * traitées. Renvoie null si le nouveau créneau n'est pas libre.
 */
export function deplacerRendezVous(
  rendezVous: Pick<RendezVous, 'id' | 'heureDebut' | 'heureFin' | 'coiffeurId'>,
  cible: { coiffeurId: string; date: string; heureDebut: string },
): Promise<RendezVous | null> {
  const duree = timeToMinutes(rendezVous.heureFin) - timeToMinutes(rendezVous.heureDebut)
  const heureFin = minutesToTime(timeToMinutes(cible.heureDebut) + duree)

  return enSerializable(async (tx) => {
    if (!(await creneauEstLibre(cible.coiffeurId, cible.date, cible.heureDebut, heureFin, rendezVous.id, tx))) return null

    await tx.demandeModification.updateMany({
      where: { rendezVousId: rendezVous.id, traitee: false },
      data: { traitee: true },
    })
    return tx.rendezVous.update({
      where: { id: rendezVous.id },
      data: {
        coiffeurId: cible.coiffeurId,
        date: new Date(`${cible.date}T00:00:00Z`),
        heureDebut: cible.heureDebut,
        heureFin,
        statut: 'CONFIRME',
        rappelEnvoye: false,
      },
    })
  })
}

interface DetailsNotification {
  coiffeurNom: string
  serviceNom: string
}

/** WhatsApp + email de confirmation ; un échec d'envoi ne casse jamais la réservation. */
export async function notifierConfirmation(rdv: RendezVous, details: DetailsNotification) {
  const date = rdv.date.toISOString().slice(0, 10)
  const base = { coiffeurNom: details.coiffeurNom, serviceNom: details.serviceNom, date, heureDebut: rdv.heureDebut, codeSuivi: rdv.codeSuivi }
  const envois: Promise<unknown>[] = [envoyerConfirmationWhatsapp({ to: rdv.clientTelephone, ...base })]
  if (rdv.clientEmail) envois.push(envoyerConfirmationEmail({ to: rdv.clientEmail, clientNom: rdv.clientNom, ...base }))

  for (const r of await Promise.allSettled(envois)) {
    if (r.status === 'rejected') console.error('Échec de notification de confirmation :', r.reason)
  }
}

/** Prévient le client par email que son rendez-vous a été déplacé. */
export async function notifierDeplacement(rdv: RendezVous, details: DetailsNotification) {
  if (!rdv.clientEmail) return
  await envoyerDeplacementEmail({
    to: rdv.clientEmail,
    clientNom: rdv.clientNom,
    coiffeurNom: details.coiffeurNom,
    serviceNom: details.serviceNom,
    date: rdv.date.toISOString().slice(0, 10),
    heureDebut: rdv.heureDebut,
    codeSuivi: rdv.codeSuivi,
  }).catch((e) => console.error("Échec de l'email de déplacement :", e))
}
