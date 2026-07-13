// Live proof for the 2026-07-13 simplification: the "Thinking..." bubble
// must stay exactly "Thinking..." for the entire wait, on both a fast-path
// question and a genuinely slow (real model) question — no escalating/
// qualifying text should ever appear, per explicit founder feedback.
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

    await h.gotoHash(page, '#/ai-assistant')
    await page.waitForTimeout(800)
    const input = page.locator('input[placeholder="Ask a question about your business..."]')
    const thinkingBubble = page.locator('text=Thinking...')

    // ── 1. Fast-path question — should barely show "Thinking..." at all ──
    console.log('\n[1] Fast-path question: "How much did I sell today?"')
    await input.fill('How much did I sell today?')
    await input.press('Enter')
    const samples1 = []
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(300)
      const text = await page.locator('body').innerText().catch(() => '')
      if (text.includes('Thinking')) {
        const bubbleText = await thinkingBubble.innerText().catch(() => '(not found)')
        samples1.push(bubbleText)
      }
      if (!text.includes('Thinking...') && !text.includes('Still thinking')) break
    }
    console.log('  samples seen:', JSON.stringify(samples1))
    if (samples1.some((s) => s.includes('Still thinking') || s.includes('up to a minute'))) ok = false

    // ── 2. Genuinely slow question (forces real model classify path) ─────
    console.log('\n[2] Slow/novel question: "How does this month compare to last month?"')
    await input.fill('How does this month compare to last month?')
    await input.press('Enter')
    const samples2 = []
    const t0 = Date.now()
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(1000)
      const text = await page.locator('body').innerText().catch(() => '')
      if (text.includes('Thinking')) {
        const bubbleText = await thinkingBubble.innerText().catch(() => '(not found)')
        samples2.push(bubbleText)
      }
      if (!text.includes('Thinking...') && !text.includes('Still thinking')) break
    }
    const elapsedMs = Date.now() - t0
    console.log('  elapsed:', elapsedMs, 'ms')
    console.log('  unique bubble texts seen over the whole wait:', JSON.stringify([...new Set(samples2)]))
    if (samples2.length === 0) { console.log('  WARNING: never caught the bubble mid-wait (question resolved too fast to sample)'); }
    if (samples2.some((s) => s.includes('Still thinking') || s.includes('up to a minute'))) ok = false
    if (elapsedMs > 3000 && ![...new Set(samples2)].every((s) => s === 'Thinking...')) ok = false

    await h.shot(page, 'thinking-message-simplified-final')

    if (await h.hasErrorBoundary(page)) ok = false

    h.withDb((db) => {
      db.prepare("DELETE FROM AiQueryLog WHERE question IN (?, ?)").run(
        'How much did I sell today?',
        'How does this month compare to last month?'
      )
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
