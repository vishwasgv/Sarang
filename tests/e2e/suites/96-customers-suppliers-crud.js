/**
 * Suite 96 — Coverage-gap closure (2026-09-03 full-codebase audit,
 * continuation of suite 95/11): customers.update, customers.archive,
 * suppliers.update, suppliers.archive had ZERO E2E coverage of any kind
 * before this suite — the customers.create/suppliers.create IPC channels
 * are exercised constantly as setup in dozens of other suites, but the
 * Edit and Archive buttons on the Customers/Suppliers list screens
 * themselves had never been clicked by any suite. This suite drives both
 * through their real UI (CustomerFormModal/SupplierFormModal edit + the
 * ConfirmDialog-based archive flow) and asserts the DB state after each.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Cov96'
const suffix = Date.now()

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  const custName = `${TEST_PREFIX} Customer ${suffix}`
  const custPhone = `9${String(suffix).slice(-9)}`
  let custId = null

  const supName = `${TEST_PREFIX} Supplier ${suffix}`
  let supId = null

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    // ═══════════════════════ Customers: update + archive ═══════════════════
    await r.step('create-customer-for-edit-archive', async () => {
      const res = await page.evaluate(async ({ customerName, phone }) => window.api.customers.create({ customerName, phone }), { customerName: custName, phone: custPhone })
      custId = res?.data?.id
      r.log('customer-created', !!custId, JSON.stringify(res?.error || ''))
    })

    await r.step('customer-edited-via-real-ui', async () => {
      if (!custId) return r.log('skipped-no-customer-id', false)
      await h.gotoHash(page, '#/customers')
      await page.waitForTimeout(700)
      const row = page.locator('tr', { hasText: custName }).first()
      r.log('customer-row-visible-in-list', await row.count() > 0)
      await row.locator('button[title="Edit"]').click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      const cityInput = modal.getByPlaceholder('Mumbai')
      await cityInput.fill('E2E Cov96 City')
      await modal.getByRole('button', { name: 'Save Changes' }).click()
      await page.waitForTimeout(800)
      r.log('customer-edit-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('customer-edit-persisted', () => h.withDb((db) => {
      if (!custId) return r.log('skipped-no-customer-id', false)
      const row = db.prepare('SELECT * FROM Customer WHERE id = ?').get(custId)
      r.log('customer-city-updated', row?.city === 'E2E Cov96 City', JSON.stringify(row?.city))
    }))

    await r.step('customer-archived-via-real-ui', async () => {
      if (!custId) return r.log('skipped-no-customer-id', false)
      const row = page.locator('tr', { hasText: custName }).first()
      await row.locator('button[title="Archive"]').click()
      await page.waitForTimeout(400)
      const confirmModal = h.topModal(page)
      await confirmModal.getByRole('button', { name: 'Archive Customer', exact: true }).click()
      await page.waitForTimeout(800)
      r.log('customer-archive-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('customer-archive-persisted', () => h.withDb((db) => {
      if (!custId) return r.log('skipped-no-customer-id', false)
      const row = db.prepare('SELECT * FROM Customer WHERE id = ?').get(custId)
      r.log('customer-marked-inactive', row?.isActive === 0, JSON.stringify(row?.isActive))
    }))

    await r.step('archived-customer-gone-from-active-list', async () => {
      if (!custId) return r.log('skipped-no-customer-id', false)
      await h.gotoHash(page, '#/customers')
      await page.waitForTimeout(700)
      // Body-text includes() is too broad here — the just-fired toast
      // notification ("Archive Customer — <name>") stays in the DOM for a
      // few seconds and contains the same name, causing a false match.
      // Check for an absent table row instead.
      const rowCount = await page.locator('tr', { hasText: custName }).count()
      r.log('archived-customer-not-in-default-list', rowCount === 0, `rowCount=${rowCount}`)
    })

    // ═══════════════════════ Suppliers: update + archive ═══════════════════
    await r.step('create-supplier-for-edit-archive', async () => {
      const res = await page.evaluate(async (name) => window.api.suppliers.create({ supplierName: name }), supName)
      supId = res?.data?.id
      r.log('supplier-created', !!supId, JSON.stringify(res?.error || ''))
    })

    await r.step('supplier-edited-via-real-ui', async () => {
      if (!supId) return r.log('skipped-no-supplier-id', false)
      await h.gotoHash(page, '#/suppliers')
      await page.waitForTimeout(700)
      const row = page.locator('tr', { hasText: supName }).first()
      r.log('supplier-row-visible-in-list', await row.count() > 0)
      await row.locator('button[title="Edit"]').click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      const cityInput = modal.getByPlaceholder('Pune')
      await cityInput.fill('E2E Cov96 Supplier City')
      await modal.getByRole('button', { name: 'Save Changes' }).click()
      await page.waitForTimeout(800)
      r.log('supplier-edit-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('supplier-edit-persisted', () => h.withDb((db) => {
      if (!supId) return r.log('skipped-no-supplier-id', false)
      const row = db.prepare('SELECT * FROM Supplier WHERE id = ?').get(supId)
      r.log('supplier-city-updated', row?.city === 'E2E Cov96 Supplier City', JSON.stringify(row?.city))
    }))

    await r.step('supplier-archived-via-real-ui', async () => {
      if (!supId) return r.log('skipped-no-supplier-id', false)
      const row = page.locator('tr', { hasText: supName }).first()
      await row.locator('button[title="Archive"]').click()
      await page.waitForTimeout(400)
      const confirmModal = h.topModal(page)
      await confirmModal.getByRole('button', { name: 'Archive Supplier', exact: true }).click()
      await page.waitForTimeout(800)
      r.log('supplier-archive-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('supplier-archive-persisted', () => h.withDb((db) => {
      if (!supId) return r.log('skipped-no-supplier-id', false)
      const row = db.prepare('SELECT * FROM Supplier WHERE id = ?').get(supId)
      r.log('supplier-marked-inactive', row?.isActive === 0, JSON.stringify(row?.isActive))
    }))

    await r.step('archived-supplier-gone-from-active-list', async () => {
      if (!supId) return r.log('skipped-no-supplier-id', false)
      await h.gotoHash(page, '#/suppliers')
      await page.waitForTimeout(700)
      // Same toast-notification false-positive risk as the customer check above.
      const rowCount = await page.locator('tr', { hasText: supName }).count()
      r.log('archived-supplier-not-in-default-list', rowCount === 0, `rowCount=${rowCount}`)
    })
  } catch (e) {
    r.log('FATAL', false, String((e && e.message) || e))
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()

    const cleanup = h.withDb((db) => {
      let customers = 0, suppliers = 0
      if (custId) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(custId)
        try { customers += db.prepare('DELETE FROM Customer WHERE id = ?').run(custId).changes } catch { /* left as-is if still referenced */ }
      }
      if (supId) {
        db.prepare('DELETE FROM SupplierLedger WHERE supplierId = ?').run(supId)
        try { suppliers += db.prepare('DELETE FROM Supplier WHERE id = ?').run(supId).changes } catch { /* left as-is if still referenced */ }
      }
      return { customers, suppliers }
    })
    console.log('customers-suppliers-crud cleanup:', JSON.stringify(cleanup))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCUSTOMERS/SUPPLIERS CRUD: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
