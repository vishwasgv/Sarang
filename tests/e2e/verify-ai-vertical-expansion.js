// Live proof that the extended vertical coverage (2026-07-13) actually
// works, not just typechecks — tests the new manufacturing.production
// template on the dev DB's current business type (MANUFACTURING).
const h = require('./harness')

async function main() {
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  let ok = true
  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await h.gotoHash(page, '#/settings')
    await page.waitForTimeout(1200)
    await page.getByText('AI Assistant', { exact: true }).click()
    await page.waitForTimeout(500)
    await page.locator('button[role="switch"]').first().click()
    await page.waitForTimeout(800)

    await h.gotoHash(page, '#/ai-assistant')
    await page.waitForTimeout(800)

    const input = page.locator('input[placeholder="Ask a question about your business..."]')
    await input.fill('How is production going this month?')
    const t0 = Date.now()
    await input.press('Enter')
    let finalText = ''
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(1000)
      finalText = await page.locator('body').innerText().catch(() => '')
      if (!finalText.includes('Thinking...')) break
    }
    const clientMs = Date.now() - t0
    await h.shot(page, 'ai-vertical-expansion-production')
    console.log('client latency:', clientMs, 'ms')
    console.log('\n=== body text ===')
    console.log(finalText)

    const log = h.withDb((db) => db.prepare("SELECT * FROM AiQueryLog ORDER BY createdAt DESC LIMIT 1").get())
    console.log('\nAiQueryLog:', log ? { matchedTemplate: log.matchedTemplate, matchedCategory: log.matchedCategory, success: log.success, executionTimeMs: log.executionTimeMs } : null)

    if (!log || log.matchedTemplate !== 'manufacturing.production') ok = false
    if (log?.matchedCategory !== 'vertical') ok = false
    if (await h.hasErrorBoundary(page)) ok = false

    h.withDb((db) => {
      db.prepare("DELETE FROM AiQueryLog WHERE question = 'How is production going this month?'").run()
    })
    await h.gotoHash(page, '#/settings')
    await page.waitForTimeout(800)
    await page.getByText('AI Assistant', { exact: true }).click()
    await page.waitForTimeout(500)
    await page.locator('button[role="switch"]').first().click()
    await page.waitForTimeout(500)
  } catch (e) {
    console.error('FATAL', e)
    ok = false
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
  }
  console.log('\n=== RESULT:', ok ? 'PASS' : 'FAIL', '===')
  process.exit(ok ? 0 : 1)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
