// Alertes internes vers l'équipe du salon (nouvelle demande de modification,
// annulation client...). Canaux 100 % gratuits, tous optionnels :
//  - Telegram : créer un bot via @BotFather (gratuit), renseigner
//    TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID (conversation ou groupe du salon) ;
//  - email : SALON_NOTIFY_EMAIL (via Resend, comme les autres emails).
// Sans aucune variable, l'alerte est simplement loggée (mode stub).
import { envoyerEmailSimple } from '@/lib/notifications'

async function envoyerTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return false

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!res.ok) throw new Error(`Telegram API error ${res.status}`)
  return true
}

/** Ne lève jamais : une alerte interne ne doit pas faire échouer l'action du client. */
export async function alerterSalon(sujet: string, message: string) {
  const email = process.env.SALON_NOTIFY_EMAIL
  const resultats = await Promise.allSettled([
    envoyerTelegram(`${sujet}\n\n${message}`),
    email ? envoyerEmailSimple(email, `Maitre Coif — ${sujet}`, message) : Promise.resolve(false),
  ])

  for (const r of resultats) {
    if (r.status === 'rejected') console.error("Échec de l'alerte salon :", r.reason)
  }
  const envoye = resultats.some((r) => r.status === 'fulfilled' && r.value !== false && (r.value as { sent?: boolean }).sent !== false)
  if (!envoye) console.log(`[alerte-salon:stub] ${sujet} — ${message}`)
}
