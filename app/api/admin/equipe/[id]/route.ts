import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { oublierPersonnel } from '@/lib/staff'
import { coiffeurSchema } from '@/lib/validators'

async function getAdminSession() {
  const session = await auth()
  return session?.user.role === 'ADMIN' ? session : null
}

/** Nombre d'administrateurs actifs autres que `exceptId`. */
function autresAdminsActifs(exceptId: string) {
  return prisma.user.count({ where: { role: 'ADMIN', actif: true, id: { not: exceptId } } })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const parsed = coiffeurSchema.partial().safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Cette route ne gère que l'équipe : jamais un compte client.
  const cible = await prisma.user.findFirst({ where: { id, role: { in: ['COIFFEUR', 'ADMIN'] } } })
  if (!cible) return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })

  const rest = parsed.data

  // On ne retire jamais le dernier administrateur actif (ni à soi-même, ni à un autre).
  if (rest.role && rest.role !== 'ADMIN' && cible.role === 'ADMIN' && (await autresAdminsActifs(id)) === 0) {
    return NextResponse.json({ error: 'Il doit rester au moins un administrateur actif.' }, { status: 400 })
  }

  // Désactiver : jamais soi-même, jamais le dernier administrateur actif.
  if (rest.actif === false) {
    if (id === session.user.id) return NextResponse.json({ error: 'Vous ne pouvez pas désactiver votre propre compte.' }, { status: 400 })
    if (cible.role === 'ADMIN' && (await autresAdminsActifs(id)) === 0) {
      return NextResponse.json({ error: 'Il doit rester au moins un administrateur actif.' }, { status: 400 })
    }
  }

  try {
    const coiffeur = await prisma.user.update({
      where: { id },
      data: {
        ...rest,
        telephone: rest.telephone === '' ? null : rest.telephone,
        bio: rest.bio === '' ? null : rest.bio,
        ...(rest.photo !== undefined ? { photo: rest.photo === '' ? null : rest.photo } : {}),
      },
    })
    const { motDePasseHash: _hash, ...membre } = coiffeur
    oublierPersonnel() // la désactivation / réactivation prend effet tout de suite sur cette instance
    return NextResponse.json(membre)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Un compte existe déjà avec cet email.' }, { status: 409 })
    }
    throw error
  }
}

/** Suppression définitive. Impossible tant que le membre a des rendez-vous : on le désactive alors. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id } = await params
  if (id === session.user.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' }, { status: 400 })
  }

  const cible = await prisma.user.findFirst({ where: { id, role: { in: ['COIFFEUR', 'ADMIN'] } } })
  if (!cible) return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })

  if (cible.role === 'ADMIN' && (await autresAdminsActifs(id)) === 0) {
    return NextResponse.json({ error: 'Il doit rester au moins un administrateur actif.' }, { status: 400 })
  }

  const rendezVous = await prisma.rendezVous.count({ where: { coiffeurId: id } })
  if (rendezVous > 0) {
    return NextResponse.json(
      { error: `Suppression impossible : ${rendezVous} rendez-vous sont à son nom (historique). Désactivez-le plutôt, vous pourrez le réactiver.` },
      { status: 409 },
    )
  }

  // Horaires, fermetures personnelles et jetons de mot de passe partent avec le membre (suppression en cascade).
  await prisma.user.delete({ where: { id } })
  oublierPersonnel()
  return NextResponse.json({ supprime: true })
}
