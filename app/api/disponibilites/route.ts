import { NextResponse } from 'next/server'

import { getGrilleJour } from '@/lib/slots'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const coiffeurId = searchParams.get('coiffeurId')
  // `serviceId` : une ou plusieurs prestations séparées par des virgules
  const serviceId = searchParams.get('serviceId')
  const date = searchParams.get('date')

  if (!coiffeurId || !serviceId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  // `creneaux` : créneaux libres (utilisé par le planning du salon) ;
  // `grille` : tous les créneaux du jour avec leur état (réservation en ligne).
  const grille = await getGrilleJour(coiffeurId, serviceId, date)
  return NextResponse.json({ creneaux: grille.filter((c) => c.libre).map((c) => c.heure), grille })
}
