/**
 * Suite 163 — two follow-ups after the waiter view (suite 162) shipped:
 * (1) a daily-reset "Token #N" for counter/takeaway (no-table) KOTs,
 * replacing the invoice-number/KOT-XXXXXX fallback; (2) a real flaw found
 * on self-review and fixed -- the LAN waiter routes for board/tables/served
 * never re-checked the employee was still active (only order-placing did),
 * so a terminated waiter's printed QR would keep showing live orders and
 * letting them mark tickets served indefinitely.
 */
const h = require('../harness')
const { createTestProduct } = require('../fixtures/seed')

const TEST_PREFIX = 'E2E163'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    let originalModules = []
    await r.step('switch-to-restaurant-and-enable-kitchen-display-web', async () => {
      const sw = await h.switchBusinessType(page, 'Restaurant')
      r.log('business-type-switched', sw.to === 'RESTAURANT', JSON.stringify(sw))
      const tmpl = await page.evaluate(async () => window.api.industry.getTemplate())
      originalModules = tmpl?.data?.enabledModules || []
      if (!originalModules.includes('kitchen_display_web')) {
        await page.evaluate(async (mods) => window.api.industry.updateModules({ modules: mods }), [...originalModules, 'kitchen_display_web'])
      }
    })

    let prodId
    await r.step('seed-product', async () => {
      const prodRes = await createTestProduct(page, { productName: `${TEST_PREFIX} Samosa ${suffix}`, sellingPrice: 30, costPrice: 12, taxRate: 5 })
      prodId = prodRes?.data?.id
      r.log('product-seeded', !!prodId, JSON.stringify(prodRes?.error || ''))
    })

    let kot1Id, kot2Id
    await r.step('takeaway-orders-get-sequential-daily-token-numbers', async () => {
      const k1 = await page.evaluate(async (pid) => window.api.billing.createInvoice({
        paymentMethod: 'CASH', items: [{ productId: pid, quantity: 1, unitPrice: 30, taxRate: 5 }],
      }).then((inv) => window.api.restaurant.createKOT({ invoiceId: inv.data.id })), prodId)
      kot1Id = k1?.data?.id
      r.log('kot1-created-no-table', !!kot1Id && k1?.data?.tableId == null, JSON.stringify(k1?.data))

      const k2 = await page.evaluate(async (pid) => window.api.billing.createInvoice({
        paymentMethod: 'CASH', items: [{ productId: pid, quantity: 1, unitPrice: 30, taxRate: 5 }],
      }).then((inv) => window.api.restaurant.createKOT({ invoiceId: inv.data.id })), prodId)
      kot2Id = k2?.data?.id

      r.log('token-numbers-assigned-and-sequential', typeof k1?.data?.tokenNumber === 'number' && k2?.data?.tokenNumber === k1?.data?.tokenNumber + 1,
        JSON.stringify({ t1: k1?.data?.tokenNumber, t2: k2?.data?.tokenNumber }))
    })

    await r.step('kot-screen-shows-token-number-via-real-ui', async () => {
      await h.gotoHash(page, '#/restaurant/kot')
      await page.waitForTimeout(900)
      r.log('kot-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.restaurant.listKOTs({}))
      const kot1 = (listRes?.data || []).find((k) => k.id === kot1Id)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('kot-screen-body-shows-token-text', bodyText.includes(`Token #${kot1?.tokenNumber}`))
    })

    // The printed-ticket "Token #N" block (print.service.ts's
    // generateKOTHtml) is deliberately NOT exercised live here -- print:kot
    // was already covered via real UI in suite 157, and re-invoking a real
    // OS-level print call from an unattended run risks hanging this whole
    // suite on a machine with no printer driver installed (webContents.
    // print's silent:true suppresses Electron's own dialog, but not
    // necessarily a Windows print-spooler-level stall) -- not worth the
    // blast radius for a single added HTML string, already verified by
    // direct code review.

    let waiterId, tableId
    await r.step('deactivated-employee-loses-live-waiter-access', async () => {
      const empRes = await page.evaluate(async ({ name, joinDate }) => window.api.hr.createEmployee({
        fullName: name, phone: `9${String(Date.now()).slice(-9)}`, joinDate,
      }), { name: `${TEST_PREFIX} Waiter ${suffix}`, joinDate: h.toLocalISODate(new Date()) })
      waiterId = empRes?.data?.id
      r.log('waiter-created', !!waiterId, JSON.stringify(empRes?.error || ''))

      const tableRes = await page.evaluate(async (num) => window.api.restaurant.createTable({ tableNumber: num }), `${TEST_PREFIX}-T1-${suffix}`)
      tableId = tableRes?.data?.id
      await page.evaluate(({ tableId, waiterId }) => window.api.restaurant.assignWaiter({ tableId, waiterId }), { tableId, waiterId })

      const statusRes = await page.evaluate(async () => window.api.restaurant.getKitchenDisplayStatus())
      r.log('kitchen-display-running', statusRes?.data?.running === true, JSON.stringify(statusRes?.data))
      if (!statusRes?.data?.running) return
      const port = statusRes.data.port
      const token = statusRes.data.token

      const boardWhileActive = await fetch(`http://127.0.0.1:${port}/api/waiter/${token}/${waiterId}/board`).then((x) => x.json())
      r.log('board-accessible-while-active', boardWhileActive?.success === true, JSON.stringify(boardWhileActive))

      const deactivateRes = await page.evaluate((id) => window.api.hr.updateEmployee({ id, isActive: false }), waiterId)
      r.log('employee-deactivated', !!deactivateRes?.success, JSON.stringify(deactivateRes?.error || ''))

      const boardAfter = await fetch(`http://127.0.0.1:${port}/api/waiter/${token}/${waiterId}/board`).then((x) => x.json())
      r.log('board-rejected-after-deactivation', boardAfter?.success === false, JSON.stringify(boardAfter))

      const tablesAfter = await fetch(`http://127.0.0.1:${port}/api/waiter/${token}/${waiterId}/tables`).then((x) => x.json())
      r.log('tables-rejected-after-deactivation', tablesAfter?.success === false, JSON.stringify(tablesAfter))

      const servedAfter = await fetch(`http://127.0.0.1:${port}/api/waiter/${token}/${waiterId}/served`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kotId: kot1Id }),
      }).then((x) => x.json())
      r.log('served-rejected-after-deactivation', servedAfter?.success === false, JSON.stringify(servedAfter))
    })

    await r.step('restore-modules-and-business-type', async () => {
      if (!originalModules.includes('kitchen_display_web')) {
        await page.evaluate(async (mods) => window.api.industry.updateModules({ modules: mods }), originalModules)
      }
      if (originalBusinessType && originalBusinessType !== 'RESTAURANT') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let kots = 0, invs = 0, prods = 0, tables = 0, emps = 0
      const kotIds = db.prepare(`SELECT id FROM KOT WHERE invoiceId IN (SELECT id FROM Invoice WHERE id IN (SELECT invoiceId FROM InvoiceItem WHERE productId IN (SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'))) OR tableId IN (SELECT id FROM RestaurantTable WHERE tableNumber LIKE '${TEST_PREFIX}%')`).all().map((row) => row.id)
      for (const id of kotIds) { try { kots += db.prepare('DELETE FROM KOT WHERE id = ?').run(id).changes } catch { /* noop */ } }
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of prodIds) {
        const invIds = db.prepare('SELECT DISTINCT invoiceId FROM InvoiceItem WHERE productId = ?').all(id).map((row) => row.invoiceId)
        try { db.prepare('DELETE FROM InvoiceItem WHERE productId = ?').run(id) } catch { /* noop */ }
        for (const invId of invIds) {
          try { db.prepare('DELETE FROM Payment WHERE invoiceId = ?').run(invId) } catch { /* noop */ }
          try { invs += db.prepare('DELETE FROM Invoice WHERE id = ?').run(invId).changes } catch { /* noop */ }
        }
        try { db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM Inventory WHERE productId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM ProductCostHistory WHERE productId = ?').run(id) } catch { /* noop */ }
        try { prods += db.prepare('DELETE FROM Product WHERE id = ?').run(id).changes } catch { db.prepare('UPDATE Product SET isActive = 0 WHERE id = ?').run(id) }
      }
      try { tables = db.prepare(`DELETE FROM RestaurantTable WHERE tableNumber LIKE '${TEST_PREFIX}%'`).run().changes } catch { /* noop */ }
      const empIds = db.prepare(`SELECT id FROM Employee WHERE fullName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of empIds) { try { emps += db.prepare('DELETE FROM Employee WHERE id = ?').run(id).changes } catch { /* noop */ } }
      console.log('extra cleanup:', JSON.stringify({ kots, invs, prods, tables, emps }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nTAKEAWAY TOKEN / WAITER-FLAW FIX: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
