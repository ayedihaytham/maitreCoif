import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { checkRateLimit, clientIpFrom } from '@/lib/rate-limit'
import { demandeModificationSchema } from '@/lib/validators'

export async function POST(request: Request) {
  const ip = clientIpFrom(request.headers)
  if (!checkRateLimit(`demande-modification:${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'Trop de tentatives, veuillez réessayer plus tard.' }, { status: 429 })
  }

  const body = await request.json()
  const parsed = demandeModificationSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { id, codeSuivi, message } = parsed.data

  const rendezVous = await prisma.rendezVous.findFirst({
    where: { id, codeSuivi: codeSuivi.trim().toUpperCase() },
  })

  if (!rendezVous) return NextResponse.json({ error: 'Rendez-vous introuvable' }, { status: 404 })

  if (rendezVous.statut !== 'EN_ATTENTE' && rendezVous.statut !== 'CONFIRME') {
    return NextResponse.json({ error: 'Une modification ne peut plus être demandée pour ce rendez-vous.' }, { status: 400 })
  }

  const noteAjoutee = `[Demande de modification du client] ${message.trim()}`
  const notes = rendezVous.notes ? `${rendezVous.notes}\n${noteAjoutee}` : noteAjoutee

  const updated = await prisma.rendezVous.update({
    where: { id },
    // Repasse en attente pour que la demande remonte à l'équipe, même si le
    // rendez-vous était déjà confirmé.
    data: { notes, statut: 'EN_ATTENTE' },
  })

  return NextResponse.json({ statut: updated.statut })
}
