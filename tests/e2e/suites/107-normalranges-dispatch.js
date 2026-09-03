/**
 * Suite 107 — normal-range.handler.ts (save/delete/evaluate) +
 * dispatch.handler.ts (create/updateStatus) (broader-gap-list closure,
 * 2026-09-03). Two unrelated whole-feature gaps closed together.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E NormRange'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    // ── normalRange: save/delete via UI, evaluate/find via API ──────────────
    let rangeId
    await r.step('save-normal-range-via-ui', async () => {
      await h.gotoHash(page, '#/normal-ranges')
      await page.waitForTimeout(700)
      r.log('normal-ranges-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Add Range' }).click()
      await page.waitForTimeout(400)
      await page.getByLabel('Test / Vital Name').fill(`${TEST_PREFIX} Glucose`)
      await page.getByLabel('Min (Normal)').fill('70')
      await page.getByLabel('Max (Normal)').fill('100')
      await page.getByRole('button', { name: 'Save Range' }).click()
      await page.waitForTimeout(1000)
      r.log('normal-range-saved-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.normalRange.list())
      const found = (listRes?.data || []).find((rg) => rg.testName === `${TEST_PREFIX} Glucose`)
      rangeId = found?.id
      r.log('normal-range-persisted', !!rangeId, JSON.stringify(found))
    })

    await r.step('evaluate-and-find-via-api', async () => {
      if (!rangeId) return r.log('evaluate-and-find-via-api', false, 'no rangeId')
      const findRes = await page.evaluate((name) => window.api.normalRange.find({ testName: name, gender: 'ALL' }), `${TEST_PREFIX} Glucose`)
      r.log('find-returns-our-range', findRes?.data?.id === rangeId, JSON.stringify(findRes?.data))

      const lowRes = await page.evaluate((name) => window.api.normalRange.evaluate({ testName: name, value: 50, gender: 'ALL' }), `${TEST_PREFIX} Glucose`)
      r.log('evaluate-flags-low', lowRes?.data?.flag === 'LOW', JSON.stringify(lowRes))

      const normalRes = await page.evaluate((name) => window.api.normalRange.evaluate({ testName: name, value: 85, gender: 'ALL' }), `${TEST_PREFIX} Glucose`)
      r.log('evaluate-flags-normal', normalRes?.data?.flag === 'NORMAL', JSON.stringify(normalRes))

      const highRes = await page.evaluate((name) => window.api.normalRange.evaluate({ testName: name, value: 150, gender: 'ALL' }), `${TEST_PREFIX} Glucose`)
      r.log('evaluate-flags-high', highRes?.data?.flag === 'HIGH', JSON.stringify(highRes))
    })

    await r.step('delete-normal-range-via-ui', async () => {
      if (!rangeId) return r.log('delete-normal-range-via-ui', false, 'no rangeId')
      const row = page.locator('td', { hasText: `${TEST_PREFIX} Glucose` }).first().locator('xpath=..')
      await row.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Remove', exact: true }).last().click()
      await page.waitForTimeout(1000)
      r.log('normal-range-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const afterDelete = await page.evaluate(async () => window.api.normalRange.list())
      const stillThere = (afterDelete?.data || []).some((rg) => rg.id === rangeId)
      r.log('normal-range-actually-gone', !stillThere)
    })

    // ── dispatch: create/updateStatus via UI ─────────────────────────────────
    let productId, productName
    await r.step('seed-product-with-stock', async () => {
      productName = `${TEST_PREFIX.replace('NormRange', 'Dispatch')} Product ${Date.now()}`
      const res = await page.evaluate(async (name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 50, sellingPrice: 100, taxRate: 0, openingQuantity: 50,
      }), productName)
      productId = res?.data?.id
      r.log('product-created', !!productId, JSON.stringify(res?.error || ''))
    })

    let dispatchId
    await r.step('create-dispatch-via-ui', async () => {
      if (!productId) return r.log('create-dispatch-via-ui', false, 'no productId')
      await h.gotoHash(page, '#/manufacturing/dispatch')
      await page.waitForTimeout(700)
      r.log('dispatch-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Dispatch Record' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByPlaceholder('Search product by name or SKU…').fill(productName.slice(0, 20))
      await page.waitForTimeout(600)
      await modal.locator('button', { hasText: productName }).first().click()
      await page.waitForTimeout(300)
      await modal.locator('input[type="number"]').fill('10')
      await modal.getByRole('button', { name: 'Create Dispatch' }).click()
      await page.waitForTimeout(1200)
      r.log('dispatch-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.dispatch.list({}))
      const found = (listRes?.data?.records || []).find((d) => d.productId === productId)
      dispatchId = found?.id
      r.log('dispatch-persisted-as-ready', found?.status === 'READY', JSON.stringify(found))
    })

    await r.step('mark-dispatched-then-delivered-via-ui', async () => {
      if (!dispatchId) return r.log('mark-dispatched-then-delivered-via-ui', false, 'no dispatchId')
      const row = page.locator('p', { hasText: productName }).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
      await row.getByRole('button', { name: 'Mark Dispatched' }).click()
      await page.waitForTimeout(1000)
      r.log('mark-dispatched-no-crash', !(await h.hasErrorBoundary(page)))

      let listRes = await page.evaluate(async () => window.api.dispatch.list({}))
      let found = (listRes?.data?.records || []).find((d) => d.id === dispatchId)
      r.log('dispatch-status-dispatched', found?.status === 'DISPATCHED', JSON.stringify(found))

      const row2 = page.locator('p', { hasText: productName }).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
      await row2.getByRole('button', { name: 'Mark Delivered' }).click()
      await page.waitForTimeout(1000)
      r.log('mark-delivered-no-crash', !(await h.hasErrorBoundary(page)))

      listRes = await page.evaluate(async () => window.api.dispatch.list({}))
      found = (listRes?.data?.records || []).find((d) => d.id === dispatchId)
      r.log('dispatch-status-delivered', found?.status === 'DELIVERED', JSON.stringify(found))
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const rangesRemoved = db.prepare("DELETE FROM NormalRangeReference WHERE testName LIKE 'E2E NormRange%'").run().changes
      const dispatchIds = db.prepare("SELECT id, productId FROM DispatchRecord WHERE productId IN (SELECT id FROM Product WHERE productName LIKE 'E2E Dispatch%')").all()
      let dispatches = 0, products = 0, inventory = 0
      for (const d of dispatchIds) {
        try { dispatches += db.prepare('DELETE FROM DispatchRecord WHERE id = ?').run(d.id).changes } catch { /* noop */ }
      }
      const prodIds = db.prepare("SELECT id FROM Product WHERE productName LIKE 'E2E Dispatch%'").all().map((r2) => r2.id)
      for (const pid of prodIds) {
        inventory += db.prepare('DELETE FROM Inventory WHERE productId = ?').run(pid).changes
        db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(pid)
        db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(pid)
        try { products += db.prepare('DELETE FROM Product WHERE id = ?').run(pid).changes } catch { db.prepare('UPDATE Product SET isActive = 0 WHERE id = ?').run(pid) }
      }
      console.log('extra cleanup:', JSON.stringify({ rangesRemoved, dispatches, products, inventory }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nNORMAL RANGES & DISPATCH: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
