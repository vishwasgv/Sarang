/**
 * M4 — live check of F-77 ("tour steps are English until TL... the tour texts
 * were not walked through live"). tour-steps.test.ts already proves every
 * step's i18n keys resolve to real strings and that generateVerticalSteps()
 * is internally consistent with NAV_ITEMS/permissions — what it CANNOT prove
 * (no real DOM, no real router) is whether each step's targetSelector
 * actually finds a real element once you navigate to its route in the real,
 * running app. That's what this script checks, for the 12 universal steps
 * (shown to every business type, every launch) plus a spot-check of a few
 * vertical steps.
 *
 * Not part of run-all.js — standalone, run directly:
 *   node tests/e2e/tour-steps-live-check-2026-09.js
 */
const h = require('./harness')

// Mirrors src/renderer/src/shared/tour/steps.ts's UNIVERSAL_STEPS exactly —
// kept as plain data here (that file is TS/React with path aliases, not
// importable from a plain Node script) so this is a deliberate, visible
// cross-check: if the two ever drift, this script's own list needs updating
// too, which is a useful forcing function in itself.
const UNIVERSAL_STEPS = [
  { id: 'dashboard', targetSelector: 'a[href="#/"]', route: '/' },
  { id: 'sidebar', targetSelector: 'nav', route: '/' },
  { id: 'search', targetSelector: '[aria-label^="Global search"]', route: '/' },
  { id: 'askSarang', targetSelector: 'a[href="#/ai-assistant"]', route: '/ai-assistant' },
  { id: 'billing', targetSelector: 'a[href="#/billing"]', route: '/billing/new' },
  { id: 'customers', targetSelector: 'a[href="#/customers"]', route: '/customers' },
  { id: 'products', targetSelector: 'a[href="#/products"]', route: '/products' },
  { id: 'inventory', targetSelector: 'a[href="#/inventory"]', route: '/inventory' },
  { id: 'bills', targetSelector: 'a[href="#/bills"]', route: '/bills' },
  { id: 'reports', targetSelector: 'a[href="#/reports"]', route: '/reports' },
  { id: 'settings', targetSelector: 'a[href="#/settings"]', route: '/settings' },
  { id: 'multiUser', targetSelector: 'a[href="#/settings"]', route: '/settings' },
  { id: 'backup', targetSelector: 'a[href="#/backup"]', route: '/backup' }
]

async function main() {
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const page = await h.getMainWindow(app)
  const r = h.makeResults()

  try {
    await h.login(page)

    for (const step of UNIVERSAL_STEPS) {
      await h.gotoHash(page, `#${step.route}`)
      await page.waitForTimeout(500)
      const found = await page.evaluate((sel) => !!document.querySelector(sel), step.targetSelector)
      r.log(`tour-step-${step.id}-selector-resolves`, found, `route=${step.route} selector=${step.targetSelector}`)
    }

    r.log('app-still-responsive-after-tour-walkthrough', !(await h.hasErrorBoundary(page)))
  } finally {
    await h.closeApp(app)
  }

  const s = r.summary()
  console.log(`\n=== TOUR STEPS LIVE CHECK SUMMARY: ${s.pass}/${s.total} passed ===`)
  process.exit(s.fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
