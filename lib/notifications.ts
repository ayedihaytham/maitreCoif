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
  const body = `Bonjour ${details.clientNom},\n\nVotre rendez-vous est enregistré :\n- Service : ${details.serviceNom}\n- Coiffeur : ${details.coiffeurNom}\n- Date : ${formaterDateLongue(details.date)} à ${details.heureDebut}\n- Code de suivi : ${details.codeSuivi}\n\nSuivez ou annulez votre réservation sur ${SITE_URL}/suivi avec ce code.\n\nÀ bientôt,\nL'équipe Maitre Coif`

  if (!resend || !process.env.RESEND_FROM) {
    console.log(`[email:stub] à ${details.to} — ${subject}\n${body}`)
    return { sent: false, stub: true }
  }

  await resend.emails.send({
    from: process.env.RESEND_FROM,
    to: details.to,
    subject,
    text: body,
  })
  return { sent: true, stub: false }
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
  const message = `Maitre Coif : RDV confirme le ${formaterDateLongue(details.date)} a ${details.heureDebut} avec ${details.coiffeurNom} (${details.serviceNom}). Code de suivi : ${details.codeSuivi}. Suivi/annulation : ${SITE_URL}/suivi`
  return envoyerSms({ to: details.to, message })
}

export async function envoyerEmailSimple(to: string, subject: string, body: string) {
  if (!resend || !process.env.RESEND_FROM) {
    console.log(`[email:stub] à ${to} — ${subject}
${body}`)
    return { sent: false, stub: true }
  }
  await resend.emails.send({ from: process.env.RESEND_FROM, to, subject, text: body })
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

Un empêchement ? Annulez ou modifiez sur ${SITE_URL}/suivi avec le code ${details.codeSuivi}.

À demain,
L'équipe Maitre Coif`
  return envoyerEmailSimple(details.to, subject, body)
}

export function envoyerDeplacementEmail(details: RdvEmailDetails) {
  const subject = `Maitre Coif — Votre rendez-vous a été déplacé (${details.codeSuivi})`
  const body = `Bonjour ${details.clientNom},\n\nVotre rendez-vous a été déplacé. Nouveau créneau :\n- Service : ${details.serviceNom}\n- Coiffeur : ${details.coiffeurNom}\n- Date : ${formaterDateLongue(details.date)} à ${details.heureDebut}\n\nCe créneau ne vous convient pas ? Annulez ou faites une demande sur ${SITE_URL}/suivi avec le code ${details.codeSuivi}.\n\nL'équipe Maitre Coif`
  return envoyerEmailSimple(details.to, subject, body)
}
