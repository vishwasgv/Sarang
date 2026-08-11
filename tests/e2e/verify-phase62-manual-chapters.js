/**
 * Quick live check — Phase 62's 3 new Manual chapters actually render,
 * in English and in one non-English locale, via the real Manual screen
 * (not just "the .md file exists on disk").
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

    const chapters = ['banking-reconciliation', 'ledger-journal-entries', 'fixed-assets-year-end-close']
    for (const slug of chapters) {
      await r.step(`manual-chapter-${slug}-en`, async () => {
        await h.gotoHash(page, `#/manual/${slug}`)
        await page.waitForTimeout(600)
        const crashed = await h.hasErrorBoundary(page)
        const text = await page.textContent('body')
        r.log(`${slug}-en-loads-no-crash`, !crashed)
        r.log(`${slug}-en-has-content`, text.length > 500, `body length=${text.length}`)
      })
    }

    // Switch to Hindi (real UI click, same pattern as suite 12's own
    // live-language-switch check) and re-check one chapter renders
    // translated content, not English fallback.
    await r.step('switch-to-hindi', async () => {
      await h.gotoHash(page, '#/settings')
      await page.waitForTimeout(700)
      const langTab = page.locator('button, [role="tab"]', { hasText: /Language/i }).first()
      if (await langTab.count()) { await langTab.click(); await page.waitForTimeout(400) }
      const hindiRow = page.locator('button', { hasText: 'हिंदी' }).first()
      if (await hindiRow.count() > 0) { await hindiRow.click(); await page.waitForTimeout(500) }
    })

    for (const slug of chapters) {
      await r.step(`manual-chapter-${slug}-hi`, async () => {
        await h.gotoHash(page, `#/manual/${slug}`)
        await page.waitForTimeout(600)
        const crashed = await h.hasErrorBoundary(page)
        const text = await page.textContent('body')
        r.log(`${slug}-hi-loads-no-crash`, !crashed)
        r.log(`${slug}-hi-has-devanagari-content`, /[ऀ-ॿ]/.test(text), 'expected Devanagari script somewhere in the rendered chapter')
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
    console.log(`\nMANUAL CHAPTERS (PHASE 62): ${s.pass}/${s.pass + s.fail} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((err) => { console.error(err); process.exit(1) })
}

module.exports = { run }
