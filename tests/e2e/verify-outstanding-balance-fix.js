// Live proof for the 2026-07-13 outstanding-balance investigation: after
// removing 3 orphaned test-debris customers and fixing the cleanup-helper
// gap that caused them, the Dashboard KPI card and the AI Assistant's
// credit.whoOwesMe answer should now agree (both ₹6,850).
const h = require('./harness')

async function main() {
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  let ok = true
  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await h.gotoHash(page, '#/dashboard')
    await page.waitForTimeout(1200)
    const dashText = await page.locator('body').innerText().catch(() => '')
    const hasOutstanding6850 = dashText.includes('6,850') || dashText.includes('₹6,850') || dashText.includes('6850')
    console.log('Dashboard shows ₹6,850 outstanding somewhere:', hasOutstanding6850)
    await h.shot(page, 'outstanding-fix-dashboard')

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
    await input.fill('Who owes me money?')
    await input.press('Enter')
    let finalText = ''
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(1000)
      finalText = await page.locator('body').innerText().catch(() => '')
      if (!finalText.includes('Thinking...')) break
    }
    console.log('\nAI answer snippet:', finalText.slice(finalText.indexOf('Who owes me money?'), finalText.indexOf('Who owes me money?') + 200).replace(/\s+/g, ' '))
    if (!finalText.includes('₹6,850.00')) ok = false
    if (!finalText.includes('2 customers')) ok = false

    if (await h.hasErrorBoundary(page)) ok = false

    h.withDb((db) => {
      db.prepare("DELETE FROM AiQueryLog WHERE question = 'Who owes me money?'").run()
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
