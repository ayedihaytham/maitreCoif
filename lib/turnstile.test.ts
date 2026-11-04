import { afterEach, describe, expect, it, vi } from 'vitest'

import { verifierTurnstile } from './turnstile'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('verifierTurnstile', () => {
  it("accepte tout quand aucune clé secrète n'est configurée", async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    expect(await verifierTurnstile(undefined, '1.2.3.4')).toBe(true)
  })

  it('refuse une soumission sans jeton quand la clé est configurée', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret')
    expect(await verifierTurnstile('', '1.2.3.4')).toBe(false)
  })

  it('accepte un jeton validé par Cloudflare', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }))
    expect(await verifierTurnstile('token', '1.2.3.4')).toBe(true)
  })

  it('refuse un jeton rejeté par Cloudflare', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: false }) }))
    expect(await verifierTurnstile('token', '1.2.3.4')).toBe(false)
  })

  it('refuse (fail-closed) si Cloudflare est injoignable', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('réseau')))
    expect(await verifierTurnstile('token', '1.2.3.4')).toBe(false)
  })
})
