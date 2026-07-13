// Live proof for the 2026-07-13 dashboard-question-handoff change: the
// owner types a question directly into the Dashboard's "Ask Sarang" box,
// and it should navigate to the dedicated AI Assistant screen and get
// auto-asked there (DashboardScreen.tsx's handleAskFromDashboard hands the
// question over via router state; AiAssistantScreen.tsx's initialQuestion
// effect consumes it).
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
    const aiSwitch = page.locator('button[role="switch"]').first()
    if ((await aiSwitch.getAttribute('aria-checked')) !== 'true') {
      await aiSwitch.click()
      await page.waitForTimeout(800)
    }

    await h.gotoHash(page, '#/dashboard')
    await page.waitForTimeout(1200)

    const dashInput = page.getByPlaceholder('Ask Sarang about your sales, stock, customers, or profit...')
    const dashInputVisible = await dashInput.isVisible().catch(() => false)
    console.log('Dashboard question input visible:', dashInputVisible)
    if (!dashInputVisible) ok = false

    await dashInput.fill('How much did I sell today?')
    await h.shot(page, 'ai-handoff-dashboard-typed')
    await dashInput.press('Enter')
    await page.waitForTimeout(1000)

    const urlAfterSubmit = await page.evaluate(() => location.hash)
    console.log('URL after submitting from dashboard:', urlAfterSubmit)
    if (!urlAfterSubmit.includes('ai-assistant')) ok = false

    // The question should appear as a user bubble immediately (handleAsk
    // fired synchronously via the initialQuestion effect), then get
    // answered without the owner needing to retype or press Ask again.
    let finalText = ''
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(1000)
      finalText = await page.locator('body').innerText().catch(() => '')
      if (!finalText.includes('Thinking...')) break
    }
    await h.shot(page, 'ai-handoff-answered')
    console.log('\n=== AI Assistant screen after handoff ===')
    console.log(finalText)

    if (!finalText.includes('How much did I sell today?')) ok = false

    const log = h.withDb((db) => db.prepare("SELECT * FROM AiQueryLog ORDER BY createdAt DESC LIMIT 1").get())
    console.log('AiQueryLog:', log ? { matchedTemplate: log.matchedTemplate, success: log.success, executionTimeMs: log.executionTimeMs } : null)
    if (!log || log.matchedTemplate !== 'sales.totalToday' || log.question !== 'How much did I sell today?') ok = false

    // Navigating to the AI screen a second time via the sidebar (no
    // handoff state) must NOT re-fire the same question — the
    // location.key guard should make this a clean, empty chat.
    await h.gotoHash(page, '#/dashboard')
    await page.waitForTimeout(500)
    await h.gotoHash(page, '#/ai-assistant')
    await page.waitForTimeout(800)
    // Note: the empty-state suggestion text itself contains the literal
    // substring 'How much did I sell today?' as an example prompt — so the
    // real signal isn't "is that substring absent" but "did the actual
    // chat-bubble empty-state render" (no user/assistant message bubbles).
    const secondVisitEmpty = await page.getByText('Try "How much did I sell today?"').isVisible().catch(() => false)
    console.log('\n=== Plain sidebar re-visit — empty-state (no stale chat) shown:', secondVisitEmpty, '===')
    if (!secondVisitEmpty) ok = false

    if (await h.hasErrorBoundary(page)) ok = false

    // Cleanup
    h.withDb((db) => {
      db.prepare("DELETE FROM AiQueryLog WHERE question = 'How much did I sell today?'").run()
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
