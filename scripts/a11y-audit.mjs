// Audit d'accessibilité automatisé (axe-core / WCAG 2.1 AA) sur les pages
// clés du site, en local. Usage : node scripts/a11y-audit.mjs [baseUrl]
//
// Le back-office est protégé par Clerk (pas de formulaire de mot de passe à
// automatiser). Pour l'auditer, ouvrez une session avec Playwright puis
// enregistrez-la :  npx playwright codegen --save-storage=.a11y-admin.json <url-salon>/connexion
// et lancez :  A11Y_STORAGE_STATE=.a11y-admin.json A11Y_SALON_URL=<url-salon> node scripts/a11y-audit.mjs
// Sans cette variable, seules les pages publiques sont auditées.
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const BASE_URL = process.argv[2] || 'http://localhost:3001'

const PUBLIC_PAGES = ['/', '/equipe', '/services', '/reservation', '/suivi', '/connexion', '/inscription', '/mot-de-passe-oublie']

const ADMIN_STORAGE_STATE = process.env.A11Y_STORAGE_STATE
const SALON_URL = process.env.A11Y_SALON_URL || 'http://salon.localhost:3001'
const ADMIN_PAGES = ['/planning', '/equipe', '/services', '/galerie', '/fermetures', '/statistiques']

async function auditPage(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' })
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
    const adminPage = await adminContext.newPage()
    console.log(`\n=== Back-office (${SALON_URL}) ===`)
    for (const path of ADMIN_PAGES) {
      const violations = await auditPage(adminPage, `${SALON_URL}${path}`)
      printViolations(path, violations)
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
