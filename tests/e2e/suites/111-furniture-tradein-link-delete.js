/**
 * Suite 111 — furnitureTradeIn.linkToInvoice/delete (broader-gap-list
 * Section C, 2026-09-03). create is already covered (suite 89, read-only
 * list checks reference it) but link/delete were never exercised. Mirrors
 * MetalExchangeScreen.tsx's UI pattern exactly (same author comment).
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Furn2'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-furniture-store', async () => {
      const sw = await h.switchBusinessType(page, 'Furniture Store')
      r.log('business-type-switched', sw.to === 'FURNITURE', JSON.stringify(sw))
    })

    let tradeInAId, tradeInBId
    await r.step('trade-in-A-create-and-link-via-ui', async () => {
      await h.gotoHash(page, '#/furniture/trade-ins')
      await page.waitForTimeout(700)
      r.log('trade-ins-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Record Trade-In' }).click()
      await page.waitForTimeout(400)
      await page.getByLabel('Walk-In Name').fill(`${TEST_PREFIX} Walkin A`)
      await page.getByLabel('Item Description').fill('E2E 3-seater sofa')
      await page.getByLabel(/Trade-In Value/).fill('5000')
      await page.getByRole('button', { name: 'Record', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('trade-in-A-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.furnitureTradeIn.list())
      const found = (listRes?.data || []).find((x) => x.customerName === `${TEST_PREFIX} Walkin A`)
      tradeInAId = found?.id
      r.log('trade-in-A-persisted', !!tradeInAId, JSON.stringify(found))
      if (!tradeInAId) return

      const row = page.locator('div', { hasText: `${TEST_PREFIX} Walkin A` }).last().locator('xpath=ancestor::div[contains(@class,"items-start")][1]')
      await row.getByRole('button', { name: 'Mark Applied' }).click()
      await page.waitForTimeout(400)
      await page.getByLabel('Invoice ID').fill('INV-E2E-TEST-003')
      await page.getByRole('button', { name: 'Link', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('trade-in-A-link-no-crash', !(await h.hasErrorBoundary(page)))

      const afterLink = await page.evaluate(async () => window.api.furnitureTradeIn.list())
      const foundAfter = (afterLink?.data || []).find((x) => x.id === tradeInAId)
      r.log('trade-in-A-linked-to-invoice', foundAfter?.invoiceId === 'INV-E2E-TEST-003', JSON.stringify(foundAfter))
    })

    await r.step('trade-in-B-create-and-delete-via-ui', async () => {
      await page.getByRole('button', { name: 'Record Trade-In' }).click()
      await page.waitForTimeout(400)
      await page.getByLabel('Walk-In Name').fill(`${TEST_PREFIX} Walkin B`)
      await page.getByLabel('Item Description').fill('E2E Dining table')
      await page.getByLabel(/Trade-In Value/).fill('3000')
      await page.getByRole('button', { name: 'Record', exact: true }).click()
      await page.waitForTimeout(1000)

      const listRes = await page.evaluate(async () => window.api.furnitureTradeIn.list())
      const found = (listRes?.data || []).find((x) => x.customerName === `${TEST_PREFIX} Walkin B`)
      tradeInBId = found?.id
      r.log('trade-in-B-persisted', !!tradeInBId, JSON.stringify(found))
      if (!tradeInBId) return

      const row = page.locator('div', { hasText: `${TEST_PREFIX} Walkin B` }).last().locator('xpath=ancestor::div[contains(@class,"items-start")][1]')
      await row.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
      await page.waitForTimeout(1000)
      r.log('trade-in-B-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const afterDelete = await page.evaluate(async () => window.api.furnitureTradeIn.list())
      const stillThere = (afterDelete?.data || []).some((x) => x.id === tradeInBId)
      r.log('trade-in-B-actually-gone', !stillThere)
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'FURNITURE') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const removed = db.prepare("DELETE FROM FurnitureTradeIn WHERE customerName LIKE 'E2E Furn2%'").run().changes
      console.log('extra cleanup:', JSON.stringify({ removed }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nFURNITURE TRADE-IN LINK/DELETE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
