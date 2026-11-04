// Garde-fou : les tests d'intégration créent et suppriment des données. Ils
// refusent de tourner contre une base distante (Neon, production...) sauf
// autorisation explicite via ALLOW_REMOTE_TEST_DB=1.
export function assertLocalDatabase() {
  if (process.env.ALLOW_REMOTE_TEST_DB === '1') return
  const url = process.env.DATABASE_URL ?? ''
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    // URL absente ou invalide : traitée comme non locale
  }
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
    throw new Error(
      `Les tests d'intégration refusent de tourner contre une base non locale (hôte : "${host || 'inconnu'}"). ` +
        'Pointez DATABASE_URL vers la base Docker locale, ou définissez ALLOW_REMOTE_TEST_DB=1 en connaissance de cause.',
    )
  }
}
