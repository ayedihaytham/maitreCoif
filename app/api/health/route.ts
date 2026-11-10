import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

// Sonde de santé (Docker, déploiement) : l'application répond et la base aussi.
// Aucune donnée n'est exposée ; la réponse n'est jamais mise en cache.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
