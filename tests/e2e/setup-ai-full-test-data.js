// One-off data-setup script for a thorough, real-data AI Assistant test
// (requested 2026-07-13: "fill all the data and try asking all possible
// questions"). Adds a supplier + purchase order, a raw-material/BOM/
// production-order chain (for the manufacturing.production vertical
// template), a fresh customer with a partially-paid credit invoice, a
// same-day cash invoice, and an expense — through the real UI wherever the
// app has one, via window.api IPC only for the parts the existing e2e suite
// (03-logistics-manufacturing.js) already established aren't UI-tested
// (raw material + BOM creation).
const h = require('./harness')

async function main() {
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  let ok = true
  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    // ── 1. Supplier ──────────────────────────────────────────────────────
    console.log('\n[1] Adding supplier...')
    await h.gotoHash(page, '#/suppliers')
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: 'Add Supplier' }).click()
    let modal = h.topModal(page)
    await modal.getByLabel('Supplier Name *').fill('AI Test Supplier Co')
    await modal.getByLabel('Phone').fill('9812300001')
    await modal.getByRole('button', { name: 'Add Supplier', exact: true }).click()
    await page.waitForTimeout(1000)
    console.log('  supplier added')

    // ── 2. Purchase Order ────────────────────────────────────────────────
    console.log('\n[2] Creating purchase order...')
    await h.gotoHash(page, '#/purchase-orders')
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: 'New PO' }).click()
    modal = h.topModal(page)
    await modal.locator('select').first().selectOption({ index: 1 }) // skip placeholder option; only one real supplier exists
    await modal.locator('input[placeholder="Search product…"]').first().fill('UAT GST Product')
    await page.waitForTimeout(600)
    await modal.locator('button', { hasText: 'UAT GST Product' }).first().click()
    await page.waitForTimeout(300)
    const numberInputs = modal.locator('input[type="number"]')
    const n = await numberInputs.count()
    console.log('  PO form number inputs found:', n)
    if (n >= 1) await numberInputs.nth(0).fill('20') // quantity
    if (n >= 2) await numberInputs.nth(1).fill('60') // unit cost
    await modal.getByRole('button', { name: /Save as Draft|Create|Save PO/i }).click()
    await page.waitForTimeout(1200)
    console.log('  PO created (or attempted — see screenshot on failure)')
    await h.shot(page, 'setup-po-result')

    // ── 3. Raw material + BOM (via IPC, matching existing suite pattern) ──
    console.log('\n[3] Creating raw material + finished product + BOM via IPC...')
    const rm = await page.evaluate(() => window.api.rawMaterials.create({
      name: 'AI Test Steel Sheet', unit: 'KG', currentStock: 500, reorderLevel: 20, unitCost: 20
    }))
    console.log('  rawMaterial:', JSON.stringify(rm).slice(0, 200))
    const prod = await page.evaluate(() => window.api.products.create({
      productName: 'AI Demo Widget', productType: 'STANDARD', unit: 'PCS',
      costPrice: 80, sellingPrice: 150, taxRate: 18, openingQuantity: 0
    }))
    console.log('  product:', JSON.stringify(prod).slice(0, 200))
    if (rm.success && prod.success) {
      const bomRes = await page.evaluate(({ productId, rawMaterialId }) => window.api.bom.upsert({
        productId, outputQty: 1, items: [{ rawMaterialId, quantityNeeded: 2 }]
      }), { productId: prod.data.id, rawMaterialId: rm.data.id })
      console.log('  bom upsert:', JSON.stringify(bomRes).slice(0, 200))
    } else {
      ok = false
    }

    // ── 4. Production order (UI-driven creation, IPC start/complete) ──────
    console.log('\n[4] Creating production order via UI...')
    await h.gotoHash(page, '#/manufacturing/production')
    await page.waitForTimeout(800)
    await page.locator('button', { hasText: 'New Production Order' }).first().click()
    modal = h.topModal(page)
    await modal.getByPlaceholder('Search product by name or SKU…').fill('AI Demo Widget')
    await page.waitForTimeout(600)
    await modal.locator('button', { hasText: 'AI Demo Widget' }).first().click()
    await modal.getByPlaceholder('Enter units to produce').fill('5')
    await modal.locator('button', { hasText: 'New Production Order' }).last().click()
    await page.waitForTimeout(1200)
    await h.shot(page, 'setup-production-order-result')

    const orders = await page.evaluate(() => window.api.production.list({}))
    const myOrder = orders?.data?.orders?.find?.((o) => o.productName === 'AI Demo Widget')
    console.log('  production order found:', myOrder ? { id: myOrder.id, status: myOrder.status } : null)
    if (myOrder) {
      const startRes = await page.evaluate((id) => window.api.production.start({ id }), myOrder.id)
      console.log('  start:', JSON.stringify(startRes).slice(0, 150))
      const completeRes = await page.evaluate((id) => window.api.production.complete({ id, producedQty: 5 }), myOrder.id)
      console.log('  complete:', JSON.stringify(completeRes).slice(0, 150))
    } else {
      ok = false
    }

    // ── 5. Fresh customer ───────────────────────────────────────────────
    console.log('\n[5] Adding customer...')
    await h.gotoHash(page, '#/customers')
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: 'Add Customer' }).click()
    modal = h.topModal(page)
    await modal.getByLabel('Customer Name *').fill('AI Test Customer')
    await modal.getByLabel('Phone').fill('9812300002')
    await modal.getByRole('button', { name: 'Add Customer', exact: true }).click()
    await page.waitForTimeout(1000)
    console.log('  customer added')

    // ── 6. Same-day CASH invoice (for "today's sales") ───────────────────
    console.log('\n[6] Creating a same-day CASH invoice...')
    await h.gotoHash(page, '#/billing/new')
    await page.waitForTimeout(800)
    await page.locator('input[placeholder="Search products…"]').fill('UAT GST Product')
    await page.waitForTimeout(700)
    await page.locator('button', { hasText: 'UAT GST Product' }).first().click()
    await page.waitForTimeout(300)
    await page.locator('input[type="number"][min="0.001"]').first().fill('2')
    await page.getByRole('button', { name: 'Cash', exact: true }).click()
    await page.keyboard.press('F10')
    await page.waitForTimeout(1800)
    const urlAfterCash = await page.evaluate(() => location.hash)
    console.log('  URL after cash invoice submit:', urlAfterCash)
    await h.shot(page, 'setup-cash-invoice-result')

    // ── 7. CREDIT invoice for the new customer + partial payment ─────────
    console.log('\n[7] Creating a CREDIT invoice for AI Test Customer...')
    await h.gotoHash(page, '#/billing/new')
    await page.waitForTimeout(800)
    await page.locator('input[placeholder="Search products…"]').fill('UAT GST Product')
    await page.waitForTimeout(700)
    await page.locator('button', { hasText: 'UAT GST Product' }).first().click()
    await page.waitForTimeout(300)
    await page.locator('input[type="number"][min="0.001"]').first().fill('5')
    await page.locator('input[placeholder="Search customers…"]').fill('AI Test Customer')
    await page.waitForTimeout(700)
    await page.locator('button', { hasText: 'AI Test Customer' }).first().click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Credit (Pay Later)', exact: true }).click()
    await page.keyboard.press('F10')
    await page.waitForTimeout(1800)
    const urlAfterCredit = await page.evaluate(() => location.hash)
    console.log('  URL after credit invoice submit:', urlAfterCredit)
    await h.shot(page, 'setup-credit-invoice-result')

    if (urlAfterCredit.includes('/billing/') && !urlAfterCredit.includes('/billing/new')) {
      await page.waitForTimeout(800)
      const recordPaymentBtn = page.getByRole('button', { name: /Record Payment/i })
      if (await recordPaymentBtn.isVisible().catch(() => false)) {
        await recordPaymentBtn.click()
        modal = h.topModal(page)
        await modal.locator('button', { hasText: 'CASH' }).click()
        await modal.locator('input[type="number"][min="0.01"]').fill('50')
        await modal.getByRole('button', { name: 'Record Payment', exact: true }).click()
        await page.waitForTimeout(1200)
        console.log('  partial payment of 50 recorded')
        await h.shot(page, 'setup-partial-payment-result')
      } else {
        console.log('  WARNING: Record Payment button not visible, skipping partial payment')
      }
    } else {
      ok = false
    }

    // ── 8. Expense ────────────────────────────────────────────────────────
    console.log('\n[8] Adding an expense...')
    await h.gotoHash(page, '#/expenses')
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: 'Add Expense' }).click()
    modal = h.topModal(page)
    await modal.locator('select').first().selectOption({ index: 1 })
    await modal.getByLabel(/Expense Name/).fill('AI Test Office Supplies')
    await modal.getByLabel(/Amount/).fill('750')
    await modal.getByRole('button', { name: 'Add Expense', exact: true }).click()
    await page.waitForTimeout(1000)
    console.log('  expense added')

    if (await h.hasErrorBoundary(page)) ok = false
  } catch (e) {
    console.error('FATAL', e)
    ok = false
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
  }
  console.log('\n=== SETUP RESULT:', ok ? 'PASS (or partial — check step logs above)' : 'FAIL', '===')
  process.exit(ok ? 0 : 1)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
