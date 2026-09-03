/**
 * Suite 113 — jobCards.generateInvoice/delete/addPart/removePart
 * (broader-gap-list Section C, money-critical, 2026-09-03). create/update
 * are already covered (suites 11, 77) but these four channels had zero
 * coverage. Unlike every other "generate invoice" screen touched this
 * session, JobCardsScreen.tsx's Customer field is a plain pre-loaded
 * <Select> (not a CustomerPicker search+quick-add) -- seed the customer via
 * API BEFORE navigating here so it's present in the initial customers.list()
 * fetch, then select it by option label.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E JobInv'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-repair-business', async () => {
      const sw = await h.switchBusinessType(page, 'Repair Shop / Service Centre')
      r.log('business-type-switched', sw.to === 'REPAIR', JSON.stringify(sw))
    })

    let customerId, customerName, productId, productName
    await r.step('seed-customer-and-part-product', async () => {
      customerName = `${TEST_PREFIX} Customer ${suffix}`
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), customerName)
      customerId = custRes?.data?.id
      r.log('customer-created', !!customerId, JSON.stringify(custRes?.error || ''))

      productName = `${TEST_PREFIX} Capacitor ${suffix}`
      const prodRes = await page.evaluate(async (name) => window.api.products.create({
        productName: name, productType: 'STANDARD', sellingPrice: 250, unit: 'NOS', openingQuantity: 20,
      }), productName)
      productId = prodRes?.data?.id
      r.log('part-product-created', !!productId, JSON.stringify(prodRes?.error || ''))
    })

    async function createJobCardViaUi(title, withCustomer) {
      await h.gotoHash(page, '#/service/job-cards')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'New Job Card' }).first().click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      const inputs = modal.locator('input')
      await inputs.nth(0).fill(title)
      await inputs.nth(1).fill(`${TEST_PREFIX} Item`)
      await inputs.nth(2).fill('3000') // estCost -- generateInvoice needs a positive billable amount (JC-006)
      if (withCustomer) {
        await modal.getByLabel('Customer').selectOption({ label: customerName })
      }
      await modal.locator('button', { hasText: 'New Job Card' }).click()
      await page.waitForTimeout(1000)
      const noCrash = !(await h.hasErrorBoundary(page))

      const listRes = await page.evaluate(() => window.api.jobCards.list({}))
      const job = (listRes?.data?.jobCards || []).find((j) => j.title === title)
      return { id: job?.id, noCrash, job }
    }

    async function openDetail(title) {
      await page.locator('button', { hasText: title }).first().click()
      await page.waitForTimeout(400)
      return h.topModal(page)
    }

    // ── Job A: addPart / removePart / generateInvoice ───────────────────────
    let jobAId
    await r.step('job-A-create-with-customer-via-ui', async () => {
      const titleA = `${TEST_PREFIX} Job A ${suffix}`
      const res = await createJobCardViaUi(titleA, true)
      jobAId = res.id
      r.log('job-A-created-no-crash', res.noCrash)
      r.log('job-A-persisted-with-customer', !!jobAId && res.job?.customerId === customerId, JSON.stringify(res.job))
    })

    let partId
    await r.step('job-A-add-part-via-ui', async () => {
      if (!jobAId) return r.log('job-A-add-part-via-ui', false, 'no jobAId')
      const titleA = `${TEST_PREFIX} Job A ${suffix}`
      const modal = await openDetail(titleA)
      const partSearch = modal.locator('input[placeholder*="Search"]').first()
      await partSearch.fill(productName)
      await page.waitForTimeout(700)
      await modal.locator('button', { hasText: productName }).first().click()
      await page.waitForTimeout(300)
      await modal.locator('button', { hasText: 'Add Part' }).click()
      await page.waitForTimeout(1000)
      r.log('add-part-no-crash', !(await h.hasErrorBoundary(page)))

      const partsRes = await page.evaluate((jobCardId) => window.api.jobCards.listParts({ jobCardId }), jobAId)
      const parts = partsRes?.data || []
      const added = parts.find((p) => p.productId === productId)
      partId = added?.id
      r.log('part-actually-added', !!partId && added?.quantity === 1 && added?.unitPrice === 250, JSON.stringify(added))
    })

    await r.step('job-A-remove-part-via-ui', async () => {
      if (!partId) return r.log('job-A-remove-part-via-ui', false, 'no partId')
      const modal = h.topModal(page)
      await modal.locator('button[title="Remove part"]').first().click()
      await page.waitForTimeout(1000)
      r.log('remove-part-no-crash', !(await h.hasErrorBoundary(page)))

      const partsRes = await page.evaluate((jobCardId) => window.api.jobCards.listParts({ jobCardId }), jobAId)
      const stillThere = (partsRes?.data || []).some((p) => p.id === partId)
      r.log('part-actually-removed', !stillThere, JSON.stringify(partsRes?.data))
    })

    let invoiceId
    await r.step('job-A-generate-invoice-via-ui', async () => {
      if (!jobAId) return r.log('job-A-generate-invoice-via-ui', false, 'no jobAId')
      const modal = h.topModal(page)
      const genBtn = modal.locator('button', { hasText: 'Generate Invoice' })
      r.log('generate-invoice-button-present', await genBtn.count() > 0)
      await genBtn.click()
      await page.waitForTimeout(1500)
      r.log('generate-invoice-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.jobCards.list({}))
      const job = (listRes?.data?.jobCards || []).find((j) => j.id === jobAId)
      invoiceId = job?.invoiceId
      r.log('invoice-generated', !!invoiceId, JSON.stringify(job))
      if (invoiceId) {
        // billed via a placeholder "Repair & Maintenance Services" product at
        // 18% GST -- total is estCost * 1.18, not the bare estCost.
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), invoiceId)
        r.log('invoice-total-matches-estimated-cost-plus-gst', Math.abs((invRes?.data?.totalAmount ?? 0) - 3540) < 1, JSON.stringify(invRes?.data?.totalAmount))
      }

      // The detail modal doesn't auto-close after Generate Invoice -- close it
      // explicitly so it doesn't obscure the header's "New Job Card" button
      // for job B's create step below (same class of bug as the Hotel suite).
      await modal.locator('button', { hasText: '×' }).first().click().catch(() => {})
      await page.waitForTimeout(400)
    })

    // ── Job B: delete (default RECEIVED status, no customer needed) ─────────
    let jobBId
    await r.step('job-B-create-and-delete-via-ui', async () => {
      const titleB = `${TEST_PREFIX} Job B ${suffix}`
      const res = await createJobCardViaUi(titleB, false)
      jobBId = res.id
      r.log('job-B-created-no-crash', res.noCrash)
      r.log('job-B-persisted', !!jobBId, JSON.stringify(res.job))
      if (!jobBId) return

      const modal = await openDetail(titleB)
      await modal.locator('button', { hasText: 'Delete Job Card' }).click()
      await page.waitForTimeout(400)
      // ConfirmDialog is a second, top-most overlay -- re-fetch topModal.
      const confirmDialog = h.topModal(page)
      await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('delete-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.jobCards.list({}))
      const stillThere = (listRes?.data?.jobCards || []).some((j) => j.id === jobBId)
      r.log('job-B-actually-gone', !stillThere)
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'REPAIR') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const jobIds = db.prepare(`SELECT id, invoiceId FROM JobCard WHERE title LIKE '${TEST_PREFIX}%'`).all()
      let parts = 0, invoices = 0, invoiceItems = 0, jobs = 0
      for (const j of jobIds) {
        parts += db.prepare('DELETE FROM JobCardPart WHERE jobCardId = ?').run(j.id).changes
        if (j.invoiceId && j.invoiceId !== 'PENDING_INVOICE_GENERATION') {
          invoiceItems += db.prepare('DELETE FROM InvoiceItem WHERE invoiceId = ?').run(j.invoiceId).changes
          try { invoices += db.prepare('DELETE FROM Invoice WHERE id = ?').run(j.invoiceId).changes } catch { /* noop */ }
        }
        try { jobs += db.prepare('DELETE FROM JobCard WHERE id = ?').run(j.id).changes } catch { /* noop */ }
      }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let custs = 0
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let prods = 0
      for (const pid of prodIds) {
        db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(pid)
        db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(pid)
        try { prods += db.prepare('DELETE FROM Product WHERE id = ?').run(pid).changes } catch { /* noop */ }
      }
      console.log('extra cleanup:', JSON.stringify({ jobs, parts, invoices, invoiceItems, custs, prods }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nJOB CARDS INVOICE/PARTS/DELETE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
