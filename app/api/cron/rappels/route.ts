import { NextResponse } from 'next/server'

import { envoyerRappelEmail } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'
import { maintenantSalon } from '@/lib/slots'
import { envoyerRappelWhatsapp } from '@/lib/whatsapp'

// Appelée une fois par jour par Vercel Cron (cf. vercel.json). Vercel envoie
// `Authorization: Bearer $CRON_SECRET` ; sans ce secret, la route est fermée.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 401 })
  }

  // Rendez-vous de demain (jour civil du salon), confirmés, pas encore rappelés.
  const { dateISO: aujourdhui } = maintenantSalon()
  const demain = new Date(`${aujourdhui}T00:00:00Z`)
  demain.setUTCDate(demain.getUTCDate() + 1)

  const rendezVous = await prisma.rendezVous.findMany({
    where: { date: demain, statut: 'CONFIRME', rappelEnvoye: false },
    include: { coiffeur: { select: { prenom: true, nom: true } }, service: { select: { nom: true } } },
  })

  let envoyes = 0
  for (const rdv of rendezVous) {
    const details = {
      coiffeurNom: `${rdv.coiffeur.prenom} ${rdv.coiffeur.nom}`,
      serviceNom: rdv.service.nom,
      date: rdv.date.toISOString().slice(0, 10),
      heureDebut: rdv.heureDebut,
      codeSuivi: rdv.codeSuivi,
    }
    const resultats = await Promise.allSettled([
      envoyerRappelWhatsapp({ to: rdv.clientTelephone, ...details }),
      ...(rdv.clientEmail ? [envoyerRappelEmail({ to: rdv.clientEmail, clientNom: rdv.clientNom, ...details })] : []),
    ])
    for (const r of resultats) {
      if (r.status === 'rejected') console.error(`Échec du rappel (${rdv.codeSuivi}) :`, r.reason)
    }

    // Marqué dès qu'un canal a réellement envoyé ; en mode stub (sans clés)
    // il reste à false pour être renvoyé une fois les clés configurées.
    if (resultats.some((r) => r.status === 'fulfilled' && r.value.sent)) {
      await prisma.rendezVous.update({ where: { id: rdv.id }, data: { rappelEnvoye: true } })
      envoyes++
    }
  }

  return NextResponse.json({ date: demain.toISOString().slice(0, 10), candidats: rendezVous.length, envoyes })
}
