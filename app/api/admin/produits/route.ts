import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { listerProduitsAdmin, versProduitAdmin } from '@/lib/boutique-admin'
import { prisma } from '@/lib/prisma'
import { produitSchema } from '@/lib/validators'

async function estAdmin() {
  const session = await auth()
  return session?.user.role === 'ADMIN'
}

export async function GET() {
  if (!(await estAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  return NextResponse.json(await listerProduitsAdmin())
}

export async function POST(request: Request) {
  if (!(await estAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const parsed = produitSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { nom, description, prix, categorie, stock, actif, image } = parsed.data
  const produit = await prisma.produit.create({
    data: { nom, description: description || null, prix, categorie: categorie || null, stock, actif: actif ?? true, image: image || null },
  })
  return NextResponse.json(versProduitAdmin(produit), { status: 201 })
}
