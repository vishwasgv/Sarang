// One-off: the AI test-data setup already created production order
// PO-00011 (AI Demo Widget) through the real UI; this just starts and
// completes it via IPC (matching the existing e2e suite's own pattern for
// production lifecycle transitions — 03-logistics-manufacturing.js doesn't
// drive Start/Complete through the UI either).
const h = require('./harness')

async function main() {
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  let ok = true
  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    const orderId = process.argv[2]
    if (!orderId) throw new Error('Usage: node finish-production-order.js <orderId>')

    const startRes = await page.evaluate((id) => window.api.production.start({ id }), orderId)
    console.log('start:', JSON.stringify(startRes).slice(0, 200))
    if (!startRes.success) ok = false

    const completeRes = await page.evaluate((id) => window.api.production.complete({ id, producedQty: 5 }), orderId)
    console.log('complete:', JSON.stringify(completeRes).slice(0, 200))
    if (!completeRes.success) ok = false
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
