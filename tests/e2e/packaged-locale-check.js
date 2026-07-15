/**
 * Verifies the locale-formatting fix (2026-07-15) against the real packaged
 * app: printed invoice amounts must show Indian digit grouping (e.g.
 * "14,568.00"), not the bare "14568.00" the old print.service.ts produced.
 */
const { _electron } = require('playwright-core')

const EXE_PATH = 'C:\\Users\\vishw\\AppData\\Local\\Programs\\Sarang Business OS Lite\\Sarang Business OS Lite.exe'
const ADMIN_PASSWORD = 'FreshInstall!2026Test'

async function main() {
  const app = await _electron.launch({ executablePath: EXE_PATH })
  try {
    let page = await app.firstWindow()
    if (page.url().includes('splash.html')) {
      const p = app.waitForEvent('window')
      await page.waitForEvent('close').catch(() => {})
      page = await p
    }
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1500)
    await page.waitForFunction(() => !!window.api, { timeout: 15000 })
    for (let i = 0; i < 6; i++) {
      const who = await page.evaluate(async () => window.api.auth.getCurrentUser()).catch(() => null)
      if (who?.success) break
      const u = page.locator('input[name="username"]')
      if (await u.count()) {
        await u.fill('admin')
        await page.locator('input[name="password"]').fill(ADMIN_PASSWORD)
        await page.locator('button[type="submit"]').click()
      }
      await page.waitForTimeout(1000)
    }
    const skipBtn = page.getByRole('button', { name: 'Skip for now' })
    if (await skipBtn.count()) { await skipBtn.click(); await page.waitForTimeout(500) }

    const custRes = await page.evaluate(() => window.api.customers.create({ customerName: 'Packaged Locale Verify', phone: String(Date.now()).slice(-10) }))
    const prodRes = await page.evaluate(() => window.api.products.create({
      productName: 'Packaged Locale Product', productType: 'STANDARD', unit: 'PCS', costPrice: 5000, sellingPrice: 12345.67, taxRate: 18, openingQuantity: 5,
    }))
    const invRes = await page.evaluate(({ customerId, productId }) => window.api.billing.createInvoice({
      customerId, paymentMethod: 'CASH', items: [{ productId, quantity: 1, unitPrice: 12345.67, taxRate: 18 }],
    }), { customerId: custRes?.data?.id, productId: prodRes?.data?.id })
    const invoiceId = invRes?.data?.id
    console.log('invoice created:', !!invRes?.success, 'total:', invRes?.data?.totalAmount)

    const preview = await page.evaluate((id) => window.api.print.previewInvoice({ invoiceId: id }), invoiceId)
    const html = preview?.data || ''
    const idx = html.indexOf('class="totals-total"')
    const snippet = html.slice(idx, idx + 120)
    console.log('totals-total line:', snippet)
    const hasGrouping = /₹14,568\.00/.test(snippet)
    console.log(hasGrouping ? '[PASS] Indian digit grouping present in packaged app print output' : '[FAIL] digit grouping missing')
    process.exitCode = hasGrouping ? 0 : 1
  } finally {
    await app.close().catch(() => {})
  }
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
