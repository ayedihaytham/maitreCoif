import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { assembler, configurationPostHog, construireRequetes, getAnalytique, lirePeriode, remplirSerie, viderMemoireAnalytique } from '@/lib/analytique'

describe('lirePeriode', () => {
  it('accepte 7, 30 et 90 ; tout le reste donne 30', () => {
    expect([lirePeriode('7'), lirePeriode('30'), lirePeriode('90')]).toEqual([7, 30, 90])
    for (const v of [undefined, '', '1', '9999', '30; DROP TABLE events', 'abc']) expect(lirePeriode(v)).toBe(30)
  })
})

describe('construireRequetes', () => {
  it('ne contient que la période validée (aucune saisie dans la requête)', () => {
    const r = construireRequetes(lirePeriode("7' OR 1=1 --"))
    for (const q of Object.values(r)) expect(q).toContain('INTERVAL 30 DAY')
  })
})

describe('remplirSerie', () => {
  it('donne un jour par jour, avec des zéros les jours sans visite', () => {
    const s = remplirSerie([{ jour: '2026-11-05', visiteurs: 4, pagesVues: 9 }], 3, '2026-11-06')
    expect(s).toEqual([
      { jour: '2026-11-04', visiteurs: 0, pagesVues: 0 },
      { jour: '2026-11-05', visiteurs: 4, pagesVues: 9 },
      { jour: '2026-11-06', visiteurs: 0, pagesVues: 0 },
    ])
  })
})

describe('assembler', () => {
  it('calcule la conversion et un entonnoir cumulatif', () => {
    const d = assembler(
      {
        kpi: [[200, 640, 20, 100]],
        // personnes dont l'étape maximale atteinte est 1, 2, 3 ou 4
        entonnoir: [
          [1, 30],
          [2, 25],
          [3, 25],
          [4, 20],
        ],
      },
      30,
      '2026-11-06',
    )
    expect(d.visiteurs).toBe(200)
    expect(d.conversion).toBeCloseTo(0.1)
    expect(d.entonnoir.map((e) => e.personnes)).toEqual([100, 100, 70, 45, 20])
  })

  it('tolère les rubriques absentes et les nombres écrits en texte', () => {
    const d = assembler({ kpi: [['12', '30', '1', '8']] }, 7, '2026-11-06')
    expect(d.visiteurs).toBe(12)
    expect(d.pages).toEqual([])
    expect(d.serie).toHaveLength(7)
  })

  it('ne dépasse jamais 100 % de conversion', () => {
    expect(assembler({ kpi: [[2, 2, 5, 2]] }, 7, '2026-11-06').conversion).toBe(1)
  })
})

describe('lecture de PostHog', () => {
  beforeEach(() => viderMemoireAnalytique())
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("n'appelle rien tant que les clés ne sont pas renseignées", async () => {
    vi.stubEnv('POSTHOG_PERSONAL_API_KEY', '')
    vi.stubEnv('POSTHOG_PROJECT_ID', '')
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    expect(configurationPostHog()).toBeNull()
    expect(await getAnalytique(30)).toEqual({ etat: 'non_configure' })
    expect(f).not.toHaveBeenCalled()
  })

  it("interroge l'API avec la clé en en-tête et affiche les chiffres", async () => {
    vi.stubEnv('POSTHOG_PERSONAL_API_KEY', 'phx_secret')
    vi.stubEnv('POSTHOG_PROJECT_ID', '12345')
    vi.stubEnv('POSTHOG_API_HOST', 'https://eu.posthog.com/')
    const f = vi.fn(async () => new Response(JSON.stringify({ results: [[7, 21, 2, 5]] }), { status: 200 }))
    vi.stubGlobal('fetch', f)

    const r = await getAnalytique(7)
    expect(r.etat).toBe('ok')
    if (r.etat === 'ok') expect(r.donnees.visiteurs).toBe(7)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://eu.posthog.com/api/projects/12345/query/')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer phx_secret')
    expect(JSON.parse(String(init.body)).query.kind).toBe('HogQLQuery')
    expect(f).toHaveBeenCalledTimes(Object.keys(construireRequetes(7)).length)
  })

  it("garde les rubriques qui marchent quand une requête échoue, et signale l'erreur", async () => {
    vi.stubEnv('POSTHOG_PERSONAL_API_KEY', 'phx_secret')
    vi.stubEnv('POSTHOG_PROJECT_ID', '12345')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', async (_u: string, init: RequestInit) =>
      String(init.body).includes('reservation_etape') ? new Response('boom', { status: 500 }) : new Response(JSON.stringify({ results: [[3, 3, 0, 1]] }), { status: 200 }),
    )
    const r = await getAnalytique(30)
    expect(r.etat === 'ok' && r.erreurs).toHaveLength(1)
    expect(r.etat === 'ok' && r.erreurs[0]).toMatch(/entonnoir : PostHog a répondu 500/)
    expect(r.etat === 'ok' && r.donnees.visiteurs).toBe(3)
  })

  it('explique une clé refusée', async () => {
    vi.stubEnv('POSTHOG_PERSONAL_API_KEY', 'mauvaise')
    vi.stubEnv('POSTHOG_PROJECT_ID', '12345')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', async () => new Response('{"detail":"Invalid"}', { status: 401 }))
    const r = await getAnalytique(30)
    expect(r.etat === 'ok' && r.erreurs[0]).toMatch(/Query read/)
  })

  it('met les réponses en mémoire 5 minutes', async () => {
    vi.stubEnv('POSTHOG_PERSONAL_API_KEY', 'phx_secret')
    vi.stubEnv('POSTHOG_PROJECT_ID', '12345')
    const f = vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 }))
    vi.stubGlobal('fetch', f)
    await getAnalytique(30)
    const premier = f.mock.calls.length
    await getAnalytique(30)
    expect(f.mock.calls.length).toBe(premier)
  })
})
