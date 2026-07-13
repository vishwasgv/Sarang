// Full, real-data question battery requested 2026-07-13: "fill all the data
// and try asking all possible question to AI assistant atleast 5-10 ...
// note down time taken to answer each ... test it on the settings screen
// too." Data was seeded separately by setup-ai-full-test-data.js +
// finish-production-order.js through the real UI/IPC. This script only
// asks questions and records results — ground truth for each question was
// computed independently via direct DB queries (see conversation) before
// this ran, so the accuracy judgment isn't circular.
const h = require('./harness')

const QUESTIONS = [
  { q: 'How much did I sell today?', expectTemplate: 'sales.totalToday' },
  { q: "What's low on stock?", expectTemplate: 'inventory.lowStock' },
  { q: 'What are my best-selling products?', expectTemplate: 'inventory.topRevenueProducts' },
  { q: 'Who owes me money?', expectTemplate: 'credit.whoOwesMe' },
  { q: 'What is my profit this month?', expectTemplate: 'finance.profitAndLoss' },
  { q: 'How is production going this month?', expectTemplate: 'manufacturing.production' },
  { q: 'Who do I buy the most from?', expectTemplate: 'suppliers.topByPurchaseVolume' },
  { q: 'What products have not sold in the last 3 days?', expectTemplate: 'inventory.deadStock' },
  { q: 'Should I file GST this month and what rate should I use?', expectTemplate: null }, // refusal
  { q: 'What is the weather like today?', expectTemplate: null }, // out-of-scope
  { q: 'How does this month compare to last month?', expectTemplate: 'sales.compareToPreviousPeriod' }
]

async function main() {
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  let ok = true
  const results = []
  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    // ── Settings screen check ──────────────────────────────────────────
    console.log('\n=== Settings screen: AI Assistant section ===')
    await h.gotoHash(page, '#/settings')
    await page.waitForTimeout(1200)
    await page.getByText('AI Assistant', { exact: true }).click()
    await page.waitForTimeout(500)
    const settingsSectionText = await page.locator('body').innerText().catch(() => '')
    const hasAiSection = settingsSectionText.includes('AI Assistant')
    console.log('AI Assistant section renders on Settings:', hasAiSection)
    await h.shot(page, 'full-battery-settings-section')
    const aiSwitch = page.locator('button[role="switch"]').first()
    const wasOn = (await aiSwitch.getAttribute('aria-checked')) === 'true'
    console.log('AI Assistant currently enabled:', wasOn)
    if (!wasOn) {
      await aiSwitch.click()
      await page.waitForTimeout(800)
      const nowOn = (await aiSwitch.getAttribute('aria-checked')) === 'true'
      console.log('Toggled ON, now:', nowOn)
      if (!nowOn) ok = false
    }
    if (!hasAiSection) ok = false

    // ── Question battery ──────────────────────────────────────────────
    await h.gotoHash(page, '#/ai-assistant')
    await page.waitForTimeout(800)
    const input = page.locator('input[placeholder="Ask a question about your business..."]')

    for (const item of QUESTIONS) {
      const t0 = Date.now()
      await input.fill(item.q)
      await input.press('Enter')
      let finalText = ''
      let sawThinking = false
      for (let i = 0; i < 90; i++) {
        await page.waitForTimeout(1000)
        finalText = await page.locator('body').innerText().catch(() => '')
        if (finalText.includes('Thinking...')) { sawThinking = true; continue }
        break
      }
      const clientMs = Date.now() - t0
      const log = h.withDb((db) => db.prepare("SELECT * FROM AiQueryLog ORDER BY createdAt DESC LIMIT 1").get())
      // Extract just this question's answer bubble — the last assistant
      // message in the DOM, by taking everything after the last occurrence
      // of the question text itself.
      const idx = finalText.lastIndexOf(item.q)
      const answerSnippet = idx >= 0 ? finalText.slice(idx + item.q.length, idx + item.q.length + 400).trim() : '(could not isolate answer)'

      const result = {
        question: item.q,
        expectTemplate: item.expectTemplate,
        matchedTemplate: log?.matchedTemplate ?? null,
        matchedCategory: log?.matchedCategory ?? null,
        success: log?.success ?? null,
        serverExecutionMs: log?.executionTimeMs ?? null,
        clientWallClockMs: clientMs,
        sawThinkingIndicator: sawThinking,
        answerSnippet: answerSnippet.replace(/\s+/g, ' ').trim()
      }
      results.push(result)
      console.log(`\nQ: "${item.q}"`)
      console.log(`  matchedTemplate=${result.matchedTemplate} (expected ${item.expectTemplate ?? 'null/refusal'})  category=${result.matchedCategory}  success=${result.success}`)
      console.log(`  serverExecutionMs=${result.serverExecutionMs}  clientWallClockMs=${result.clientWallClockMs}`)
      console.log(`  answer: ${result.answerSnippet}`)

      await page.waitForTimeout(500)
    }

    await h.shot(page, 'full-battery-final-chat')

    console.log('\n\n=== SUMMARY TABLE ===')
    console.table(results.map(r => ({
      question: r.question.slice(0, 40),
      template: r.matchedTemplate,
      serverMs: r.serverExecutionMs,
      clientMs: r.clientWallClockMs
    })))

    if (await h.hasErrorBoundary(page)) ok = false

    // Cleanup query log entries created by this run
    h.withDb((db) => {
      const stmt = db.prepare('DELETE FROM AiQueryLog WHERE question = ?')
      for (const item of QUESTIONS) stmt.run(item.q)
    })

    // Restore AI toggle to whatever it was before this run
    await h.gotoHash(page, '#/settings')
    await page.waitForTimeout(800)
    await page.getByText('AI Assistant', { exact: true }).click()
    await page.waitForTimeout(500)
    const finalSwitch = page.locator('button[role="switch"]').first()
    const finalOn = (await finalSwitch.getAttribute('aria-checked')) === 'true'
    if (finalOn !== wasOn) {
      await finalSwitch.click()
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
