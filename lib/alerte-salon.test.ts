import { afterEach, describe, expect, it, vi } from 'vitest'

import { alerterSalon } from './alerte-salon'
import { finitAvantMinuit } from './booking'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('alerterSalon', () => {
  it("reste en mode stub (aucun appel réseau) sans configuration", async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '')
    vi.stubEnv('TELEGRAM_CHAT_ID', '')
    vi.stubEnv('SALON_NOTIFY_EMAIL', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await alerterSalon('Sujet', 'Message')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith(expect.stringContaining('[alerte-salon:stub]'))
  })

  it('envoie le message via l’API Telegram quand le bot est configuré', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'TOKEN')
    vi.stubEnv('TELEGRAM_CHAT_ID', '42')
    vi.stubEnv('SALON_NOTIFY_EMAIL', '')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    await alerterSalon('Sujet', 'Message')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.telegram.org/botTOKEN/sendMessage',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ chat_id: '42', text: 'Sujet\n\nMessage' }) }),
    )
  })

  it('ne lève jamais, même si Telegram est en panne', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'TOKEN')
    vi.stubEnv('TELEGRAM_CHAT_ID', '42')
    vi.stubEnv('SALON_NOTIFY_EMAIL', '')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('réseau')))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await expect(alerterSalon('Sujet', 'Message')).resolves.toBeUndefined()
  })
})

describe('finitAvantMinuit', () => {
  it('accepte un rendez-vous qui se termine à minuit pile ou avant', () => {
    expect(finitAvantMinuit('23:30', 30)).toBe(true)
    expect(finitAvantMinuit('10:00', 60)).toBe(true)
  })

  it('refuse un rendez-vous qui déborde sur le lendemain', () => {
    expect(finitAvantMinuit('23:45', 30)).toBe(false)
  })
})
