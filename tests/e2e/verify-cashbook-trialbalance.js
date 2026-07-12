// One-off live verification for the new Cash Book / Trial Balance reports.
// Not part of the permanent suite list — run manually: node tests/e2e/verify-cashbook-trialbalance.js
const h = require('./harness')

async function main() {
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  try {
    const page = await h.getMainWindow(app)
    await h.login(page)
    await h.gotoHash(page, '#/reports')
    await page.waitForTimeout(800)

    for (const [tileLabel, expectBadge] of [['Cash Book', null], ['Trial Balance', 'Balanced']]) {
      console.log(`\n=== ${tileLabel} ===`)
      const tile = page.locator(`button:has-text("${tileLabel}")`).first()
      const tileCount = await tile.count()
      console.log('tile found:', tileCount > 0)
      if (tileCount === 0) { await h.shot(page, `${tileLabel}-tile-missing`); continue }
      await tile.click()
      await page.waitForTimeout(500)

      // Date range inputs, if present for this report type
      const dateFrom = page.locator('input[type="date"]').first()
      const dateTo = page.locator('input[type="date"]').nth(1)
      if (await dateFrom.count()) {
        await dateFrom.fill('2026-01-01')
        await dateTo.fill('2026-12-31')
      }

      const genBtn = page.locator('button:has-text("Generate"), button:has-text("Run Report"), button:has-text("Run")').first()
      if (await genBtn.count()) {
        await genBtn.click()
        await page.waitForTimeout(1500)
      }

      const errorBoundary = await h.hasErrorBoundary(page)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      console.log('has error boundary:', errorBoundary)
      console.log('contains "NaN":', bodyText.includes('NaN'))
      console.log('contains "undefined":', bodyText.includes('undefined'))
      if (expectBadge) {
        console.log(`contains "${expectBadge}" badge:`, bodyText.includes(expectBadge))
        console.log('contains "Not Balanced":', bodyText.includes('Not Balanced'))
      }
      await h.shot(page, `${tileLabel.replace(/\s+/g, '-').toLowerCase()}-rendered`)
    }
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
  }
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
