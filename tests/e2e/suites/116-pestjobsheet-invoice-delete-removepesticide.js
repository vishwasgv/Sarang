/**
 * Suite 116 — pestJobSheet.generateInvoice/delete/removePesticide
 * (broader-gap-list Section C, money-critical, 2026-09-03). create/update/
 * addPesticide are already covered (suite 83) but these three channels had
 * zero coverage.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E PestJS'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-pest-control', async () => {
      const sw = await h.switchBusinessType(page, 'Pest Control Service')
      r.log('business-type-switched', sw.to === 'PEST_CONTROL', JSON.stringify(sw))
    })

    let clientId
    await r.step('create-client', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Client ${suffix}`)
      clientId = custRes?.data?.id
      r.log('client-created', !!clientId, JSON.stringify(custRes?.error || ''))
    })

    async function createSheetViaUi(clientName, amount) {
      await h.gotoHash(page, '#/pest/contracts')
      await page.waitForTimeout(700)
      await page.getByRole('button', { name: 'Job Sheets' }).click()
      await page.waitForTimeout(500)
      await page.getByRole('button', { name: 'New Job Sheet' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByPlaceholder('Search by name or phone...').fill(clientName)
      await page.waitForTimeout(700)
      await modal.locator('button', { hasText: clientName }).first().click()
      await page.waitForTimeout(300)
      const dateInput = modal.locator('input[type="date"]').first()
      await dateInput.fill(h.toLocalISODate(new Date()))
      await modal.getByPlaceholder('0.00').fill(String(amount))
      await page.waitForTimeout(300)
      await modal.getByRole('button', { name: 'Create Job Sheet' }).click()
      await page.waitForTimeout(1200)
      const noCrash = !(await h.hasErrorBoundary(page))

      const listRes = await page.evaluate(async () => window.api.pestJobSheet.list({}))
      const sheet = (listRes?.data || []).find((j) => Number(j.jobAmount) === amount && j.client?.customerName === clientName)
      return { id: sheet?.id, noCrash, sheet }
    }

    const clientName = `${TEST_PREFIX} Client ${suffix}`

    // ── Sheet A: addPesticide+removePesticide, advance to COMPLETED, invoice ──
    let sheetAId
    await r.step('sheet-A-create-via-ui', async () => {
      const res = await createSheetViaUi(clientName, 900)
      sheetAId = res.id
      r.log('sheet-A-created-no-crash', res.noCrash)
      r.log('sheet-A-persisted', !!sheetAId, JSON.stringify(res.sheet))
    })

    let pesticideLineId
    await r.step('sheet-A-add-and-remove-pesticide-line-via-ui', async () => {
      if (!sheetAId) return r.log('sheet-A-add-and-remove-pesticide-line-via-ui', false, 'no sheetAId')
      const row = page.locator('tr', { hasText: clientName }).first()
      await row.locator('button svg.lucide-pencil').first().locator('xpath=..').click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('Pesticide name *').fill(`${TEST_PREFIX} Deltamethrin`)
      await modal.getByPlaceholder('Qty *').fill('30')
      await modal.locator('button', { hasText: 'Add Pesticide Line' }).click()
      await page.waitForTimeout(1000)
      r.log('add-pesticide-line-no-crash', !(await h.hasErrorBoundary(page)))

      const linesRes = await page.evaluate((id) => window.api.pestJobSheet.listPesticides(id), sheetAId)
      const line = (linesRes?.data || []).find((l) => l.pesticideName === `${TEST_PREFIX} Deltamethrin`)
      pesticideLineId = line?.id
      r.log('pesticide-line-added', !!pesticideLineId && Number(line?.quantityUsed) === 30, JSON.stringify(line))

      if (pesticideLineId) {
        const lineRow = modal.locator('div.flex.items-center.justify-between.text-xs', { hasText: `${TEST_PREFIX} Deltamethrin` }).first()
        await lineRow.locator('button:has(svg.lucide-x)').click()
        await page.waitForTimeout(1000)
        r.log('remove-pesticide-line-no-crash', !(await h.hasErrorBoundary(page)))

        const afterRemove = await page.evaluate((id) => window.api.pestJobSheet.listPesticides(id), sheetAId)
        r.log('pesticide-line-actually-removed', !(afterRemove?.data || []).some((l) => l.id === pesticideLineId), JSON.stringify(afterRemove?.data))
      }

      await modal.locator('button', { hasText: 'Cancel' }).click().catch(() => {})
      await page.waitForTimeout(400)
    })

    await r.step('sheet-A-advance-to-completed-and-generate-invoice-via-ui', async () => {
      if (!sheetAId) return r.log('sheet-A-advance-to-completed-and-generate-invoice-via-ui', false, 'no sheetAId')
      const row = () => page.locator('tr', { hasText: clientName }).first()
      await row().locator('button', { hasText: 'IN_PROGRESS' }).click()
      await page.waitForTimeout(700)
      await row().locator('button', { hasText: 'COMPLETED' }).click()
      await page.waitForTimeout(700)
      r.log('advance-to-completed-no-crash', !(await h.hasErrorBoundary(page)))

      const genBtn = row().locator('button', { hasText: 'Invoice' })
      r.log('generate-invoice-button-present', await genBtn.count() > 0)
      await genBtn.click()
      await page.waitForTimeout(1500)
      r.log('generate-invoice-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.pestJobSheet.list({}))
      const sheet = (listRes?.data || []).find((j) => j.id === sheetAId)
      r.log('invoice-generated', !!sheet?.invoiceId, JSON.stringify(sheet))
      if (sheet?.invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), sheet.invoiceId)
        r.log('invoice-total-matches-job-amount-plus-gst', Math.abs((invRes?.data?.totalAmount ?? 0) - 900 * 1.18) < 1, JSON.stringify(invRes?.data?.totalAmount))
      }
    })

    // ── Sheet B: delete ───────────────────────────────────────────────────────
    let sheetBId
    await r.step('sheet-B-create-and-delete-via-ui', async () => {
      const res = await createSheetViaUi(clientName, 400)
      sheetBId = res.id
      r.log('sheet-B-created-no-crash', res.noCrash)
      r.log('sheet-B-persisted', !!sheetBId, JSON.stringify(res.sheet))
      if (!sheetBId) return

      const listRes = await page.evaluate(async () => window.api.pestJobSheet.list({}))
      const sheets = (listRes?.data || []).filter((j) => j.client?.customerName === clientName)
      const sheetBRow = sheets.find((j) => j.id === sheetBId)
      const row = page.locator('tr', { hasText: sheetBRow?.jobNumber ?? '__no-match__' }).first()
      await row.locator('button:has(svg.lucide-x)').click()
      await page.waitForTimeout(400)
      const confirmDialog = h.topModal(page)
      await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('delete-no-crash', !(await h.hasErrorBoundary(page)))

      const afterDelete = await page.evaluate(async () => window.api.pestJobSheet.list({}))
      r.log('sheet-B-actually-gone', !(afterDelete?.data || []).some((j) => j.id === sheetBId))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'PEST_CONTROL') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const clientIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let lines = 0, sheets = 0, custs = 0
      for (const cid of clientIds) {
        const sheetIds = db.prepare('SELECT id FROM PestJobSheet WHERE clientId = ?').all(cid).map((row) => row.id)
        for (const sid of sheetIds) {
          try { lines += db.prepare('DELETE FROM PestJobSheetPesticide WHERE jobSheetId = ?').run(sid).changes } catch { /* noop */ }
          try { sheets += db.prepare('DELETE FROM PestJobSheet WHERE id = ?').run(sid).changes } catch { /* noop */ }
        }
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ sheets, lines, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nPEST JOB SHEET INVOICE/DELETE/REMOVE-PESTICIDE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
