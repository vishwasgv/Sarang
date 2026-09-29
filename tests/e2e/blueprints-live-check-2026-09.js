/**
 * J19 — Blueprints, live UI check. Defines stages via the real Settings card, then verifies
 * the stage-tracker widget on a real Sales Order's detail screen: renders nothing before any
 * stage exists, appears once stages are defined, and a click actually advances the document's
 * real stage via the real IPC round-trip.
 *
 * Not part of run-all.js — standalone, run directly:
 *   node tests/e2e/blueprints-live-check-2026-09.js
 */
const h = require('./harness')

async function main() {
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const page = await h.getMainWindow(app)
  const r = h.makeResults()

  try {
    await h.login(page)

    // ── Seed a real customer + product + Sales Order to attach the widget to ──
    const customer = await page.evaluate(() => window.api.customers.create({ customerName: `BP-check customer ${Date.now()}`, phone: `9${String(Date.now()).slice(-9)}` }))
    const product = await page.evaluate(() => window.api.products.create({ productName: 'BP-check item', productType: 'STANDARD', unit: 'PCS', costPrice: 100, sellingPrice: 200, taxRate: 18, sku: `BPCHECK-${Date.now()}` }))
    r.log('seed-customer', !!customer?.data?.id, JSON.stringify(customer))
    r.log('seed-product', !!product?.data?.id, JSON.stringify(product))
    const so = await page.evaluate(({ cid, pid }) => window.api.salesOrders.create({
      customerId: cid, items: [{ productId: pid, productName: 'BP-check item', quantity: 1, unitPrice: 200, taxRate: 18, discount: 0 }]
    }), { cid: customer.data.id, pid: product.data.id })
    const soId = so?.data?.id
    r.log('create-sales-order', !!soId, JSON.stringify(so))

    // ── Before any stage exists, the widget must render nothing (no "Stage" label) ──
    await h.gotoHash(page, `#/sales-orders/${soId}`)
    await page.waitForTimeout(900)
    const trackerBefore = await page.getByText('Stage', { exact: true }).count()
    r.log('no-stage-widget-before-any-stage-defined', trackerBefore === 0, `count=${trackerBefore}`)

    // ── Define 3 real stages for SALES_ORDER via the real Settings card ────────
    await h.gotoHash(page, '#/settings')
    await page.waitForTimeout(500)
    await page.locator('button', { hasText: 'Business features' }).first().click().catch(() => {})
    await page.waitForTimeout(500)
    // Business features might already be the default tab — fall back to direct nav if the
    // sidebar-tab click above found nothing.
    const stageNameInputs = page.locator('input[placeholder="Stage name"]')
    if (await stageNameInputs.count() === 0) {
      const sections = page.locator('button', { hasText: 'Business Features' })
      if (await sections.count() > 0) { await sections.first().click(); await page.waitForTimeout(500) }
    }
    r.log('blueprints-card-visible', await page.locator('input[placeholder="Stage name"]').count() > 0)

    // Several settings cards on this tab (WorkflowRulesCard etc.) share the same generic
    // "Add" button text — scope to the specific row that actually holds the Stage name input,
    // not just the first "Add" button on the whole page.
    const addRow = page.locator('div', { has: page.locator('input[placeholder="Stage name"]') }).last()
    const stageNames = ['Draft', 'Approved', 'Shipped']
    for (const name of stageNames) {
      await addRow.locator('input[placeholder="Stage name"]').fill(name)
      await addRow.locator('button', { hasText: 'Add' }).first().click()
      await page.waitForTimeout(500)
    }
    const bodyAfterAdd = await page.locator('body').innerText().catch(() => '')
    r.log('all-3-stages-added-via-real-ui', stageNames.every((n) => bodyAfterAdd.includes(n)), bodyAfterAdd.slice(0, 400))

    // ── Widget must now appear on the Sales Order screen, defaulting to stage 1 ──
    await h.gotoHash(page, `#/sales-orders/${soId}`)
    await page.waitForTimeout(900)
    const trackerAfter = await page.locator('button', { hasText: 'Draft' }).count()
    r.log('stage-tracker-widget-appears-after-stages-defined', trackerAfter > 0, `before=${trackerBefore} after=${trackerAfter}`)

    // ── Click "Approved" — a real advance through the real IPC handler ─────────
    await page.locator('button', { hasText: 'Approved' }).first().click()
    await page.waitForTimeout(800)
    const current = await page.evaluate(({ dt, did }) => window.api.documentStage.getCurrent({ documentType: dt, documentId: did }), { dt: 'SALES_ORDER', did: soId })
    const approvedStage = (current?.data?.stages || []).find((s) => s.name === 'Approved')
    r.log('click-advanced-real-document-stage', current?.data?.currentStageId === approvedStage?.id, JSON.stringify(current))

    r.log('app-still-responsive', !(await h.hasErrorBoundary(page)))

    // ── Cleanup ──────────────────────────────────────────────────────────────
    // Retire the 3 stages via the real IPC path directly (their real IDs are already known
    // from the `current` response above) — more reliable than re-locating rows through the
    // settings UI, where several sibling cards share the same generic "Delete" button text.
    for (const stage of current?.data?.stages || []) {
      await page.evaluate((id) => window.api.blueprintStages.retire({ id }), stage.id).catch(() => {})
    }
    if (soId) await page.evaluate((id) => window.api.salesOrders.cancel({ id, reason: 'bp check cleanup' }), soId).catch(() => {})
    if (product?.data?.id) {
      await page.evaluate((id) => window.api.inventory.adjustStock({ productId: id, quantity: 0, reason: 'bp check cleanup' }), product.data.id).catch(() => {})
      await page.evaluate((id) => window.api.products.archive(id), product.data.id).catch(() => {})
    }
    if (customer?.data?.id) await page.evaluate((id) => window.api.customers.archive(id), customer.data.id).catch(() => {})
  } finally {
    await h.closeApp(app)
  }

  const s = r.summary()
  console.log(`\n=== BLUEPRINTS LIVE CHECK SUMMARY: ${s.pass}/${s.total} passed ===`)
  process.exit(s.fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
