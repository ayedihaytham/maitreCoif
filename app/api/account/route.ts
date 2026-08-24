import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { accountUpdateSchema } from '@/lib/validators'

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json()
  const parsed = accountUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(parsed.data.nom ? { nom: parsed.data.nom } : {}),
      ...(parsed.data.prenom ? { prenom: parsed.data.prenom } : {}),
      ...(parsed.data.telephone !== undefined ? { telephone: parsed.data.telephone || null } : {}),
    },
  })

  return NextResponse.json({ nom: user.nom, prenom: user.prenom, telephone: user.telephone })
}
