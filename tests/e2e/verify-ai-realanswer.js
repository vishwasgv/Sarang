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
    await input.fill('Who owes me money?')
    await input.press('Enter')

    console.log('Waiting up to 120s for a real answer...')
    let finalText = ''
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(2000)
      finalText = await page.locator('body').innerText().catch(() => '')
      if (!finalText.includes('Thinking...')) break
    }
    await h.shot(page, 'ai-realanswer-outstanding')
    console.log('\n=== Full page text after answer ===')
    console.log(finalText)

    const logRow = h.withDb((db) => db.prepare("SELECT * FROM AiQueryLog ORDER BY createdAt DESC LIMIT 1").get())
    console.log('\nAiQueryLog row:', logRow ? { question: logRow.question, matchedTemplate: logRow.matchedTemplate, success: logRow.success, executionTimeMs: logRow.executionTimeMs } : null)

    if (!logRow || logRow.matchedTemplate !== 'credit.whoOwesMe' || logRow.success !== 1) ok = false
    if (await h.hasErrorBoundary(page)) ok = false

    // Cleanup
    h.withDb((db) => {
      db.prepare("DELETE FROM AiQueryLog WHERE question = 'Who owes me money?'").run()
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
