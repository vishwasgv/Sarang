// Re-verifies the two real bugs found by the full question battery
// (2026-07-13): the negative-netProfit sign-stripping bug and the
// "who do I buy the most from" misclassification, against the real running
// app with the fixes applied.
const h = require('./harness')

const QUESTIONS = [
  { q: 'What is my profit this month?', expectTemplate: 'finance.profitAndLoss' },
  { q: 'Who do I buy the most from?', expectTemplate: 'suppliers.topByPurchaseVolume' }
]

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
    const aiSwitch = page.locator('button[role="switch"]').first()
    if ((await aiSwitch.getAttribute('aria-checked')) !== 'true') {
      await aiSwitch.click()
      await page.waitForTimeout(800)
    }

    await h.gotoHash(page, '#/ai-assistant')
    await page.waitForTimeout(800)
    const input = page.locator('input[placeholder="Ask a question about your business..."]')

    for (const item of QUESTIONS) {
      const t0 = Date.now()
      await input.fill(item.q)
      await input.press('Enter')
      let finalText = ''
      for (let i = 0; i < 60; i++) {
        await page.waitForTimeout(1000)
        finalText = await page.locator('body').innerText().catch(() => '')
        if (!finalText.includes('Thinking...')) break
      }
      const clientMs = Date.now() - t0
      const log = h.withDb((db) => db.prepare("SELECT * FROM AiQueryLog ORDER BY createdAt DESC LIMIT 1").get())
      const idx = finalText.lastIndexOf(item.q)
      const answerSnippet = idx >= 0 ? finalText.slice(idx + item.q.length, idx + item.q.length + 400).trim() : '(?)'
      console.log(`\nQ: "${item.q}"`)
      console.log(`  matchedTemplate=${log?.matchedTemplate} (expected ${item.expectTemplate})  serverMs=${log?.executionTimeMs}  clientMs=${clientMs}`)
      console.log(`  answer: ${answerSnippet.replace(/\s+/g, ' ').trim()}`)
      if (log?.matchedTemplate !== item.expectTemplate) ok = false
    }

    // Assertion detail for the loss fix specifically
    const lossLog = h.withDb((db) => db.prepare("SELECT * FROM AiQueryLog WHERE question = ? ORDER BY createdAt DESC LIMIT 1").get('What is my profit this month?'))
    console.log('\nP&L log row:', lossLog ? { matchedTemplate: lossLog.matchedTemplate, success: lossLog.success } : null)

    if (await h.hasErrorBoundary(page)) ok = false

    h.withDb((db) => {
      const stmt = db.prepare('DELETE FROM AiQueryLog WHERE question = ?')
      for (const item of QUESTIONS) stmt.run(item.q)
    })
    await h.gotoHash(page, '#/settings')
    await page.waitForTimeout(800)
    await page.getByText('AI Assistant', { exact: true }).click()
    await page.waitForTimeout(500)
    const cleanupSwitch = page.locator('button[role="switch"]').first()
    if ((await cleanupSwitch.getAttribute('aria-checked')) === 'true') {
      await cleanupSwitch.click()
      await page.waitForTimeout(500)
    }
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
