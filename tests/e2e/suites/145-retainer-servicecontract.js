/**
 * Suite 145 — Section C medium CRUD gap: retainer.update/delete (create/
 * list/generateInvoice/getHoursUsage already covered via real UI + API,
 * suites 22/23/76) + serviceContracts.create/update (create had a real UI
 * trigger but zero prior coverage; list/generateInvoice already covered,
 * suite 75). serviceContracts.update has NO UI trigger anywhere in the
 * renderer (confirmed via grep) -- a real product gap (no way to edit a
 * contract's value/status/end date from the app) -- covered API-only.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E RS145'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-independent-consultant', async () => {
      const res = await page.evaluate(async () => window.api.industry.changeBusinessType({ businessType: 'INDEPENDENT_CONSULTANT' }))
      r.log('business-type-switch-api-succeeded', !!res?.success, JSON.stringify(res?.error || ''))
      await page.reload()
      await page.waitForTimeout(1500)
      await h.login(page)
    })

    let clientId
    const clientName = `${TEST_PREFIX} Client ${suffix}`
    await r.step('create-client', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), clientName)
      clientId = custRes?.data?.id
      r.log('client-created', !!clientId, JSON.stringify(custRes?.error || ''))
    })

    let retainerId
    const retainerTitle = `${TEST_PREFIX} Retainer ${suffix}`
    await r.step('create-retainer-via-api', async () => {
      const res = await page.evaluate(({ cid, title, today }) => window.api.retainer.create({
        clientId: cid, title, retainerType: 'FIXED_FEE', monthlyAmount: 15000, billingDay: 1, startDate: today,
      }), { cid: clientId, title: retainerTitle, today: h.toLocalISODate(new Date()) })
      retainerId = res?.data?.id
      r.log('retainer-created', !!retainerId, JSON.stringify(res?.error || ''))
    })

    await r.step('update-retainer-via-ui', async () => {
      if (!retainerId) return r.log('update-retainer-via-ui', false, 'no retainerId')
      await h.gotoHash(page, '#/service/retainers')
      await page.waitForTimeout(700)
      r.log('retainers-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      // lucide-react's Edit2 icon maps to CSS class "lucide-pen", not
      // "lucide-edit-2" -- a recurring mismatch this session (verified
      // directly against createLucideIcon's toKebabCase output).
      const row = page.locator('tr', { hasText: retainerTitle }).first()
      await row.locator('button:has(svg.lucide-pen)').click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      const monthlyAmountInput = modal.locator('input[type="number"]').first()
      await monthlyAmountInput.fill('18000')
      await page.waitForTimeout(200)
      await modal.getByRole('button', { name: 'Update Retainer' }).click()
      await page.waitForTimeout(900)
      r.log('retainer-update-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.retainer.list({}))
      const found = (listRes?.data || []).find((rt) => rt.id === retainerId)
      r.log('retainer-actually-updated', found?.monthlyAmount === 18000, JSON.stringify(found))
    })

    await r.step('delete-retainer-via-ui', async () => {
      if (!retainerId) return r.log('delete-retainer-via-ui', false, 'no retainerId')
      const row = page.locator('tr', { hasText: retainerTitle }).first()
      await row.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('retainer-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.retainer.list({}))
      r.log('retainer-actually-deleted', !(listRes?.data || []).some((rt) => rt.id === retainerId), JSON.stringify(listRes?.data?.length))
    })

    let contractId
    await r.step('create-service-contract-via-ui', async () => {
      await h.gotoHash(page, '#/service/contracts')
      await page.waitForTimeout(700)
      r.log('contracts-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Contract' }).click()
      await page.waitForTimeout(400)
      await page.getByPlaceholder('Search by name or phone...').fill(clientName)
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: clientName }).first().click()
      await page.waitForTimeout(300)

      await page.getByLabel('Scope of Work').fill(`${TEST_PREFIX} Annual AMC`)
      await page.getByLabel('Service Frequency').selectOption('QUARTERLY')
      await page.getByLabel('Contract Value').fill('40000')
      await page.waitForTimeout(200)

      await page.getByRole('button', { name: 'Create Contract' }).click()
      await page.waitForTimeout(1200)
      r.log('contract-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.serviceContracts.list())
      const found = (listRes?.data || []).find((c) => c.customerId === clientId)
      contractId = found?.id
      r.log('contract-persisted', !!contractId && found?.serviceFrequency === 'QUARTERLY' && found?.contractValue === 40000, JSON.stringify(found))
    })

    await r.step('update-service-contract-api-only-no-ui-trigger', async () => {
      if (!contractId) return r.log('update-service-contract-api-only-no-ui-trigger', false, 'no contractId')
      const updRes = await page.evaluate((id) => window.api.serviceContracts.update({
        id, contractValue: 45000, status: 'CANCELLED',
      }), contractId)
      r.log('contract-update-api-succeeds', !!updRes?.success, JSON.stringify(updRes?.error || ''))

      const listRes = await page.evaluate(async () => window.api.serviceContracts.list())
      const found = (listRes?.data || []).find((c) => c.id === contractId)
      r.log('contract-actually-updated', found?.contractValue === 45000 && found?.status === 'CANCELLED', JSON.stringify(found))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'INDEPENDENT_CONSULTANT') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let retainers = 0, contracts = 0, custs = 0
      try { retainers += db.prepare(`DELETE FROM RetainerAgreement WHERE title LIKE '${TEST_PREFIX}%'`).run().changes } catch { /* noop */ }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const cid of custIds) {
        try { contracts += db.prepare('DELETE FROM ServiceContract WHERE customerId = ?').run(cid).changes } catch { /* noop */ }
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ retainers, contracts, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nRETAINER / SERVICE CONTRACT: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
