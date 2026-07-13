const h = require('./harness')

async function main() {
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  try {
    const page = await h.getMainWindow(app)
    await h.login(page)
    await h.gotoHash(page, '#/settings')
    await page.waitForTimeout(1500)
    const text = await page.locator('body').innerText().catch(() => '')
    console.log('=== Settings screen body text ===')
    console.log(text)
    console.log('\ncontains "AI Assistant":', text.includes('AI Assistant'))
    await h.shot(page, 'diag-settings-screen')
  } catch (e) {
    console.error('FATAL', e)
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
  }
  process.exit(0)
}
main()
