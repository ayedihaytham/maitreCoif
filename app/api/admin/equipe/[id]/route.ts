import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { oublierPersonnel } from '@/lib/staff'
import { apercuSuppression, messageRendezVousLies, prevenirClientsAnnulation, rendezVousDuCoiffeur } from '@/lib/suppression'
import { erreurPause, coiffeurSchema } from '@/lib/validators'
import { inviterMembre } from '@/lib/staff'

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

  // Pause déjeuner : les deux bornes ou aucune (on complète avec la valeur actuelle si une seule est envoyée).
  if (rest.pauseDebut !== undefined || rest.pauseFin !== undefined) {
    const erreur = erreurPause(rest.pauseDebut !== undefined ? rest.pauseDebut : cible.pauseDebut, rest.pauseFin !== undefined ? rest.pauseFin : cible.pauseFin)
    if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  }

  // Changement d'adresse email : un membre jamais connecté depuis la liaison au compte Clerk n'est pas encore lié,
  // son accès repose sur l'email. On ne laisse pas l'administrateur se couper l'accès lui-même.
  const emailChange = rest.email !== undefined && rest.email.toLowerCase() !== cible.email.toLowerCase()
  if (emailChange && id === session.user.id && !cible.clerkId) {
    return NextResponse.json(
      { error: "Pour modifier votre propre email, déconnectez-vous puis reconnectez-vous une fois (cela lie votre compte), puis réessayez : sinon vous perdriez l'accès." },
      { status: 400 },
    )
  }

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
        ...(rest.pauseDebut !== undefined ? { pauseDebut: rest.pauseDebut || null } : {}),
        ...(rest.pauseFin !== undefined ? { pauseFin: rest.pauseFin || null } : {}),
        ...(rest.photo !== undefined ? { photo: rest.photo === '' ? null : rest.photo } : {}),
      },
    })
    const { motDePasseHash: _hash, clerkId: _clerk, ...membre } = coiffeur
    oublierPersonnel() // la désactivation / réactivation prend effet tout de suite sur cette instance
    // Membre pas encore lié à un compte Clerk dont l'email change : il doit se reconnecter avec la nouvelle adresse, on l'invite.
    if (emailChange && !cible.clerkId) {
      const { statut, detail } = await inviterMembre(coiffeur.email)
      return NextResponse.json({ ...membre, invitation: statut, invitationDetail: detail })
    }
    return NextResponse.json(membre)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Un compte existe déjà avec cet email.' }, { status: 409 })
    }
    throw error
  }
}

/**
 * Suppression définitive. Si le membre a des rendez-vous, elle est refusée (409) avec le détail de ce qui serait
 * effacé ; avec `?cascade=1` ses rendez-vous sont supprimés aussi et les clients à venir sont prévenus par email.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const cascade = new URL(request.url).searchParams.get('cascade') === '1'
  const where = rendezVousDuCoiffeur(id)
  const apercu = await apercuSuppression(where)
  if (apercu.total > 0 && !cascade) {
    return NextResponse.json({ error: messageRendezVousLies(`${cible.prenom} ${cible.nom}`, apercu), rendezVous: apercu }, { status: 409 })
  }

  // Les clients ayant un rendez-vous à venir sont prévenus avant que tout ne disparaisse.
  const clientsPrevenus = apercu.total > 0 ? await prevenirClientsAnnulation(where) : 0

  // Prestations, avis et demandes de modification partent avec les rendez-vous ; horaires, fermetures
  // personnelles et jetons de mot de passe partent avec le membre (suppression en cascade en base).
  await prisma.$transaction([prisma.rendezVous.deleteMany({ where }), prisma.user.delete({ where: { id } })])
  oublierPersonnel()
  return NextResponse.json({ supprime: true, rendezVousSupprimes: apercu.total, clientsPrevenus })
}
