import { NextResponse } from 'next/server'

import { getJoursDisponibles } from '@/lib/slots'

const MAX_JOURS = 31

// État (libre / complet / fermé) des prochains jours pour un coiffeur et un
// service : sert à griser les jours sans créneau dans la réservation en ligne.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const coiffeurId = searchParams.get('coiffeurId')
  const serviceId = searchParams.get('serviceId')
  const from = searchParams.get('from')
  const count = Number(searchParams.get('count') ?? 21)

  if (
    !coiffeurId ||
    !serviceId ||
    !from ||
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_JOURS
  ) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const jours = await getJoursDisponibles(coiffeurId, serviceId, from, count)
  return NextResponse.json({ jours })
}
