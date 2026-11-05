import { Resend } from 'resend'

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

const SITE_URL = (process.env.AUTH_URL || 'https://maitrecoif.fr').replace(/\/$/, '')

/** Adresse directe du suivi d'un rendez-vous : le code est déjà rempli et la recherche lancée. */
export function lienSuivi(codeSuivi: string): string {
  return `${SITE_URL}/suivi?code=${encodeURIComponent(codeSuivi)}`
}

const echapper = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Version HTML d'un email texte : mise en page sobre aux couleurs du salon et bouton d'action. */
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

interface ConfirmationDetails {
  to: string
  clientNom: string
  coiffeurNom: string
  serviceNom: string
  date: string
  heureDebut: string
  codeSuivi: string
}

export async function envoyerConfirmationEmail(details: ConfirmationDetails) {
  const subject = `Maitre Coif — Confirmation de votre rendez-vous (${details.codeSuivi})`
  const lien = lienSuivi(details.codeSuivi)
  const body = `Bonjour ${details.clientNom},\n\nVotre rendez-vous est enregistré :\n- Service : ${details.serviceNom}\n- Coiffeur : ${details.coiffeurNom}\n- Date : ${formaterDateLongue(details.date)} à ${details.heureDebut}\n- Code de suivi : ${details.codeSuivi}\n\nSuivez, modifiez ou annulez votre rendez-vous à tout moment avec ce lien :\n${lien}\n\nÀ bientôt,\nL'équipe Maitre Coif`
  return envoyerEmailSimple(details.to, subject, body, { libelle: 'Suivre mon rendez-vous', url: lien })
}

export async function envoyerResetPasswordEmail(to: string, prenom: string, resetUrl: string) {
  const subject = 'Maitre Coif — Réinitialisation de votre mot de passe'
  const body = `Bonjour ${prenom},\n\nVous avez demandé à réinitialiser votre mot de passe. Cliquez sur le lien ci-dessous (valable 1 heure) :\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\nL'équipe Maitre Coif`

  if (!resend || !process.env.RESEND_FROM) {
    console.log(`[email:stub] à ${to} — ${subject}\n${body}`)
    return { sent: false, stub: true }
  }

  await resend.emails.send({ from: process.env.RESEND_FROM, to, subject, text: body })
  return { sent: true, stub: false }
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

export async function envoyerEmailSimple(to: string, subject: string, body: string, action?: { libelle: string; url: string }) {
  if (!resend || !process.env.RESEND_FROM) {
    console.log(`[email:stub] à ${to} — ${subject}\n${body}`)
    return { sent: false, stub: true }
  }
  await resend.emails.send({ from: process.env.RESEND_FROM, to, subject, text: body, html: htmlEmail(body, action) })
  return { sent: true, stub: false }
}

interface RdvEmailDetails {
  to: string
  clientNom: string
  coiffeurNom: string
  serviceNom: string
  date: string
  heureDebut: string
  codeSuivi: string
}

export function envoyerAnnulationEmail(details: RdvEmailDetails & { parLeSalon: boolean }) {
  const subject = `Maitre Coif — Rendez-vous annulé (${details.codeSuivi})`
  const motif = details.parLeSalon
    ? "Nous sommes au regret de vous informer que votre rendez-vous a dû être annulé par le salon. N'hésitez pas à reprendre rendez-vous sur " +
      `${SITE_URL}/reservation.`
    : `Nous confirmons l'annulation de votre rendez-vous. Vous pouvez reprendre rendez-vous à tout moment sur ${SITE_URL}/reservation.`
  const body = `Bonjour ${details.clientNom},

${motif}

- Service : ${details.serviceNom}
- Coiffeur : ${details.coiffeurNom}
- Date : ${formaterDateLongue(details.date)} à ${details.heureDebut}
- Code de suivi : ${details.codeSuivi}

L'équipe Maitre Coif`
  return envoyerEmailSimple(details.to, subject, body)
}

export function envoyerRappelEmail(details: RdvEmailDetails) {
  const subject = `Maitre Coif — Rappel de votre rendez-vous demain à ${details.heureDebut}`
  const body = `Bonjour ${details.clientNom},

Petit rappel : vous avez rendez-vous demain.
- Service : ${details.serviceNom}
- Coiffeur : ${details.coiffeurNom}
- Date : ${formaterDateLongue(details.date)} à ${details.heureDebut}

Un empêchement ? Annulez ou modifiez votre rendez-vous ici :
${lienSuivi(details.codeSuivi)}

À demain,
L'équipe Maitre Coif`
  return envoyerEmailSimple(details.to, subject, body, { libelle: 'Gérer mon rendez-vous', url: lienSuivi(details.codeSuivi) })
}

export function envoyerDeplacementEmail(details: RdvEmailDetails) {
  const subject = `Maitre Coif — Votre rendez-vous a été déplacé (${details.codeSuivi})`
  const body = `Bonjour ${details.clientNom},\n\nVotre rendez-vous a été déplacé. Nouveau créneau :\n- Service : ${details.serviceNom}\n- Coiffeur : ${details.coiffeurNom}\n- Date : ${formaterDateLongue(details.date)} à ${details.heureDebut}\n\nCe créneau ne vous convient pas ? Annulez ou faites une demande ici :\n${lienSuivi(details.codeSuivi)}\n\nL'équipe Maitre Coif`
  return envoyerEmailSimple(details.to, subject, body, { libelle: 'Gérer mon rendez-vous', url: lienSuivi(details.codeSuivi) })
}
