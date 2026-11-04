import { formaterDateLongue, normaliserTelephoneTunisien } from '@/lib/notifications'

interface ConfirmationWhatsappDetails {
  to: string
  coiffeurNom: string
  serviceNom: string
  date: string
  heureDebut: string
  codeSuivi: string
}

// Message business-initié : WhatsApp exige un modèle pré-approuvé (impossible
// d'envoyer du texte libre hors fenêtre de conversation ouverte par le
// client). Le modèle "confirmation_rdv" doit être créé et approuvé dans
// WhatsApp Manager avec exactement 5 variables, dans cet ordre :
// {{1}} date, {{2}} heure, {{3}} coiffeur, {{4}} service, {{5}} code de suivi.
export function envoyerConfirmationWhatsapp(details: ConfirmationWhatsappDetails) {
  return envoyerModeleWhatsapp(process.env.WHATSAPP_TEMPLATE_NAME || 'confirmation_rdv', 'confirmé', details)
}

// Rappel J-1 : modèle "rappel_rdv" à créer/approuver avec les mêmes 5
// variables que la confirmation, dans le même ordre.
export function envoyerRappelWhatsapp(details: ConfirmationWhatsappDetails) {
  return envoyerModeleWhatsapp(process.env.WHATSAPP_REMINDER_TEMPLATE_NAME || 'rappel_rdv', 'rappel', details)
}

async function envoyerModeleWhatsapp(templateName: string, libelle: string, details: ConfirmationWhatsappDetails) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const dateLongue = formaterDateLongue(details.date)
  const to = normaliserTelephoneTunisien(details.to).replace('+', '')

  if (!token || !phoneNumberId) {
    console.log(
      `[whatsapp:stub] à ${to} — RDV (${libelle}) le ${dateLongue} à ${details.heureDebut} avec ${details.coiffeurNom} (${details.serviceNom}), code ${details.codeSuivi}`,
    )
    return { sent: false, stub: true }
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'fr' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: dateLongue },
              { type: 'text', text: details.heureDebut },
              { type: 'text', text: details.coiffeurNom },
              { type: 'text', text: details.serviceNom },
              { type: 'text', text: details.codeSuivi },
            ],
          },
        ],
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`WhatsApp API error ${res.status}: ${body}`)
  }

  return { sent: true, stub: false }
}
