// Audit d'accessibilité automatisé (axe-core / WCAG 2.1 AA) sur les pages
// clés du site, en local. Usage : node scripts/a11y-audit.mjs [baseUrl]
//
// Le back-office est protégé par Clerk (pas de formulaire de mot de passe à
// automatiser). Pour l'auditer, ouvrez une session avec Playwright puis
// enregistrez-la :  npx playwright codegen --save-storage=.a11y-admin.json <url-salon>/connexion
// et lancez :  A11Y_STORAGE_STATE=.a11y-admin.json A11Y_SALON_URL=<url-salon> node scripts/a11y-audit.mjs
// Sans session : A11Y_DEV_PREVIEW=1 audite le back-office avec de fausses données (le serveur doit
// être lancé avec DEV_PREVIEW=1). Sans rien de tout cela, seules les pages publiques sont auditées.
// A11Y_THEME=light audite le thème clair.
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const BASE_URL = process.argv[2] || 'http://localhost:3001'

const PUBLIC_PAGES = ['/', '/equipe', '/services', '/reservation', '/suivi', '/connexion', '/inscription', '/mot-de-passe-oublie']

const ADMIN_STORAGE_STATE = process.env.A11Y_STORAGE_STATE
const SALON_URL = process.env.A11Y_SALON_URL || 'http://salon.localhost:3001'
const ADMIN_PAGES = ['/planning', '/equipe', '/services', '/galerie', '/fermetures', '/statistiques']

async function auditPage(page, url, attente = 0) {
  await page.goto(url, { waitUntil: attente ? 'load' : 'networkidle' })
  if (attente) await page.waitForTimeout(attente)
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return results.violations
}

function printViolations(url, violations) {
  if (violations.length === 0) {
    console.log(`✔ ${url} — aucune violation`)
    return
  }
  console.log(`✘ ${url} — ${violations.length} règle(s) en échec`)
  for (const v of violations) {
    console.log(`  [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length} élément(s))`)
    for (const node of v.nodes.slice(0, 3)) {
      console.log(`      → ${node.target.join(' ')}`)
    }
  }
}

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  // A11Y_THEME=light audite le thème clair (le sombre est le défaut)
  if (process.env.A11Y_THEME === 'light') await context.addInitScript(() => { try { localStorage.setItem('mc-theme', 'light'); sessionStorage.setItem('mc_intro', '1') } catch {} })
  const page = await context.newPage()

  let totalViolations = 0

  console.log(`\n=== Pages publiques (${BASE_URL}) ===`)
  for (const path of PUBLIC_PAGES) {
    const violations = await auditPage(page, `${BASE_URL}${path}`)
    printViolations(path, violations)
    totalViolations += violations.length
  }

  if (ADMIN_STORAGE_STATE) {
    const adminContext = await browser.newContext({ storageState: ADMIN_STORAGE_STATE })
    if (process.env.A11Y_THEME === 'light') await adminContext.addInitScript(() => { try { localStorage.setItem('mc-theme', 'light') } catch {} })
    const adminPage = await adminContext.newPage()
    console.log(`\n=== Back-office (${SALON_URL}) ===`)
    for (const path of ADMIN_PAGES) {
      const violations = await auditPage(adminPage, `${SALON_URL}${path}`)
      printViolations(path, violations)
      totalViolations += violations.length
    }
  } else if (process.env.A11Y_DEV_PREVIEW === '1') {
    // Banc d'essai avec de fausses données (serveur lancé avec DEV_PREVIEW=1) : audite l'interface
    // du back-office dans le thème choisi, sans session Clerk. Les appels d'API sont simulés.
    const previewContext = await browser.newContext()
    await previewContext.addInitScript((theme) => { try { localStorage.setItem('mc-theme', theme) } catch {} }, process.env.A11Y_THEME === 'light' ? 'light' : 'dark')
    const rdv = (id, coiffeurId, nom, debut, fin, statut, lignes = []) => ({ id, coiffeurId, clientNom: nom, clientTelephone: '20111222', heureDebut: debut, heureFin: fin, statut, notes: null, service: { id: 's', nom: 'Coupe', duree: 30, prix: 28 }, lignes, demandesModification: id === '2' ? [{ id: 'd', message: 'plus tard' }] : [] })
    await previewContext.route('**/api/rendez-vous?*', (r) => r.fulfill({ json: [
      rdv('1', 'a', 'Haytham Younes', '14:00', '14:50', 'CONFIRME', [{ serviceId: 's', nom: 'Coupe', duree: 30, prix: 28, ordre: 0 }, { serviceId: 't', nom: 'Barbe', duree: 20, prix: 18, ordre: 1 }]),
      rdv('2', 'b', 'Sami B', '15:30', '16:00', 'EN_ATTENTE'),
      rdv('3', 'a', 'Annulé', '11:00', '11:30', 'ANNULE'),
    ] }))
    await previewContext.route('**/api/services*', (r) => r.fulfill({ json: [{ id: 's', nom: 'Coupe', duree: 30 }, { id: 't', nom: 'Barbe', duree: 20 }] }))
    const previewPage = await previewContext.newPage()
    console.log(`
=== Back-office, données fictives (${BASE_URL}/dev-preview) ===`)
    for (const v of ['plan', 'stats', 'svc', 'dlg', 'eq', 'fer', 'gal']) {
      const violations = await auditPage(previewPage, `${BASE_URL}/dev-preview?v=${v}`, 2500)
      printViolations(`/dev-preview?v=${v}`, violations)
      totalViolations += violations.length
    }
  } else {
    console.log('\n(Back-office ignoré : définir A11Y_STORAGE_STATE pour l’auditer, cf. en-tête du script.)')
  }

  await browser.close()

  console.log(`\n=== TOTAL : ${totalViolations} violation(s) WCAG 2.1 A/AA ===\n`)
  process.exit(totalViolations > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
