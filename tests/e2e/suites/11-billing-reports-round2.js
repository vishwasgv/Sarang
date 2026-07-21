/**
 * Suite 11 — Live UAT for the second fresh-audit round (2026-07-12): a
 * printable Profit & Loss statement, thermal print support for Quotation/
 * Credit Note/Debit Note, and vertical-specific reports for the previously-
 * zero-coverage SERVICE/CONSULTANT/REPAIR business types.
 *
 * The three documents' real print IPC channels (quotations:printReceipt
 * etc.) call webContents.print({silent:false}), which opens a native OS
 * print dialog — exactly like the pre-existing quotations:print/
 * creditNotes:print/debitNotes:print channels, which this project's own
 * E2E suite has never called directly for the same reason (only Invoice's
 * PREVIEW-only channels, print:previewInvoice/previewReceipt, are ever
 * exercised live — see 08-branding-legal.js). The actual HTML generation
 * for both formats is covered by 34 unit tests in print.service.test.ts
 * instead; this suite verifies the UI wiring (both print buttons exist)
 * without clicking through to a real print job.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E R2'

async function generateReport(page, r, tileLabel, { needsDateRange }) {
  await h.gotoHash(page, '#/reports')
  await page.waitForTimeout(700)
  const tile = page.locator('button, [role="button"]', { hasText: tileLabel }).first()
  const present = await tile.count() > 0
  r.log(`${tileLabel}-tile-present`, present)
  if (!present) return false
  await tile.click()
  await page.waitForTimeout(500)
  if (needsDateRange) {
    const dateInputs = page.locator('input[type="date"]')
    const from = h.toLocalISODate(new Date(Date.now() - 365 * 24 * 3600000))
    const to = h.toLocalISODate(new Date())
    await dateInputs.nth(0).fill(from)
    await dateInputs.nth(1).fill(to)
  }
  await page.locator('button:has-text("Generate Report")').click()
  await page.waitForTimeout(1200)
  const noCrash = !(await h.hasErrorBoundary(page))
  r.log(`${tileLabel}-renders-no-crash`, noCrash)
  await h.shot(page, `report-${tileLabel.replace(/\s+/g, '-').toLowerCase()}`)
  return noCrash
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)
    const originalBusinessType = h.getBusinessType()

    // ── Profit & Loss Statement ─────────────────────────────────────────────
    await r.step('profit-and-loss-report', async () => {
      // Seed at least one invoice + expense so the statement has real numbers,
      // not just an empty-state render.
      const custRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} PL Customer`, phone: `9${String(Date.now()).slice(-9)}`,
      }), TEST_PREFIX)
      const prodRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} PL Widget`, productType: 'STANDARD', costPrice: 50, sellingPrice: 100, taxRate: 0, unit: 'NOS', openingQuantity: 50,
      }), TEST_PREFIX)
      if (custRes?.data?.id && prodRes?.data?.id) {
        await page.evaluate(async ({ customerId, prodId }) => window.api.billing.createInvoice({
          customerId, paymentMethod: 'CASH', items: [{ productId: prodId, quantity: 2, unitPrice: 100 }],
        }), { customerId: custRes.data.id, prodId: prodRes.data.id })
      }

      const ok = await generateReport(page, r, 'Profit & Loss Statement', { needsDateRange: true })
      if (ok) {
        const revenueText = page.locator('text=/Revenue/i')
        r.log('pl-report-shows-revenue-line', await revenueText.count() > 0)
        const netProfitText = page.locator('text=/Net Profit/i')
        r.log('pl-report-shows-net-profit-line', await netProfitText.count() > 0)
      }
    })

    // ── Thermal print wiring for Quotation / Credit Note / Debit Note ──────
    await r.step('quotation-thermal-print-button-present', async () => {
      const custRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} Quote Customer`, phone: `8${String(Date.now()).slice(-9)}`,
      }), TEST_PREFIX)
      const prodRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} Quote Widget`, productType: 'STANDARD', sellingPrice: 500, taxRate: 18, unit: 'NOS',
      }), TEST_PREFIX)
      const createRes = await page.evaluate(async ({ customerId, prodId }) => window.api.quotations.create({
        customerId, items: [{ productId: prodId, productName: 'Quote Widget', quantity: 1, unitPrice: 500, taxRate: 18 }],
      }), { customerId: custRes?.data?.id, prodId: prodRes?.data?.id })
      r.log('quotation-created-for-print-check', !!createRes?.success, JSON.stringify(createRes?.error || ''))

      await h.gotoHash(page, '#/billing/quotations')
      await page.waitForTimeout(700)
      const printBtn = page.locator('button[title="Print (A4)"]').first()
      const receiptBtn = page.locator('button[title="Print Receipt (Thermal)"]').first()
      r.log('quotation-a4-print-button-present', await printBtn.count() > 0)
      r.log('quotation-thermal-print-button-present', await receiptBtn.count() > 0)
    })

    await r.step('credit-note-thermal-print-button-present', async () => {
      await h.gotoHash(page, '#/billing/credit-notes')
      await page.waitForTimeout(700)
      r.log('credit-notes-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
      // Existence of the icon-button pair is checked generically (no credit
      // notes may exist yet in a fresh dev DB) — this confirms the screen's
      // own render path for the buttons compiles and mounts correctly by
      // creating one via API first.
      const custRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} CN Customer`, phone: `7${String(Date.now()).slice(-9)}`,
      }), TEST_PREFIX)
      const cnRes = await page.evaluate(async (customerId) => window.api.creditNotes.create({
        customerId, reason: 'E2E test credit', amount: 100,
      }), custRes?.data?.id)
      r.log('credit-note-created-for-print-check', !!cnRes?.success, JSON.stringify(cnRes?.error || ''))
      await page.reload()
      await page.waitForTimeout(1200)
      await h.gotoHash(page, '#/billing/credit-notes')
      await page.waitForTimeout(700)
      const printBtn = page.locator('button[title="Print (A4)"]').first()
      const receiptBtn = page.locator('button[title="Print Receipt (Thermal)"]').first()
      r.log('credit-note-a4-print-button-present', await printBtn.count() > 0)
      r.log('credit-note-thermal-print-button-present', await receiptBtn.count() > 0)
    })

    await r.step('debit-note-thermal-print-button-present', async () => {
      const supRes = await page.evaluate(async (prefix) => window.api.suppliers.create({
        supplierName: `${prefix} DN Supplier`, phone: `6${String(Date.now()).slice(-9)}`,
      }), TEST_PREFIX)
      const dnRes = await page.evaluate(async (supplierId) => window.api.debitNotes.create({
        supplierId, reason: 'E2E test debit', amount: 150,
      }), supRes?.data?.id)
      r.log('debit-note-created-for-print-check', !!dnRes?.success, JSON.stringify(dnRes?.error || ''))
      await page.reload()
      await page.waitForTimeout(1200)
      await h.gotoHash(page, '#/billing/debit-notes')
      await page.waitForTimeout(700)
      const printBtn = page.locator('button[title="Print (A4)"]').first()
      const receiptBtn = page.locator('button[title="Print Receipt (Thermal)"]').first()
      r.log('debit-note-a4-print-button-present', await printBtn.count() > 0)
      r.log('debit-note-thermal-print-button-present', await receiptBtn.count() > 0)
    })

    // ── Service Project Report (SERVICE/CONSULTANT zero-coverage fix) ───────
    // Real bug found 2026-07-21 (unrelated to that day's own changes): the
    // 'projects' report queries the legacy Project model while
    // window.api.serviceProject.create() writes to the separate ServiceProject
    // model queried by the 'serviceProjects' report — and both tiles were
    // labeled identically "Project Report" (fixed in en.json). "Service
    // Business / Agency / IT" only has the legacy 'projects' module enabled,
    // never 'service_projects', so this test needs a business type that
    // actually has 'service_projects' (e.g. Independent Consultant). "Consultant"
    // alone is ambiguous with the legacy "Consultant / Freelancer" tile (same
    // gotcha documented in project_electron_live_verification.md) — matching on
    // "retainer billing" (unique to Independent Consultant's description) instead.
    await r.step('project-report', async () => {
      const res = await h.switchBusinessType(page, 'retainer billing')
      r.log('business-type-switched-to-independent-consultant', res.changed, JSON.stringify(res))

      const custRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} Project Client`, phone: `5${String(Date.now()).slice(-9)}`,
      }), TEST_PREFIX)
      const projRes = await page.evaluate(async ({ clientId, prefix }) => window.api.serviceProject.create({
        clientId, projectName: `${prefix} Website Build`, projectType: 'GENERAL', status: 'ACTIVE', totalContractValue: 25000,
      }), { clientId: custRes?.data?.id, prefix: TEST_PREFIX })
      r.log('service-project-created', !!projRes?.success, JSON.stringify(projRes?.error || ''))

      const ok = await generateReport(page, r, 'Service Project Report', { needsDateRange: true })
      if (ok) {
        const projText = page.locator(`text=/${TEST_PREFIX} Website Build/`)
        r.log('project-report-shows-created-project', await projText.count() > 0)
      }
    })

    // ── Job Card Report (REPAIR zero-coverage fix) ───────────────────────────
    await r.step('job-card-report', async () => {
      const res = await h.switchBusinessType(page, 'Repair Shop / Service Centre')
      r.log('business-type-switched-to-repair', res.changed, JSON.stringify(res))

      const jobRes = await page.evaluate(async (prefix) => window.api.jobCards.create({
        title: `${prefix} Laptop Repair`, estimatedCost: 2000,
      }), TEST_PREFIX)
      r.log('job-card-created', !!jobRes?.success, JSON.stringify(jobRes?.error || ''))

      const ok = await generateReport(page, r, 'Job Card Report', { needsDateRange: true })
      if (ok) {
        const jobText = page.locator(`text=/${TEST_PREFIX} Laptop Repair/`)
        r.log('job-card-report-shows-created-job', await jobText.count() > 0)
      }
    })

    await r.step('restore-business-type-final', async () => {
      if (originalBusinessType) {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored-final', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      const projIds = db.prepare("SELECT id FROM ServiceProject WHERE projectName LIKE 'E2E R2%'").all().map((row) => row.id)
      for (const id of projIds) { try { db.prepare('DELETE FROM ServiceProject WHERE id = ?').run(id) } catch { /* ignore */ } }
      const jobIds = db.prepare("SELECT id FROM JobCard WHERE title LIKE 'E2E R2%'").all().map((row) => row.id)
      for (const id of jobIds) { try { db.prepare('DELETE FROM JobCard WHERE id = ?').run(id) } catch { /* ignore */ } }
      const qtIds = db.prepare("SELECT id FROM Quotation WHERE customerId IN (SELECT id FROM Customer WHERE customerName LIKE 'E2E R2%')").all().map((row) => row.id)
      for (const id of qtIds) { try { db.prepare('DELETE FROM Quotation WHERE id = ?').run(id) } catch { /* ignore */ } }
      const cnIds = db.prepare("SELECT id FROM CreditNote WHERE customerId IN (SELECT id FROM Customer WHERE customerName LIKE 'E2E R2%')").all().map((row) => row.id)
      for (const id of cnIds) { try { db.prepare('DELETE FROM CreditNote WHERE id = ?').run(id) } catch { /* ignore */ } }
      const dnIds = db.prepare("SELECT id FROM DebitNote WHERE supplierId IN (SELECT id FROM Supplier WHERE supplierName LIKE 'E2E R2%')").all().map((row) => row.id)
      for (const id of dnIds) { try { db.prepare('DELETE FROM DebitNote WHERE id = ?').run(id) } catch { /* ignore */ } }
      const supplierIds = db.prepare("SELECT id FROM Supplier WHERE supplierName LIKE 'E2E R2%'").all().map((row) => row.id)
      for (const id of supplierIds) {
        try { db.prepare('DELETE FROM SupplierLedger WHERE supplierId = ?').run(id) } catch { /* ignore */ }
        // Matches this harness's own established convention (cleanupByNamePrefix):
        // hard-delete when possible, soft-deactivate on a remaining FK conflict
        // rather than let cleanup crash the suite.
        try { db.prepare('DELETE FROM Supplier WHERE id = ?').run(id) } catch { db.prepare('UPDATE Supplier SET isActive = 0 WHERE id = ?').run(id) }
      }
      console.log('extra cleanup: projects', projIds.length, 'jobCards', jobIds.length, 'quotations', qtIds.length, 'creditNotes', cnIds.length, 'debitNotes', dnIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nBILLING/REPORTS ROUND 2: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
