import { NextResponse } from 'next/server'

import { getCreneauxDisponibles } from '@/lib/slots'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const coiffeurId = searchParams.get('coiffeurId')
  const serviceId = searchParams.get('serviceId')
  const date = searchParams.get('date')

  if (!coiffeurId || !serviceId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const creneaux = await getCreneauxDisponibles(coiffeurId, serviceId, date)
  return NextResponse.json({ creneaux })
}
