import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

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
  const body = `Bonjour ${details.clientNom},\n\nVotre rendez-vous est enregistré :\n- Service : ${details.serviceNom}\n- Coiffeur : ${details.coiffeurNom}\n- Date : ${details.date} à ${details.heureDebut}\n- Code de suivi : ${details.codeSuivi}\n\nSuivez votre réservation sur maitrecoif.fr/suivi avec ce code.\n\nÀ bientôt,\nL'équipe Maitre Coif`

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

export async function envoyerSms(details: SmsDetails) {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER

  if (!sid || !token || !from) {
    console.log(`[sms:stub] à ${details.to} — ${details.message}`)
    return { sent: false, stub: true }
  }

  const twilio = (await import('twilio')).default
  const client = twilio(sid, token)
  await client.messages.create({ to: details.to, from, body: details.message })
  return { sent: true, stub: false }
}
