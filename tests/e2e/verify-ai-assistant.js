// One-off live verification for the AI Assistant (Phase 57) — the real
// packaged pipeline (real Qwen2.5-1.5B-Instruct model, real IPC, real
// Settings toggle, real sidebar gating), not the isolated scratch benchmark
// or the FakeAIProvider unit tests. This is the first time the whole
// system has been driven end-to-end together.
const h = require('./harness')

async function main() {
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  let ok = true
  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    console.log('\n=== Confirm AI Assistant is OFF by default, zero sidebar footprint ===')
    const bodyBefore = await page.locator('body').innerText().catch(() => '')
    console.log('sidebar shows "Ask Sarang" before enabling:', bodyBefore.includes('Ask Sarang'))
    if (bodyBefore.includes('Ask Sarang')) ok = false

    console.log('\n=== Enable AI Assistant in Settings ===')
    await h.gotoHash(page, '#/settings')
    await page.waitForTimeout(600)
    await page.getByText('AI Assistant', { exact: true }).click()
    await page.waitForTimeout(400)
    const toggle = page.locator('button[role="switch"]').first()
    await toggle.click()
    await page.waitForTimeout(800)
    const settingsText = await page.locator('body').innerText().catch(() => '')
    console.log('toggle enabled, error boundary:', await h.hasErrorBoundary(page))
    await h.shot(page, 'ai-settings-enabled')

    console.log('\n=== Confirm "Ask Sarang" now appears in sidebar ===')
    await page.reload()
    await page.waitForTimeout(1200)
    const bodyAfter = await page.locator('body').innerText().catch(() => '')
    console.log('sidebar shows "Ask Sarang" after enabling:', bodyAfter.includes('Ask Sarang'))
    if (!bodyAfter.includes('Ask Sarang')) ok = false

    console.log('\n=== Navigate to Ask Sarang, ask a REAL question against the REAL model ===')
    await h.gotoHash(page, '#/ai-assistant')
    await page.waitForTimeout(800)
    await h.shot(page, 'ai-assistant-empty-state')
    console.log('error boundary on empty state:', await h.hasErrorBoundary(page))

    const input = page.locator('input[placeholder="Ask a question about your business..."]')
    await input.fill('How much did I sell today?')
    await input.press('Enter')
    await page.waitForTimeout(1000)
    await h.shot(page, 'ai-assistant-thinking')
    const thinkingText = await page.locator('body').innerText().catch(() => '')
    console.log('shows "Thinking..." state:', thinkingText.includes('Thinking'))

    // Real cold-start model load + inference — genuinely slow (benchmarked
    // ~4s load + ~28s first pipeline call). Give this a very generous
    // timeout rather than a flaky short one.
    console.log('Waiting up to 120s for a real answer from the real model...')
    let answered = false
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(2000)
      const t = await page.locator('body').innerText().catch(() => '')
      if (!t.includes('Thinking...')) { answered = true; break }
    }
    console.log('model responded within timeout:', answered)
    await h.shot(page, 'ai-assistant-answered')

    const finalText = await page.locator('body').innerText().catch(() => '')
    console.log('error boundary after answer:', await h.hasErrorBoundary(page))
    console.log('response contains an error message:', /something went wrong|not enabled/i.test(finalText))
    if (!answered) ok = false
    if (await h.hasErrorBoundary(page)) ok = false

    console.log('\n=== Verify a real AiQueryLog row was written ===')
    const logRow = h.withDb((db) => db.prepare("SELECT * FROM AiQueryLog ORDER BY createdAt DESC LIMIT 1").get())
    console.log('AiQueryLog row:', logRow ? { question: logRow.question, matchedTemplate: logRow.matchedTemplate, matchedCategory: logRow.matchedCategory, success: logRow.success, executionTimeMs: logRow.executionTimeMs } : null)
    if (!logRow || logRow.question !== 'How much did I sell today?') ok = false

    console.log('\n=== Disable AI Assistant, confirm sidebar item disappears again ===')
    await h.gotoHash(page, '#/settings')
    await page.waitForTimeout(600)
    await page.getByText('AI Assistant', { exact: true }).click()
    await page.waitForTimeout(400)
    await page.locator('button[role="switch"]').first().click()
    await page.waitForTimeout(800)
    await page.reload()
    await page.waitForTimeout(1200)
    const bodyFinal = await page.locator('body').innerText().catch(() => '')
    console.log('sidebar shows "Ask Sarang" after disabling:', bodyFinal.includes('Ask Sarang'))
    if (bodyFinal.includes('Ask Sarang')) ok = false

    console.log('\n=== Cleanup: clear the test AiQueryLog row ===')
    h.withDb((db) => {
      db.prepare("DELETE FROM AiQueryLog WHERE question = 'How much did I sell today?'").run()
    })
    console.log('cleanup done')
  } catch (e) {
    console.error('FATAL DURING VERIFICATION', e)
    ok = false
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
  }
  console.log('\n=== RESULT:', ok ? 'PASS' : 'FAIL', '===')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
