/**
 * Suite 22 — Independent Consultant vertical (retainers). Real UI-driven
 * retainer creation via RetainersScreen and real UI-driven invoice
 * generation via its ConfirmDialog. See project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Cons'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-consultant', async () => {
      // NOT h.switchBusinessType('Consultant') — IndustrySettingsScreen has
      // TWO tiles both matching that substring ("Consultant / Freelancer"
      // for legacy CONSULTANT, "Consultant" for INDEPENDENT_CONSULTANT), and
      // the tile-click helper's `:has-text().first()` would pick whichever
      // renders first in the array, not necessarily the intended one. Raw
      // IPC + reload sidesteps the ambiguity (same workaround suite 02 uses
      // for GP_CLINIC, which has no tile at all).
      const res = await page.evaluate(async () => window.api.industry.changeBusinessType({ businessType: 'INDEPENDENT_CONSULTANT' }))
      r.log('business-type-switch-api-succeeded', !!res?.success, JSON.stringify(res?.error || ''))
      await page.reload()
      await page.waitForTimeout(1500)
    })

    let clientId

    await r.step('create-client', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Cons Client', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      r.log('client-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))
      clientId = custRes?.data?.id
    })

    await r.step('create-retainer-via-real-ui', async () => {
      await h.gotoHash(page, '#/service/retainers')
      await page.waitForTimeout(700)
      r.log('retainers-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Retainer' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('Search by name or phone...').fill('E2E Cons Client')
      await page.waitForTimeout(700)
      const custOption = modal.locator('button', { hasText: 'E2E Cons Client' }).first()
      r.log('client-search-found-result', await custOption.count() > 0)
      await custOption.click()
      await page.waitForTimeout(300)

      await modal.getByPlaceholder('e.g. Monthly Marketing Retainer').fill('E2E Consulting Retainer')
      const monthlyAmountInput = modal.locator('input[type="number"]').first()
      await monthlyAmountInput.fill('20000')
      const startDateInput = modal.locator('input[type="date"]').first()
      await startDateInput.fill(new Date().toISOString().slice(0, 10))
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Create Retainer' }).click()
      await page.waitForTimeout(1200)
      r.log('retainer-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'consultant-retainer-created')
    })

    await r.step('verify-retainer-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.retainer.list({}))
      const retainers = listRes?.data || []
      const found = retainers.find((rt) => rt.title === 'E2E Consulting Retainer')
      r.log('retainer-findable-via-api', !!found, JSON.stringify({ monthlyAmount: found?.monthlyAmount, status: found?.status }))
    })

    await r.step('generate-invoice-via-real-ui-confirm-dialog', async () => {
      const receiptBtn = page.locator('button[title="Generate this month\'s invoice"]').first()
      r.log('generate-invoice-icon-present', await receiptBtn.count() > 0)
      await receiptBtn.click()
      await page.waitForTimeout(500)

      // Confirm message is a raw template-literal interpolation of the plain
      // Number monthlyAmount (serializeRetainer does `Number(r.monthlyAmount)`)
      // — no locale/comma formatting, so "₹20000" not "₹20,000".
      const confirmText = page.locator('text=Generate a ₹20000 invoice')
      r.log('confirm-dialog-shows-correct-amount', await confirmText.count() > 0)

      // exact:true — unscoped "Generate" also substring-matches the trigger
      // icon button's title="Generate this month's invoice" attribute.
      await page.getByRole('button', { name: 'Generate', exact: true }).click()
      await page.waitForTimeout(1500)
      r.log('invoice-generation-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'consultant-invoice-generated')
    })

    let retainerId

    await r.step('verify-invoice-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.retainer.list({}))
      const retainers = listRes?.data || []
      const found = retainers.find((rt) => rt.title === 'E2E Consulting Retainer')
      retainerId = found?.id
      r.log('retainer-shows-invoiced-period', !!found?.lastInvoicedPeriod, JSON.stringify(found?.lastInvoicedPeriod))
    })

    await r.step('same-period-retry-blocked', async () => {
      if (!retainerId) return r.log('same-period-retry-blocked', false, 'no retainerId captured')
      const period = new Date().toISOString().slice(0, 7)
      const retryRes = await page.evaluate(async ({ id, period }) => window.api.retainer.generateInvoice({ id, period }), { id: retainerId, period })
      r.log('same-period-retry-correctly-blocked', retryRes?.success === false && retryRes?.error?.code === 'RT30-006', JSON.stringify(retryRes?.error))
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
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      const ids = db.prepare("SELECT id FROM RetainerAgreement WHERE title LIKE 'E2E Consulting%'").all().map((r2) => r2.id)
      for (const id of ids) { try { db.prepare('DELETE FROM RetainerAgreement WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: retainers', ids.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCONSULTANT VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
