// Audit d'accessibilité automatisé (axe-core / WCAG 2.1 AA) sur les pages
// clés du site, en local. Usage : node scripts/a11y-audit.mjs [baseUrl]
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const BASE_URL = process.argv[2] || 'http://localhost:3001'

const PUBLIC_PAGES = ['/', '/equipe', '/services', '/reservation', '/suivi', '/connexion', '/inscription', '/mot-de-passe-oublie']

const ADMIN_CREDENTIALS = { email: 'gerant@maitrecoif.fr', password: 'Gerant123!' }
const ADMIN_PAGES = ['/admin/planning', '/admin/equipe', '/admin/services', '/admin/galerie', '/admin/statistiques']

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

  console.log('\n=== Connexion admin ===')
  await page.goto(`${BASE_URL}/connexion`, { waitUntil: 'networkidle' })
  await page.getByLabel('Email').fill(ADMIN_CREDENTIALS.email)
  await page.getByLabel('Mot de passe').fill(ADMIN_CREDENTIALS.password)
  await page.getByRole('button', { name: /se connecter/i }).click()
  await page.waitForURL(/\/admin\//, { timeout: 10000 }).catch(() => {})

  console.log(`\n=== Back-office (${BASE_URL}) ===`)
  for (const path of ADMIN_PAGES) {
    const violations = await auditPage(page, `${BASE_URL}${path}`)
    printViolations(path, violations)
    totalViolations += violations.length
  }

  await browser.close()

  console.log(`\n=== TOTAL : ${totalViolations} violation(s) WCAG 2.1 A/AA ===\n`)
  process.exit(totalViolations > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
