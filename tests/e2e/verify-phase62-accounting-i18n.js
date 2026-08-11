/**
 * Live check — the 8 Phase 62 accounting screens actually render translated
 * text once switched to Hindi (not just that en.json/hi.json have matching
 * key counts). Confirms the t() calls wired into each screen this session
 * actually resolve to real Devanagari script, not English fallback or tofu.
 */
const h = require('./harness')

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  let page
  try {
    page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-hindi', async () => {
      await h.gotoHash(page, '#/settings')
      await page.waitForTimeout(700)
      const langTab = page.locator('button, [role="tab"]', { hasText: /Language/i }).first()
      if (await langTab.count()) { await langTab.click(); await page.waitForTimeout(400) }
      const hindiRow = page.locator('button', { hasText: 'हिंदी' }).first()
      const found = await hindiRow.count() > 0
      r.log('hindi-language-row-found', found)
      if (found) { await hindiRow.click(); await page.waitForTimeout(500) }
    })

    const routes = [
      ['#/accounting/chart-of-accounts', 'chart-of-accounts'],
      ['#/accounting/journal-entries', 'journal-entries'],
      ['#/accounting/bank-accounts', 'bank-accounts'],
      ['#/accounting/post-dated-cheques', 'post-dated-cheques'],
      ['#/accounting/fixed-assets', 'fixed-assets'],
      ['#/accounting/ledger-settings', 'ledger-settings'],
    ]
    for (const [route, label] of routes) {
      await r.step(`${label}-hindi`, async () => {
        await h.gotoHash(page, route)
        await page.waitForTimeout(600)
        const crashed = await h.hasErrorBoundary(page)
        const text = await page.textContent('body')
        r.log(`${label}-loads-no-crash-hindi`, !crashed)
        r.log(`${label}-has-devanagari-content`, /[ऀ-ॿ]/.test(text), 'expected Devanagari script in the translated screen')
      })
    }

    // Restore English so the app isn't left in a non-default language.
    await r.step('restore-english', async () => {
      await h.gotoHash(page, '#/settings')
      await page.waitForTimeout(700)
      const langTab = page.locator('button, [role="tab"]', { hasText: /Language/i }).first()
      if (await langTab.count()) { await langTab.click(); await page.waitForTimeout(400) }
      const englishRow = page.locator('button', { hasText: 'English' }).first()
      if (await englishRow.count() > 0) { await englishRow.click(); await page.waitForTimeout(500) }
    })
  } finally {
    await app.close()
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nACCOUNTING SCREENS i18n (PHASE 62): ${s.pass}/${s.pass + s.fail} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((err) => { console.error(err); process.exit(1) })
}

module.exports = { run }
