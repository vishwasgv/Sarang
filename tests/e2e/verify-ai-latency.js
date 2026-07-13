// Live measurement of the two response paths after the 2026-07-13 latency
// fixes: the deterministic fast-path (should skip the model entirely) and
// the LLM-fallback path (should be roughly half the old total now that the
// phrasing call is gone).
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

    async function ask(question) {
      const input = page.locator('input[placeholder="Ask a question about your business..."]')
      await input.fill(question)
      const t0 = Date.now()
      await input.press('Enter')
      let finalText = ''
      for (let i = 0; i < 60; i++) {
        await page.waitForTimeout(1000)
        finalText = await page.locator('body').innerText().catch(() => '')
        if (!finalText.includes('Thinking...')) break
      }
      const clientMs = Date.now() - t0
      return { clientMs, finalText }
    }

    console.log('=== Q1: FAST-PATH question ("What were today\'s sales?") ===')
    const r1 = await ask("What were today's sales?")
    console.log('client-observed latency:', r1.clientMs, 'ms')
    await h.shot(page, 'ai-latency-fastpath')
    let log1 = h.withDb((db) => db.prepare("SELECT * FROM AiQueryLog ORDER BY createdAt DESC LIMIT 1").get())
    console.log('AiQueryLog:', log1 ? { matchedTemplate: log1.matchedTemplate, success: log1.success, executionTimeMs: log1.executionTimeMs } : null)

    await page.waitForTimeout(1500)

    console.log('\n=== Q2: LLM-FALLBACK question (deliberately un-pattern-matched phrasing) ===')
    const r2 = await ask('Give me a rundown of who currently has a balance with me')
    console.log('client-observed latency:', r2.clientMs, 'ms')
    await h.shot(page, 'ai-latency-fallback')
    let log2 = h.withDb((db) => db.prepare("SELECT * FROM AiQueryLog ORDER BY createdAt DESC LIMIT 1").get())
    console.log('AiQueryLog:', log2 ? { matchedTemplate: log2.matchedTemplate, matchedCategory: log2.matchedCategory, success: log2.success, executionTimeMs: log2.executionTimeMs } : null)

    if (!log1 || log1.matchedTemplate !== 'sales.totalToday') ok = false
    if (r1.clientMs > 10000) { console.log('WARNING: fast-path exceeded 10s client-observed'); }
    if (await h.hasErrorBoundary(page)) ok = false

    h.withDb((db) => {
      db.prepare("DELETE FROM AiQueryLog WHERE question IN (?, ?)").run("What were today's sales?", 'Give me a rundown of who currently has a balance with me')
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
