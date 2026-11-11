// Les routes publiques sensibles refusent une requête sans jeton Turnstile valide quand la clé
// secrète est configurée (base locale requise : le compteur de tentatives passe par la base).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { prisma } from '@/lib/prisma'
import { assertLocalDatabase } from './assert-local-db'

assertLocalDatabase()

const IP = `203.0.113.${Math.floor(Math.random() * 200) + 1}`

const requete = (corps: unknown) =>
  new Request('http://test/api', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-real-ip': IP }, body: JSON.stringify(corps) })

const ROUTES = [
  { nom: 'annulation (suivi)', charger: () => import('@/app/api/rendez-vous/suivi/route') },
  { nom: 'demande de modification', charger: () => import('@/app/api/rendez-vous/modification/route') },
]

beforeAll(() => {
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret-de-test')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

afterAll(async () => {
  vi.unstubAllEnvs()
  await prisma.rateLimitHit.deleteMany({ where: { key: { contains: IP } } })
  await prisma.$disconnect()
})

describe.each(ROUTES)('$nom', ({ charger }) => {
  it('refuse une requête sans jeton anti-robot', async () => {
    const { POST } = await charger()
    const res = await POST(requete({ email: 'a@b.fr' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/anti-robot/)
  })

  it('refuse un jeton rejeté par Cloudflare', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: false }) }))
    const { POST } = await charger()
    const res = await POST(requete({ email: 'a@b.fr', turnstileToken: 'faux' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/anti-robot/)
  })

  it('laisse passer un jeton valide jusqu à la validation du contenu', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }))
    const { POST } = await charger()
    const res = await POST(requete({ turnstileToken: 'bon' }))
    // Le corps est volontairement incomplet : l'erreur vient de la validation, plus de l'anti-robot.
    const data = await res.json()
    expect(typeof data.error === 'string' ? data.error : '').not.toMatch(/anti-robot/)
  })
})
