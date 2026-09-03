/**
 * Suite 110 — Jewellery vertical: metalExchange (whole file -- create/
 * delete/linkToInvoice, zero prior coverage), metalRate.delete, and
 * goldSavings.linkToInvoice (broader-gap-list Section C, 2026-09-03).
 * goldSavings.create/recordInstallment/redeem are already covered live-UI
 * in suite 74 -- reused here via API purely as setup for linkToInvoice,
 * which has no UI trigger anywhere in the renderer.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Jewel2'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-jewellery', async () => {
      const sw = await h.switchBusinessType(page, 'Jewellery')
      r.log('business-type-switched', sw.to === 'JEWELLERY', JSON.stringify(sw))
    })

    await r.step('seed-metal-rates-for-exchange-test', async () => {
      // metalExchange.create computes valueGiven from a real configured
      // rate (netWeight x ratePerGram) and rejects with "No rate configured"
      // otherwise -- discovered live via screenshot when the create step
      // below silently no-opped with no thrown error.
      const r22 = await page.evaluate(async () => window.api.metalRate.upsert({ metalType: 'GOLD', purity: '22K', ratePerGram: 6000 }))
      const r18 = await page.evaluate(async () => window.api.metalRate.upsert({ metalType: 'GOLD', purity: '18K', ratePerGram: 5000 }))
      r.log('rates-seeded', !!r22?.success && !!r18?.success, JSON.stringify({ r22: r22?.error, r18: r18?.error }))
    })

    // ── metalExchange: create/link (A), create/delete (B) ───────────────────
    let exchangeAId, exchangeBId
    await r.step('metal-exchange-A-create-and-link-via-ui', async () => {
      await h.gotoHash(page, '#/jewellery/exchanges')
      await page.waitForTimeout(700)
      r.log('exchanges-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Record Exchange' }).click()
      await page.waitForTimeout(400)
      await page.getByLabel(/Walk-in/).fill(`${TEST_PREFIX} Walkin A`)
      await page.getByLabel(/Purity/).fill('22K')
      await page.getByLabel(/Gross Weight/).fill('10')
      await page.getByRole('button', { name: 'Compute & Record' }).click()
      await page.waitForTimeout(1000)
      r.log('exchange-A-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.metalExchange.list())
      const found = (listRes?.data || []).find((x) => x.customerName === `${TEST_PREFIX} Walkin A`)
      exchangeAId = found?.id
      r.log('exchange-A-persisted', !!exchangeAId, JSON.stringify(found))
      if (!exchangeAId) return

      // All exchange rows share ONE outer Card, so "rounded-xl" ancestor
      // would match the whole list, not this row -- walk up to the row's
      // own div (px-5 py-4 flex items-start gap-4) instead. Walk-in name is
      // a plain <div>, not <span>.
      const row = page.locator('div', { hasText: `${TEST_PREFIX} Walkin A` }).last().locator('xpath=ancestor::div[contains(@class,"items-start")][1]')
      await row.getByRole('button', { name: 'Mark Applied' }).click()
      await page.waitForTimeout(400)
      await page.getByLabel(/Invoice Number/).fill('INV-E2E-TEST-001')
      await page.getByRole('button', { name: 'Link', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('exchange-A-link-no-crash', !(await h.hasErrorBoundary(page)))

      const afterLink = await page.evaluate(async () => window.api.metalExchange.list())
      const foundAfter = (afterLink?.data || []).find((x) => x.id === exchangeAId)
      r.log('exchange-A-linked-to-invoice', foundAfter?.invoiceId === 'INV-E2E-TEST-001', JSON.stringify(foundAfter))
    })

    await r.step('metal-exchange-B-create-and-delete-via-ui', async () => {
      await page.getByRole('button', { name: 'Record Exchange' }).click()
      await page.waitForTimeout(400)
      await page.getByLabel(/Walk-in/).fill(`${TEST_PREFIX} Walkin B`)
      await page.getByLabel(/Purity/).fill('18K')
      await page.getByLabel(/Gross Weight/).fill('5')
      await page.getByRole('button', { name: 'Compute & Record' }).click()
      await page.waitForTimeout(1000)

      const listRes = await page.evaluate(async () => window.api.metalExchange.list())
      const found = (listRes?.data || []).find((x) => x.customerName === `${TEST_PREFIX} Walkin B`)
      exchangeBId = found?.id
      r.log('exchange-B-persisted', !!exchangeBId, JSON.stringify(found))
      if (!exchangeBId) return

      const row = page.locator('div', { hasText: `${TEST_PREFIX} Walkin B` }).last().locator('xpath=ancestor::div[contains(@class,"items-start")][1]')
      await row.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
      await page.waitForTimeout(1000)
      r.log('exchange-B-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const afterDelete = await page.evaluate(async () => window.api.metalExchange.list())
      const stillThere = (afterDelete?.data || []).some((x) => x.id === exchangeBId)
      r.log('exchange-B-actually-gone', !stillThere)
    })

    // ── metalRate: create + delete via UI ────────────────────────────────────
    let rateId
    await r.step('metal-rate-create-and-delete-via-ui', async () => {
      await h.gotoHash(page, '#/jewellery/metal-rates')
      await page.waitForTimeout(700)
      r.log('metal-rates-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Set Rate' }).click()
      await page.waitForTimeout(400)
      await page.getByLabel(/Purity/).fill(`E2E-${Date.now().toString().slice(-6)}`)
      await page.getByLabel(/Rate.*Gram/).fill('6500')
      await page.getByRole('button', { name: 'Save Rate' }).click()
      await page.waitForTimeout(1000)
      r.log('metal-rate-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.metalRate.list())
      const found = (listRes?.data || []).find((rt) => rt.ratePerGram === 6500)
      rateId = found?.id
      r.log('metal-rate-persisted', !!rateId, JSON.stringify(found))
      if (!rateId) return

      // A broad `div` + hasText selector's `.first()` matches the OUTERMOST
      // container (document order) -- here that's the whole Card wrapping
      // the entire rate list, not this specific row. `.last()` reaches the
      // innermost (deepest) matching div instead.
      const row = page.locator('div', { hasText: '6500' }).last().locator('xpath=ancestor::div[contains(@class,"grid-cols-12")][1]')
      await row.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
      await page.waitForTimeout(1000)
      r.log('metal-rate-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const afterDelete = await page.evaluate(async () => window.api.metalRate.list())
      const stillThere = (afterDelete?.data || []).some((rt) => rt.id === rateId)
      r.log('metal-rate-actually-gone', !stillThere)
    })

    // ── goldSavings.linkToInvoice: no UI trigger anywhere -- API-only ───────
    await r.step('gold-savings-link-to-invoice-via-api', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({ customerName: name, phone: `9${String(Date.now()).slice(-9)}` }), `${TEST_PREFIX} GS Customer`)
      const customerId = custRes?.data?.id
      r.log('gs-customer-created', !!customerId, JSON.stringify(custRes?.error || ''))
      if (!customerId) return

      const today = h.toLocalISODate(new Date())
      const schemeRes = await page.evaluate(({ customerId, today }) => window.api.goldSavings.create({
        customerId, metalType: 'GOLD', monthlyAmount: 1000, tenureMonths: 11, startDate: today,
      }), { customerId, today })
      const schemeId = schemeRes?.data?.id
      r.log('gs-scheme-created', !!schemeId, JSON.stringify(schemeRes?.error || ''))
      if (!schemeId) return

      const redeemRes = await page.evaluate((schemeId) => window.api.goldSavings.redeem({ schemeId }), schemeId)
      r.log('gs-scheme-redeemed', !!redeemRes?.success, JSON.stringify(redeemRes?.error || ''))

      const linkRes = await page.evaluate((schemeId) => window.api.goldSavings.linkToInvoice({ schemeId, invoiceId: 'INV-E2E-TEST-002' }), schemeId)
      r.log('gs-link-to-invoice-succeeds', !!linkRes?.success, JSON.stringify(linkRes?.error || ''))
      r.log('gs-link-to-invoice-persisted', linkRes?.data?.invoiceId === 'INV-E2E-TEST-002', JSON.stringify(linkRes?.data))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'JEWELLERY') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const exchanges = db.prepare("DELETE FROM MetalExchange WHERE customerName LIKE 'E2E Jewel2%'").run().changes
      let rates = db.prepare("DELETE FROM MetalRate WHERE ratePerGram = 6500").run().changes
      rates += db.prepare("DELETE FROM MetalRate WHERE metalType = 'GOLD' AND purity = '22K' AND ratePerGram = 6000").run().changes
      rates += db.prepare("DELETE FROM MetalRate WHERE metalType = 'GOLD' AND purity = '18K' AND ratePerGram = 5000").run().changes
      const schemeIds = db.prepare("SELECT gs.id FROM GoldSavingsScheme gs JOIN Customer c ON c.id = gs.customerId WHERE c.customerName LIKE 'E2E Jewel2%'").all().map((r2) => r2.id)
      let installments = 0, schemes = 0
      for (const sid of schemeIds) {
        installments += db.prepare('DELETE FROM GoldSavingsInstallment WHERE schemeId = ?').run(sid).changes
        try { schemes += db.prepare('DELETE FROM GoldSavingsScheme WHERE id = ?').run(sid).changes } catch { /* noop */ }
      }
      const custIds = db.prepare("SELECT id FROM Customer WHERE customerName LIKE 'E2E Jewel2%'").all().map((r2) => r2.id)
      let custs = 0
      for (const cid of custIds) {
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ exchanges, rates, installments, schemes, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nJEWELLERY METAL EXCHANGE/RATE/GOLD SAVINGS LINK: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
