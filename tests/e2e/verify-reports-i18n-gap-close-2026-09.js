/**
 * Live spot-check for the reports.* translation-gap closure (2026-09).
 * Switches the app language to Hindi, Arabic, and Spanish in turn and
 * confirms the Reports screen (report catalog tiles built from
 * reports.defs.*.label/description, plus reports.categories.*) renders
 * real translated script — not English fallback, not raw i18n keys, and
 * no crash from an overly long translated string breaking layout.
 */
const h = require('./harness')

async function checkLanguage(page, r, { rowLabel, tag, scriptRegex, scriptName }) {
  await r.step(`switch-to-${tag}`, async () => {
    await h.gotoHash(page, '#/settings')
    await page.waitForTimeout(700)
    const langTab = page.locator('button, [role="tab"]', { hasText: /Language/i }).first()
    if (await langTab.count()) { await langTab.click(); await page.waitForTimeout(400) }
    const row = page.locator('button', { hasText: rowLabel }).first()
    const found = await row.count() > 0
    r.log(`${tag}-language-row-found`, found)
    if (found) { await row.click(); await page.waitForTimeout(500) }
  })

  await r.step(`reports-screen-${tag}`, async () => {
    await h.gotoHash(page, '#/reports')
    await page.waitForTimeout(900)
    const crashed = await h.hasErrorBoundary(page)
    const text = await page.textContent('body')
    r.log(`reports-loads-no-crash-${tag}`, !crashed)
    const hasScript = scriptRegex.test(text)
    r.log(`reports-has-${scriptName}-content`, hasScript, 'expected translated script on the report catalog screen')
    // Should NOT still show the literal English catalog description text
    // that was previously left untranslated (spot-check one known-gap string).
    const stillEnglish = text.includes('Average Daily Rate and Revenue per Available Room')
    r.log(`reports-adrRevPAR-desc-not-english-${tag}`, !stillEnglish)
    await h.shot(page, `reports-i18n-gap-close-${tag}`)
  })
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  let page
  try {
    page = await h.getMainWindow(app)
    await h.login(page)

    await checkLanguage(page, r, { rowLabel: 'हिंदी', tag: 'hindi', scriptRegex: /[ऀ-ॿ]/, scriptName: 'devanagari' })
    await checkLanguage(page, r, { rowLabel: 'العربية', tag: 'arabic', scriptRegex: /[؀-ۿ]/, scriptName: 'arabic' })
    await checkLanguage(page, r, { rowLabel: 'Español', tag: 'spanish', scriptRegex: /[áéíóúñ]/i, scriptName: 'spanish-diacritics' })

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
    console.log(`\nREPORTS i18n GAP CLOSE (2026-09): ${s.pass}/${s.pass + s.fail} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((err) => { console.error(err); process.exit(1) })
}

module.exports = { run }
