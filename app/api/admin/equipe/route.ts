import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { inviterMembre } from '@/lib/staff'
import { coiffeurSchema } from '@/lib/validators'

async function requireAdmin() {
  const session = await auth()
  return session?.user.role === 'ADMIN'
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const equipe = await prisma.user.findMany({
    where: { role: { in: ['COIFFEUR', 'ADMIN'] } },
    orderBy: { dateCreation: 'asc' },
    select: {
      id: true,
      nom: true,
      prenom: true,
      email: true,
      telephone: true,
      role: true,
      photo: true,
      specialites: true,
      bio: true,
      actif: true,
    },
  })

  return NextResponse.json(equipe)
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await request.json()
  const parsed = coiffeurSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) return NextResponse.json({ error: 'Un compte existe déjà avec cet email.' }, { status: 409 })

  // Le personnel se connecte via Clerk : on stocke un hash aléatoire inutilisable
  // (la colonne est obligatoire et Auth.js refuse de toute façon le personnel).
  const motDePasseHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12)
  const coiffeur = await prisma.user.create({
    data: {
      nom: parsed.data.nom,
      prenom: parsed.data.prenom,
      email: parsed.data.email,
      telephone: parsed.data.telephone || null,
      bio: parsed.data.bio || null,
      specialites: parsed.data.specialites ?? [],
      role: parsed.data.role ?? 'COIFFEUR',
      photo: parsed.data.photo || null,
      motDePasseHash,
    },
  })

  const { statut, detail } = await inviterMembre(coiffeur.email)
  const { motDePasseHash: _hash, ...membre } = coiffeur
  return NextResponse.json({ ...membre, invitation: statut, invitationDetail: detail }, { status: 201 })
}
