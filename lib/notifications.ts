import { Resend } from 'resend'

import { lienPlanning, lienQr, lienSuivi, SITE_URL } from '@/lib/liens'

export { lienSuivi } from '@/lib/liens'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

/** "2026-11-10" -> "mardi 10 novembre 2026" (jour civil, sans conversion de fuseau). */
export function formaterDateLongue(dateISO: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateISO}T00:00:00Z`))
}

// ───────────────────────── Envoi (Resend) ─────────────────────────

interface Courrier {
  to: string
  subject: string
  text: string
  html: string
}

/**
 * Envoie un email via Resend. L'API de Resend ne lève pas d'exception en cas de refus (domaine non
 * vérifié, clé invalide...) : elle renvoie un champ `error`, qu'on transforme ici en erreur pour
 * qu'elle soit visible dans les journaux au lieu de passer inaperçue.
 */
async function expedier({ to, subject, text, html }: Courrier) {
  if (!resend || !process.env.RESEND_FROM) {
    console.log(`[email:stub] à ${to} — ${subject}\n${text}`)
    return { sent: false, stub: true }
  }
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM,
    to,
    subject,
    text,
    html,
    ...(process.env.RESEND_REPLY_TO ? { replyTo: process.env.RESEND_REPLY_TO } : {}),
  })
  if (error) throw new Error(`Resend a refusé l'email « ${subject} » : ${error.name} — ${error.message}`)
  return { sent: true, stub: false }
}

// ───────────────────────── Gabarits ─────────────────────────

const echapper = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Version HTML d'un email texte simple : mise en page sobre aux couleurs du salon et bouton d'action. */
export function htmlEmail(texte: string, action?: { libelle: string; url: string }): string {
  const paragraphes = texte
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${echapper(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
  const bouton = action
    ? `<p style="margin:24px 0"><a href="${echapper(action.url)}" style="display:inline-block;padding:14px 26px;background:#d4af37;color:#0a0a0a;text-decoration:none;font-weight:bold;font-size:13px;letter-spacing:.12em;text-transform:uppercase">${echapper(action.libelle)}</a></p><p style="margin:0 0 8px;font-size:12px;color:#6a655a;word-break:break-all">Le bouton ne s'affiche pas ? Copiez ce lien dans votre navigateur :<br><a href="${echapper(action.url)}" style="color:#7d5f08">${echapper(action.url)}</a></p>`
    : ''
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f6f3ec;font-family:Arial,Helvetica,sans-serif;color:#1b1915"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 14px"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e4dfd2"><tr><td style="padding:22px 30px;border-bottom:3px solid #d4af37;font-size:13px;font-weight:bold;letter-spacing:.22em;text-transform:uppercase">Maitre Coif</td></tr><tr><td style="padding:28px 30px;font-size:15px;line-height:1.6">${paragraphes}${bouton}</td></tr></table></td></tr></table></body></html>`
}

/** Contenu d'un email de rendez-vous (client ou coiffeur). */
export interface ContenuRdv {
  /** Texte d'aperçu affiché par la messagerie à côté de l'objet. */
  apercu: string
  titre: string
  /** Paragraphes d'introduction. */
  intro: string[]
  /** Lignes « libellé : valeur » du rendez-vous. */
  lignes: [string, string][]
  /** Affiche le QR code et le code de suivi. */
  codeSuivi?: string
  /** Libellés propres à une réservation de produits (par défaut : ceux d'un rendez-vous). */
  libelleCode?: string
  legendeQr?: string
  action?: { libelle: string; url: string }
  /** Petit texte sous le bouton. */
  note?: string
}

const COULEUR_OR = '#d4af37'

/** Version texte : toujours jointe, pour les messageries qui n'affichent pas le HTML. */
export function texteRdv(c: ContenuRdv): string {
  const parties = [c.titre, ...c.intro, c.lignes.map(([l, v]) => `- ${l} : ${v}`).join('\n')]
  if (c.codeSuivi) parties.push(`${c.libelleCode ?? 'Code de suivi'} : ${c.codeSuivi}`)
  if (c.action) parties.push(`${c.action.libelle} :\n${c.action.url}`)
  if (c.note) parties.push(c.note)
  parties.push("L'équipe Maitre Coif")
  return parties.filter(Boolean).join('\n\n')
}

/**
 * Email de rendez-vous : bandeau sombre, titre, détails, QR code (facultatif) et bouton.
 * Mise en page en tableaux et styles en ligne : c'est ce que tous les clients de messagerie comprennent.
 */
export function htmlRdv(c: ContenuRdv): string {
  const intro = c.intro.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#3b372f">${echapper(p).replace(/\n/g, '<br>')}</p>`).join('')
  const lignes = c.lignes
    .map(
      ([l, v]) =>
        `<tr><td style="padding:11px 0;border-bottom:1px solid #ece7db;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6a655a;width:38%;vertical-align:top">${echapper(l)}</td><td style="padding:11px 0;border-bottom:1px solid #ece7db;font-size:15px;font-weight:bold;color:#1b1915;vertical-align:top">${echapper(v)}</td></tr>`,
    )
    .join('')
  const qr = c.codeSuivi
    ? `<tr><td align="center" style="padding:26px 30px 6px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:14px;background:#ffffff;border:1px solid #d9d3c4"><img src="${echapper(lienQr(c.codeSuivi))}" width="168" height="168" alt="QR code de votre ${c.codeSuivi.startsWith('PR-') ? 'réservation' : 'rendez-vous'} ${echapper(c.codeSuivi)}" style="display:block;width:168px;height:168px;border:0"></td></tr></table><p style="margin:14px 0 4px;font-size:12px;color:#6a655a">${echapper(c.legendeQr ?? 'Scannez ce code pour suivre votre rendez-vous')}</p><p style="margin:0;font-size:20px;font-weight:bold;letter-spacing:.2em;color:#1b1915;font-family:'Courier New',monospace">${echapper(c.codeSuivi)}</p></td></tr>`
    : ''
  const action = c.action
    ? `<tr><td align="center" style="padding:24px 30px 6px"><a href="${echapper(c.action.url)}" style="display:inline-block;padding:16px 34px;background:${COULEUR_OR};color:#0a0a0a;text-decoration:none;font-weight:bold;font-size:13px;letter-spacing:.14em;text-transform:uppercase">${echapper(c.action.libelle)}</a><p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#6a655a;word-break:break-all">Le bouton ne s'affiche pas ? Copiez ce lien :<br><a href="${echapper(c.action.url)}" style="color:#7d5f08">${echapper(c.action.url)}</a></p></td></tr>`
    : ''
  const note = c.note ? `<tr><td style="padding:14px 30px 0;font-size:13px;line-height:1.6;color:#6a655a;text-align:center">${echapper(c.note)}</td></tr>` : ''

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${echapper(c.titre)}</title></head><body style="margin:0;padding:0;background:#f6f3ec;font-family:Arial,Helvetica,sans-serif;color:#1b1915"><div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#f6f3ec">${echapper(c.apercu)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ec"><tr><td align="center" style="padding:26px 12px"><table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#ffffff;border:1px solid #e4dfd2"><tr><td align="center" style="padding:26px 30px;background:#0a0a0a;border-bottom:3px solid ${COULEUR_OR}"><span style="font-size:17px;font-weight:bold;letter-spacing:.34em;text-transform:uppercase;color:${COULEUR_OR}">Maitre Coif</span><br><span style="font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:#a09d96">Salon de coiffure &amp; barbier</span></td></tr><tr><td style="padding:32px 30px 8px"><h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#1b1915">${echapper(c.titre)}</h1>${intro}</td></tr><tr><td style="padding:6px 30px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ece7db">${lignes}</table></td></tr>${qr}${action}${note}<tr><td style="padding:30px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ece7db"><tr><td align="center" style="padding-top:18px;font-size:12px;line-height:1.7;color:#6a655a">Maitre Coif · Route Afran Km 5, Sfax<br>Mardi — Samedi · 10h00 — 20h30 · Sur rendez-vous<br><a href="${echapper(SITE_URL)}" style="color:#7d5f08">${echapper(SITE_URL.replace(/^https?:\/\//, ''))}</a></td></tr></table></td></tr></table></td></tr></table></body></html>`
}

async function envoyerRdv(to: string, subject: string, contenu: ContenuRdv) {
  return expedier({ to, subject, text: texteRdv(contenu), html: htmlRdv(contenu) })
}

/** Envoie un email mis en page comme ceux des rendez-vous (utilisé par la boutique). */
export const envoyerContenu = envoyerRdv

// ───────────────────────── Emails au client ─────────────────────────

interface RdvEmailDetails {
  to: string
  clientNom: string
  coiffeurNom: string
  serviceNom: string
  date: string
  heureDebut: string
  codeSuivi: string
}

const lignesRdv = (d: RdvEmailDetails): [string, string][] => [
  ['Prestation', d.serviceNom],
  ['Coiffeur', d.coiffeurNom],
  ['Date', formaterDateLongue(d.date)],
  ['Heure', d.heureDebut],
]

/** Confirmation (réservation en ligne ou rendez-vous confirmé par le salon) : détails, QR code et bouton de suivi. */
export function envoyerConfirmationEmail(details: RdvEmailDetails) {
  return envoyerRdv(details.to, `Maitre Coif — Votre rendez-vous est confirmé (${details.codeSuivi})`, {
    apercu: `${formaterDateLongue(details.date)} à ${details.heureDebut} avec ${details.coiffeurNom}`,
    titre: 'Votre rendez-vous est confirmé',
    intro: [`Bonjour ${details.clientNom},`, 'Votre rendez-vous est bien enregistré. Conservez cet email : le QR code ci-dessous vous permet de le retrouver en un instant.'],
    lignes: lignesRdv(details),
    codeSuivi: details.codeSuivi,
    action: { libelle: 'Suivre mon rendez-vous', url: lienSuivi(details.codeSuivi) },
    note: "Vous pouvez l'annuler ou demander une modification depuis cette page, jusqu'à 2 h avant l'heure prévue.",
  })
}

/** Le rendez-vous a été annulé (par le salon ou par le client lui-même). */
export function envoyerAnnulationEmail(details: RdvEmailDetails & { parLeSalon: boolean }) {
  return envoyerRdv(details.to, `Maitre Coif — Rendez-vous annulé (${details.codeSuivi})`, {
    apercu: `Votre rendez-vous du ${formaterDateLongue(details.date)} est annulé`,
    titre: 'Votre rendez-vous est annulé',
    intro: [
      `Bonjour ${details.clientNom},`,
      details.parLeSalon
        ? "Nous sommes au regret de vous informer que votre rendez-vous a dû être annulé par le salon. Nous vous prions de nous en excuser."
        : "Nous confirmons l'annulation de votre rendez-vous.",
      'Le créneau est de nouveau libre : vous pouvez reprendre rendez-vous à tout moment.',
    ],
    lignes: lignesRdv(details),
    action: { libelle: 'Reprendre rendez-vous', url: `${SITE_URL}/reservation` },
  })
}

/** Rappel envoyé la veille. */
export function envoyerRappelEmail(details: RdvEmailDetails) {
  return envoyerRdv(details.to, `Maitre Coif — Rappel de votre rendez-vous demain à ${details.heureDebut}`, {
    apercu: `Demain à ${details.heureDebut} avec ${details.coiffeurNom}`,
    titre: 'Votre rendez-vous, c’est demain',
    intro: [`Bonjour ${details.clientNom},`, 'Un petit rappel de votre rendez-vous. Un empêchement ? Annulez ou modifiez-le depuis le lien ci-dessous.'],
    lignes: lignesRdv(details),
    codeSuivi: details.codeSuivi,
    action: { libelle: 'Gérer mon rendez-vous', url: lienSuivi(details.codeSuivi) },
  })
}

/** Le salon a déplacé le rendez-vous. */
export function envoyerDeplacementEmail(details: RdvEmailDetails) {
  return envoyerRdv(details.to, `Maitre Coif — Votre rendez-vous a été déplacé (${details.codeSuivi})`, {
    apercu: `Nouveau créneau : ${formaterDateLongue(details.date)} à ${details.heureDebut}`,
    titre: 'Votre rendez-vous a été déplacé',
    intro: [`Bonjour ${details.clientNom},`, 'Le salon a dû déplacer votre rendez-vous. Voici votre nouveau créneau. Il ne vous convient pas ? Annulez-le ou faites une demande depuis le lien ci-dessous.'],
    lignes: lignesRdv(details),
    codeSuivi: details.codeSuivi,
    action: { libelle: 'Gérer mon rendez-vous', url: lienSuivi(details.codeSuivi) },
  })
}

/** Le rendez-vous est terminé (marqué par le salon ou passé automatiquement) : remerciement. */
export function envoyerTermineEmail(details: RdvEmailDetails) {
  return envoyerRdv(details.to, `Maitre Coif — Merci de votre visite (${details.codeSuivi})`, {
    apercu: `Merci d'être venu le ${formaterDateLongue(details.date)}`,
    titre: 'Merci de votre visite',
    intro: [`Bonjour ${details.clientNom},`, 'Votre rendez-vous est terminé. Merci de votre confiance : nous espérons que le résultat vous plaît, et nous serons ravis de vous retrouver bientôt.'],
    lignes: lignesRdv(details),
    action: { libelle: 'Reprendre rendez-vous', url: `${SITE_URL}/reservation` },
  })
}

// ───────────────────────── Emails au coiffeur ─────────────────────────

interface NotificationCoiffeur {
  to: string
  coiffeurPrenom: string
  /** Ce que le client vient de faire. */
  evenement: 'annulation' | 'modification'
  clientNom: string
  clientTelephone: string
  clientEmail?: string | null
  serviceNom: string
  date: string
  heureDebut: string
  /** Texte de la demande de modification. */
  message?: string
}

/** Prévient le coiffeur choisi par le client qu'un de ses rendez-vous est annulé ou que le client demande à le modifier. */
export function envoyerNotificationCoiffeurEmail(d: NotificationCoiffeur) {
  const annulation = d.evenement === 'annulation'
  const lignes: [string, string][] = [
    ['Client', d.clientNom],
    ['Téléphone', d.clientTelephone],
    ...(d.clientEmail ? ([['Email', d.clientEmail]] as [string, string][]) : []),
    ['Prestation', d.serviceNom],
    ['Date', formaterDateLongue(d.date)],
    ['Heure', d.heureDebut],
    ...(d.message ? ([['Demande', d.message]] as [string, string][]) : []),
  ]
  const planning = lienPlanning()
  return envoyerRdv(
    d.to,
    annulation
      ? `Maitre Coif — ${d.clientNom} a annulé son rendez-vous du ${formaterDateLongue(d.date)}`
      : `Maitre Coif — ${d.clientNom} demande à modifier son rendez-vous`,
    {
      apercu: annulation ? `Le créneau de ${d.heureDebut} est de nouveau libre` : `Demande de modification pour le ${formaterDateLongue(d.date)} à ${d.heureDebut}`,
      titre: annulation ? 'Un rendez-vous a été annulé' : 'Demande de modification',
      intro: [
        `Bonjour ${d.coiffeurPrenom},`,
        annulation
          ? 'Un client vient d’annuler un rendez-vous pris avec vous. Le créneau est de nouveau libre.'
          : 'Un client souhaite modifier un rendez-vous pris avec vous. Son rendez-vous reste confirmé à l’horaire initial tant que vous ne l’avez pas déplacé (bouton « Déplacer » du planning).',
      ],
      lignes,
      ...(planning ? { action: { libelle: 'Ouvrir le planning', url: planning } } : {}),
    },
  )
}

// ───────────────────────── Autres envois ─────────────────────────

export function envoyerResetPasswordEmail(to: string, prenom: string, resetUrl: string) {
  return envoyerRdv(to, 'Maitre Coif — Réinitialisation de votre mot de passe', {
    apercu: 'Lien valable 1 heure',
    titre: 'Réinitialisation de votre mot de passe',
    intro: [`Bonjour ${prenom},`, "Vous avez demandé à réinitialiser votre mot de passe. Le lien ci-dessous est valable 1 heure.", "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email."],
    lignes: [],
    action: { libelle: 'Choisir un nouveau mot de passe', url: resetUrl },
  })
}

/** Email texte simple (alertes internes au salon). */
export function envoyerEmailSimple(to: string, subject: string, body: string, action?: { libelle: string; url: string }) {
  return expedier({ to, subject, text: body, html: htmlEmail(body, action) })
}

interface SmsDetails {
  to: string
  message: string
}

// Les numéros tunisiens sont saisis sur 8 chiffres sans indicatif ; Twilio
// exige le format E.164 (+216XXXXXXXX).
export function normaliserTelephoneTunisien(tel: string): string {
  const digits = tel.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('00')) return `+${digits.slice(2)}`
  return `+216${digits.replace(/^0+/, '')}`
}

export async function envoyerSms(details: SmsDetails) {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER
  const to = normaliserTelephoneTunisien(details.to)

  if (!sid || !token || !from) {
    console.log(`[sms:stub] à ${to} — ${details.message}`)
    return { sent: false, stub: true }
  }

  const twilio = (await import('twilio')).default
  const client = twilio(sid, token)
  await client.messages.create({ to, from, body: details.message })
  return { sent: true, stub: false }
}

interface ConfirmationSmsDetails {
  to: string
  coiffeurNom: string
  serviceNom: string
  date: string
  heureDebut: string
  codeSuivi: string
}

export async function envoyerConfirmationSms(details: ConfirmationSmsDetails) {
  const message = `Maitre Coif : RDV confirme le ${formaterDateLongue(details.date)} a ${details.heureDebut} avec ${details.coiffeurNom} (${details.serviceNom}). Code de suivi : ${details.codeSuivi}. Suivi/annulation : ${lienSuivi(details.codeSuivi)}`
  return envoyerSms({ to: details.to, message })
}
