import { afterEach, describe, expect, it, vi } from 'vitest'

import { ancienneVersSalon, versRouteInterne } from './salon-host'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('versRouteInterne (sous-domaine -> routes internes)', () => {
  it('réécrit les pages du back-office', () => {
    expect(versRouteInterne('/planning')).toBe('/admin/planning')
    expect(versRouteInterne('/equipe')).toBe('/admin/equipe')
    expect(versRouteInterne('/fermetures')).toBe('/admin/fermetures')
    expect(versRouteInterne('/statistiques')).toBe('/admin/statistiques')
  })

  it('réécrit la connexion et l’inscription, y compris les étapes Clerk', () => {
    expect(versRouteInterne('/connexion')).toBe('/espace-equipe')
    expect(versRouteInterne('/connexion/factor-one')).toBe('/espace-equipe/factor-one')
    expect(versRouteInterne('/inscription')).toBe('/espace-equipe/inscription')
    expect(versRouteInterne('/inscription/verify-email-address')).toBe('/espace-equipe/inscription/verify-email-address')
    expect(versRouteInterne('/acces-refuse')).toBe('/espace-equipe/acces-refuse')
  })

  it('refuse tout le reste, dont les anciennes adresses internes et les pages publiques', () => {
    expect(versRouteInterne('/admin/planning')).toBeNull()
    expect(versRouteInterne('/espace-equipe')).toBeNull()
    expect(versRouteInterne('/services/autre')).toBeNull()
    expect(versRouteInterne('/planning/x')).toBeNull()
    expect(versRouteInterne('/reservation')).toBeNull()
    expect(versRouteInterne('/suivi')).toBeNull()
    expect(versRouteInterne('/acces-refuse/x')).toBeNull()
  })
})

describe('ancienneVersSalon (anciennes adresses -> sous-domaine)', () => {
  it('traduit les anciennes adresses du back-office et de la connexion', () => {
    expect(ancienneVersSalon('/admin/planning')).toBe('/planning')
    expect(ancienneVersSalon('/admin/equipe')).toBe('/equipe')
    expect(ancienneVersSalon('/admin')).toBe('/planning')
    expect(ancienneVersSalon('/espace-equipe')).toBe('/connexion')
    expect(ancienneVersSalon('/espace-equipe/inscription')).toBe('/inscription')
    expect(ancienneVersSalon('/espace-equipe/acces-refuse')).toBe('/acces-refuse')
  })

  it('ignore les pages du site public', () => {
    expect(ancienneVersSalon('/')).toBeNull()
    expect(ancienneVersSalon('/equipe')).toBeNull()
    expect(ancienneVersSalon('/connexion')).toBeNull()
  })
})

describe('adresses absolues', () => {
  it('construit les adresses du sous-domaine et du site public', async () => {
    vi.stubEnv('NEXT_PUBLIC_SALON_HOST', 'salon.maitrecoif.com')
    const m = await import('./salon-host')
    expect(m.salonUrl('/planning')).toBe('https://salon.maitrecoif.com/planning')
    expect(m.siteUrl('/')).toBe('https://maitrecoif.com/')
    expect(m.estHoteSalon('salon.maitrecoif.com')).toBe(true)
    expect(m.estHoteSalon('SALON.maitrecoif.com')).toBe(true)
    expect(m.estHoteSalon('www.maitrecoif.com')).toBe(false)
    expect(m.estHoteSalon('maitrecoif.com')).toBe(false)
  })

  it('utilise http en local', async () => {
    vi.stubEnv('NEXT_PUBLIC_SALON_HOST', 'salon.localhost:3000')
    const m = await import('./salon-host')
    expect(m.salonUrl('/connexion')).toBe('http://salon.localhost:3000/connexion')
    expect(m.siteUrl('/')).toBe('http://localhost:3000/')
  })

  it('ferme tout quand le sous-domaine n’est pas configuré', async () => {
    vi.stubEnv('NEXT_PUBLIC_SALON_HOST', '')
    const m = await import('./salon-host')
    expect(m.estHoteSalon('salon.maitrecoif.com')).toBe(false)
    expect(m.estHoteSalon(null)).toBe(false)
  })
})
