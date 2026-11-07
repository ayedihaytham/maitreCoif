// Emails de la boutique : réservation de produits et de packs.
//   - le client reçoit une confirmation (avec QR code), un message « prête à retirer », et un message
//     d'annulation ou d'expiration ;
//   - le salon est alerté (Telegram et/ou email, cf. alerte-salon.ts) d'une nouvelle réservation ou d'une
//     annulation faite par le client.
// Les fonctions `notifier*` ne lèvent jamais d'erreur : un email qui échoue ne doit pas faire échouer la
// réservation ni le changement de statut (l'échec est écrit dans les journaux).
import { alerterSalon } from '@/lib/alerte-salon'
import { lireDetail, type CommandeComplete } from '@/lib/boutique'
import { lienBoutique, lienCommande, SITE_URL } from '@/lib/liens'
import { envoyerContenu, formaterDateLongue, type ContenuRdv } from '@/lib/notifications'
import { formatPrix } from '@/lib/utils'

type Ligne = CommandeComplete['lignes'][number]

/** Jour civil (AAAA-MM-JJ) d'un instant, à l'heure du salon. */
function jourDuSalon(d: Date): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Africa/Tunis' }).format(d)
}

const dateLongue = (d: Date) => formaterDateLongue(jourDuSalon(d))

const prixLigne = (l: Ligne) => formatPrix(Number(l.prixUnitaire) * l.quantite)

/** « Taille de barbe (prestation), Huile à barbe ×2 » : le contenu d'un pack, en une ligne. */
export function resumeContenuPack(l: Ligne): string {
  return lireDetail(l.detail)
    .map((e) => `${e.nom}${e.quantite > 1 ? ` ×${e.quantite}` : ''}${e.type === 'service' ? ' (prestation)' : ''}`)
    .join(', ')
}

export const contientPack = (c: CommandeComplete) => c.lignes.some((l) => l.type === 'PACK')

/** Prestations comprises dans les packs de la réservation : elles se réservent séparément. */
function prestationsDesPacks(c: CommandeComplete): string[] {
  return c.lignes.flatMap((l) => (l.type === 'PACK' ? lireDetail(l.detail).filter((e) => e.type === 'service').map((e) => e.nom) : []))
}

function lignesArticles(c: CommandeComplete): [string, string][] {
  const lignes: [string, string][] = []
  for (const l of c.lignes) {
    if (l.type === 'PACK') {
      lignes.push([`Pack · ${l.nom}${l.quantite > 1 ? ` ×${l.quantite}` : ''}`, prixLigne(l)])
      const contenu = resumeContenuPack(l)
      if (contenu) lignes.push(['Contient', contenu])
    } else {
      lignes.push([`${l.nom}${l.quantite > 1 ? ` ×${l.quantite}` : ''}`, prixLigne(l)])
    }
  }
  if (Number(c.economie) > 0) lignes.push(['Vous économisez', formatPrix(Number(c.economie))])
  lignes.push(['Total à régler au salon', formatPrix(Number(c.total))])
  return lignes
}

const libelleRetrait = (c: CommandeComplete) =>
  c.retrait === 'RDV' ? 'Avec votre prochain rendez-vous' : c.jourSouhaite ? `Au salon · ${c.jourSouhaite}` : 'Au salon, pendant les horaires d’ouverture'

/** « mardi 10 novembre 2026 à 10:00 avec Ahmed Kallel » : le rendez-vous réservé avec un pack, s'il y en a un. */
function texteRendezVous(c: CommandeComplete): string | null {
  const r = c.rendezVous
  return r ? `${formaterDateLongue(r.date.toISOString().slice(0, 10))} à ${r.heureDebut} avec ${r.coiffeur.prenom} ${r.coiffeur.nom}` : null
}

/** Texte « Vos articles sont gardés » : la date limite de retrait. */
const avant = (c: CommandeComplete) => dateLongue(c.expireLe)

// ───────────────────────── Contenus ─────────────────────────

export function contenuConfirmation(c: CommandeComplete): { sujet: string; contenu: ContenuRdv } {
  const packs = c.lignes.filter((l) => l.type === 'PACK')
  const sujet =
    packs.length === 1 && c.lignes.length === 1
      ? `Maitre Coif — Votre pack « ${packs[0].nom} » est réservé (${c.code})`
      : packs.length > 0
        ? `Maitre Coif — Votre réservation avec pack est enregistrée (${c.code})`
        : `Maitre Coif — Votre réservation de produits est enregistrée (${c.code})`
  const prestations = prestationsDesPacks(c)
  return {
    sujet,
    contenu: {
      apercu: `Vos articles sont gardés jusqu’au ${avant(c)} · ${formatPrix(Number(c.total))} à régler au salon`,
      titre: packs.length > 0 ? 'Votre pack est réservé' : 'Votre réservation est enregistrée',
      intro: [
        `Bonjour ${c.clientNom},`,
        `Nous mettons vos articles de côté jusqu’au ${avant(c)}. Aucun paiement n’est demandé en ligne : vous réglez au salon, au moment du retrait. Nous vous écrivons dès que votre commande est prête.`,
        ...(texteRendezVous(c)
          ? [`Votre rendez-vous est confirmé : ${texteRendezVous(c)}. Vos produits vous attendent ce jour-là ; un email de suivi vous est envoyé séparément.`]
          : prestations.length > 0
          ? [`Votre pack comprend ${prestations.length > 1 ? 'des prestations' : 'une prestation'} (${prestations.join(', ')}) : réservez le créneau de votre choix sur ${SITE_URL}/reservation.`]
          : []),
      ],
      lignes: [...lignesArticles(c), ...(texteRendezVous(c) ? ([['Rendez-vous', texteRendezVous(c)!]] as [string, string][]) : []), ['Retrait', libelleRetrait(c)], ['À retirer avant le', avant(c)]],
      codeSuivi: c.code,
      libelleCode: 'Code de réservation',
      legendeQr: 'Présentez ce code au salon pour retirer vos articles',
      action: { libelle: 'Voir ma réservation', url: lienCommande(c.code) },
      note: 'Un empêchement ? Vous pouvez annuler depuis cette page : le stock est alors remis en vente.',
    },
  }
}

export function contenuPrete(c: CommandeComplete): { sujet: string; contenu: ContenuRdv } {
  return {
    sujet: `Maitre Coif — Votre réservation est prête à être retirée (${c.code})`,
    contenu: {
      apercu: `À retirer au salon avant le ${avant(c)}`,
      titre: 'Votre réservation est prête',
      intro: [
        `Bonjour ${c.clientNom},`,
        `Bonne nouvelle : vos articles sont préparés et vous attendent au salon. Passez les retirer avant le ${avant(c)} et réglez sur place.`,
      ],
      lignes: lignesArticles(c),
      codeSuivi: c.code,
      libelleCode: 'Code de réservation',
      legendeQr: 'Présentez ce code au salon pour retirer vos articles',
      action: { libelle: 'Voir ma réservation', url: lienCommande(c.code) },
      note: 'Maitre Coif · Route Afran Km 5, Sfax.',
    },
  }
}

export function contenuAnnulation(c: CommandeComplete, parLeSalon: boolean): { sujet: string; contenu: ContenuRdv } {
  return {
    sujet: `Maitre Coif — Réservation annulée (${c.code})`,
    contenu: {
      apercu: `Votre réservation ${c.code} est annulée`,
      titre: 'Votre réservation est annulée',
      intro: [
        `Bonjour ${c.clientNom},`,
        parLeSalon
          ? 'Nous sommes au regret de vous informer que le salon a dû annuler votre réservation de produits. Nous vous prions de nous en excuser.'
          : 'Nous confirmons l’annulation de votre réservation. Les articles sont de nouveau en vente.',
        ...(c.rendezVous ? [`Le rendez-vous réservé avec ce pack (${texteRendezVous(c)}) est également annulé.`] : []),
        'Vous pouvez réserver à nouveau à tout moment.',
      ],
      lignes: lignesArticles(c).slice(0, -1).filter(([l]) => l !== 'Vous économisez'),
      action: { libelle: 'Retour à la boutique', url: lienBoutique() },
    },
  }
}

/** Rappel : il reste moins de 24 h pour retirer les articles. */
export function contenuRappel(c: CommandeComplete): { sujet: string; contenu: ContenuRdv } {
  return {
    sujet: `Maitre Coif — Plus que 24 h pour retirer vos articles (${c.code})`,
    contenu: {
      apercu: `À retirer au salon avant le ${avant(c)}`,
      titre: 'Vos articles vous attendent',
      intro: [
        `Bonjour ${c.clientNom},`,
        `Petit rappel : vos articles sont gardés à votre nom jusqu’au ${avant(c)}. Passé ce délai, la réservation expire et ils sont remis en vente.`,
        'Un empêchement ? Vous pouvez annuler depuis le lien ci-dessous.',
      ],
      lignes: lignesArticles(c),
      codeSuivi: c.code,
      libelleCode: 'Code de réservation',
      legendeQr: 'Présentez ce code au salon pour retirer vos articles',
      action: { libelle: 'Voir ma réservation', url: lienCommande(c.code) },
    },
  }
}

export function contenuExpiration(c: CommandeComplete): { sujet: string; contenu: ContenuRdv } {
  return {
    sujet: `Maitre Coif — Votre réservation a expiré (${c.code})`,
    contenu: {
      apercu: `Vos articles n’ont pas été retirés avant le ${avant(c)}`,
      titre: 'Votre réservation a expiré',
      intro: [
        `Bonjour ${c.clientNom},`,
        `Vos articles n’ayant pas été retirés avant le ${avant(c)}, ils ont été remis en vente. Si vous les souhaitez toujours, réservez-les de nouveau : c’est gratuit et immédiat.`,
      ],
      lignes: lignesArticles(c).slice(0, -1).filter(([l]) => l !== 'Vous économisez'),
      action: { libelle: 'Retour à la boutique', url: lienBoutique() },
    },
  }
}

// ───────────────────────── Envois (ne lèvent jamais) ─────────────────────────

async function envoyerAuClient(c: CommandeComplete, { sujet, contenu }: { sujet: string; contenu: ContenuRdv }, quoi: string) {
  try {
    await envoyerContenu(c.clientEmail, sujet, contenu)
  } catch (error) {
    console.error(`Échec de l'email « ${quoi} » (${c.code}) :`, error)
  }
}

/** Texte d'une alerte interne : ce que le salon doit préparer. */
function texteAlerte(c: CommandeComplete): string {
  const articles = c.lignes
    .map((l) => {
      const base = `- ${l.nom} ×${l.quantite} (${prixLigne(l)})`
      return l.type === 'PACK' ? `${base}\n   ${resumeContenuPack(l)}` : base
    })
    .join('\n')
  return [
    `${c.clientNom} · ${c.clientTelephone}${c.clientEmail ? ` · ${c.clientEmail}` : ''}`,
    articles,
    `Total : ${formatPrix(Number(c.total))}${Number(c.economie) > 0 ? ` (remise ${formatPrix(Number(c.economie))})` : ''}`,
    `Retrait : ${libelleRetrait(c)}`,
    ...(texteRendezVous(c) ? [`Rendez-vous : ${texteRendezVous(c)}`] : []),
    `Code : ${c.code} · à retirer avant le ${avant(c)}`,
  ].join('\n')
}

/** Nouvelle réservation : confirmation au client et alerte au salon. */
export async function notifierNouvelleCommande(c: CommandeComplete) {
  await Promise.all([
    envoyerAuClient(c, contenuConfirmation(c), 'confirmation'),
    alerterSalon(contientPack(c) ? 'Nouvelle réservation avec pack' : 'Nouvelle réservation de produits', texteAlerte(c)).catch((e) => console.error("Échec de l'alerte salon :", e)),
  ])
}

/** La réservation est prête : le client est prévenu par email. */
export async function notifierCommandePrete(c: CommandeComplete) {
  await envoyerAuClient(c, contenuPrete(c), 'prête')
}

/** Annulation : le client reçoit un email ; si c'est lui qui annule, le salon en est informé. */
export async function notifierAnnulationCommande(c: CommandeComplete, parLeSalon: boolean) {
  await Promise.all([
    envoyerAuClient(c, contenuAnnulation(c, parLeSalon), 'annulation'),
    parLeSalon ? Promise.resolve() : alerterSalon('Réservation de produits annulée par le client', texteAlerte(c)).catch((e) => console.error("Échec de l'alerte salon :", e)),
  ])
}

export async function notifierRappelCommande(c: CommandeComplete) {
  await envoyerAuClient(c, contenuRappel(c), 'rappel')
}

export async function notifierExpirationCommande(c: CommandeComplete) {
  await envoyerAuClient(c, contenuExpiration(c), 'expiration')
}
