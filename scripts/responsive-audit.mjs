// Audit responsive : charge chaque page à plusieurs largeurs d'écran et signale
//  - un défilement horizontal de la page,
//  - des éléments qui dépassent de l'écran (hors zones qui défilent volontairement),
//  - des cibles tactiles trop petites (< 24 px) sur écran étroit.
// Usage : node scripts/responsive-audit.mjs [baseUrl] [dossier de captures]
// Le back-office est audité via /dev-preview (serveur lancé avec DEV_PREVIEW=1), avec de fausses données.
import fs from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.argv[2] || 'http://localhost:3055'
const SORTIE = process.argv[3]
const LARGEURS = [320, 375, 768, 1024, 1440]

const PUBLIQUES = ['/', '/services', '/equipe', '/galerie', '/suivi', '/reservation', '/connexion', '/inscription', '/mot-de-passe-oublie']
const ADMIN = ['plan', 'stats', 'svc', 'eq', 'fer', 'gal', 'dlg'].map((v) => `/dev-preview?v=${v}`)

const FAUX = {
  rdv: (id, c, nom, d, f, statut) => ({ id, coiffeurId: c, clientNom: nom, clientTelephone: '20111222', heureDebut: d, heureFin: f, statut, notes: null, service: { id: 's', nom: 'Coupe', duree: 30, prix: 28 }, lignes: [], demandesModification: [] }),
}

async function analyser(page) {
  return page.evaluate(() => {
    const L = window.innerWidth
    const debordement = document.documentElement.scrollWidth - L
    const decrire = (el) => {
      const id = el.id ? '#' + el.id : ''
      const cl = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''
      return el.tagName.toLowerCase() + id + cl
    }
    const dansZoneDefilante = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p)
        if (/(auto|scroll|hidden|clip)/.test(o.overflowX) && p.getBoundingClientRect().right <= L + 1) return true
        if (o.position === 'fixed') return true
      }
      return false
    }
    const depassent = []
    const petits = []
    for (const el of document.body.querySelectorAll('*')) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if ((r.right > L + 1 || r.left < -1) && !dansZoneDefilante(el) && !el.closest('[aria-hidden="true"], .sr-only')) depassent.push(decrire(el) + ` [${Math.round(r.left)}→${Math.round(r.right)}]`)
      if (L <= 768 && /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && el.type !== 'hidden' && !el.hidden) {
        const enLigne = cs.display === 'inline' && el.tagName === 'A'
        const zone = el.closest('label')?.getBoundingClientRect() ?? r // un champ dans une étiquette se touche par l'étiquette
        if (!enLigne && (zone.width < 24 || zone.height < 24) && !el.closest('.sr-only, [aria-hidden="true"], .hidden, dialog:not([open])')) petits.push(decrire(el) + ` ${Math.round(r.width)}×${Math.round(r.height)}`)
      }
    }
    return { debordement, depassent: [...new Set(depassent)].slice(0, 4), petits: [...new Set(petits)].slice(0, 4) }
  })
}

const browser = await chromium.launch()
let problemes = 0
if (SORTIE) fs.mkdirSync(SORTIE, { recursive: true })

for (const theme of ['dark', 'light']) {
  for (const chemin of [...PUBLIQUES, ...ADMIN]) {
    for (const l of LARGEURS) {
      if (theme === 'light' && ![375, 1440].includes(l)) continue
      const ctx = await browser.newContext({ viewport: { width: l, height: 800 }, hasTouch: l <= 768 })
      await ctx.addInitScript((t) => { try { localStorage.setItem('mc-theme', t); sessionStorage.setItem('mc_intro', '1') } catch {} }, theme)
      await ctx.route('**/api/rendez-vous?*', (r) => r.fulfill({ json: [FAUX.rdv('1', 'a', 'Haytham Younes', '14:00', '14:50', 'CONFIRME'), FAUX.rdv('2', 'b', 'Sami B', '15:30', '16:00', 'EN_ATTENTE')] }))
      await ctx.route('**/api/services*', (r) => r.fulfill({ json: [{ id: 's', nom: 'Coupe', duree: 30 }] }))
      const page = await ctx.newPage()
      try {
        await page.goto(BASE + chemin, { waitUntil: 'load', timeout: 45000 })
        await page.waitForTimeout(1500)
        const a = await analyser(page)
        const mauvais = a.debordement > 1 || a.depassent.length > 0 || a.petits.length > 0
        if (mauvais) {
          problemes++
          console.log(`✘ ${theme} ${l}px ${chemin}`)
          if (a.debordement > 1) console.log(`    défilement horizontal de ${a.debordement}px`)
          if (a.depassent.length) console.log('    dépasse : ' + a.depassent.join(' | '))
          if (a.petits.length) console.log('    cibles < 24px : ' + a.petits.join(' | '))
          if (SORTIE) await page.screenshot({ path: `${SORTIE}/${theme}-${l}-${chemin.replace(/[^a-z0-9]+/gi, '_')}.png` })
        }
      } catch (e) {
        problemes++
        console.log(`✘ ${theme} ${l}px ${chemin} : ${String(e.message).slice(0, 80)}`)
      }
      await ctx.close()
    }
  }
}
await browser.close()
console.log(problemes === 0 ? '\n✔ Aucun problème de mise en page détecté.' : `\n${problemes} page(s)/largeur(s) à examiner.`)
process.exit(problemes ? 1 : 0)
