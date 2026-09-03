/**
 * Suite 118 — tickets.update/delete/generateInvoice (service-ticket.
 * handler.ts registers under the "tickets" channel, not "serviceTicket" as
 * the broader-gap-list's file-name-derived label suggested). create is
 * already covered via real UI (suite 75); update/delete/generateInvoice had
 * zero coverage of any kind.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Ticket118'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-service-business', async () => {
      const sw = await h.switchBusinessType(page, 'Service Business / Agency / IT')
      r.log('business-type-switched', sw.to === 'SERVICE', JSON.stringify(sw))
    })

    let customerId
    const customerName = `${TEST_PREFIX} Customer ${suffix}`
    await r.step('create-customer', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), customerName)
      customerId = custRes?.data?.id
      r.log('customer-created', !!customerId, JSON.stringify(custRes?.error || ''))
    })

    async function createTicketViaUi(title, withCustomer) {
      await h.gotoHash(page, '#/service/tickets')
      await page.waitForTimeout(700)
      await page.getByRole('button', { name: 'New Service Ticket' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.locator('input').nth(0).fill(title)
      if (withCustomer) await modal.getByLabel('Customer').selectOption({ label: customerName })
      await modal.locator('button', { hasText: 'Create Ticket' }).click()
      await page.waitForTimeout(1200)
      const noCrash = !(await h.hasErrorBoundary(page))

      const listRes = await page.evaluate(async () => window.api.tickets.list({}))
      const tickets = listRes?.data?.tickets || listRes?.data || []
      const ticket = tickets.find((t) => t.title === title)
      return { id: ticket?.id, noCrash, ticket }
    }

    // ── Ticket A: update (status change) + generateInvoice ─────────────────
    const titleA = `${TEST_PREFIX} Ticket A ${suffix}`
    let ticketAId
    await r.step('ticket-A-create-and-advance-status-via-ui', async () => {
      const res = await createTicketViaUi(titleA, true)
      ticketAId = res.id
      r.log('ticket-A-created-no-crash', res.noCrash)
      r.log('ticket-A-persisted-with-customer', !!ticketAId && res.ticket?.customerId === customerId, JSON.stringify(res.ticket))
      if (!ticketAId) return

      await page.locator('button', { hasText: titleA }).first().click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.locator('button', { hasText: 'In Progress' }).click()
      await page.waitForTimeout(1000)
      r.log('status-update-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.tickets.list({}))
      const tickets = listRes?.data?.tickets || listRes?.data || []
      const found = tickets.find((t) => t.id === ticketAId)
      r.log('ticket-A-status-updated', found?.status === 'IN_PROGRESS', JSON.stringify(found))
    })

    let invoiceId
    await r.step('ticket-A-generate-invoice-via-ui', async () => {
      if (!ticketAId) return r.log('ticket-A-generate-invoice-via-ui', false, 'no ticketAId')
      const modal = h.topModal(page)
      await modal.getByPlaceholder('Billable amount').fill('700')
      const genBtn = modal.locator('button', { hasText: 'Invoice' })
      r.log('generate-invoice-button-present', await genBtn.count() > 0)
      await genBtn.click()
      await page.waitForTimeout(1500)
      r.log('generate-invoice-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.tickets.list({}))
      const tickets = listRes?.data?.tickets || listRes?.data || []
      const found = tickets.find((t) => t.id === ticketAId)
      invoiceId = found?.invoiceId
      r.log('invoice-generated', !!invoiceId, JSON.stringify(found))
      if (invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), invoiceId)
        r.log('invoice-total-matches-amount-plus-gst', Math.abs((invRes?.data?.totalAmount ?? 0) - 700 * 1.18) < 1, JSON.stringify(invRes?.data?.totalAmount))
      }

      // Detail modal doesn't auto-close after Generate Invoice -- close
      // explicitly so it doesn't obscure ticket B's "New Service Ticket" click.
      await modal.locator('button', { hasText: '×' }).first().click().catch(() => {})
      await page.waitForTimeout(400)
    })

    // ── Ticket B: delete ─────────────────────────────────────────────────────
    const titleB = `${TEST_PREFIX} Ticket B ${suffix}`
    let ticketBId
    await r.step('ticket-B-create-and-delete-via-ui', async () => {
      const res = await createTicketViaUi(titleB, false)
      ticketBId = res.id
      r.log('ticket-B-created-no-crash', res.noCrash)
      r.log('ticket-B-persisted', !!ticketBId, JSON.stringify(res.ticket))
      if (!ticketBId) return

      await page.locator('button', { hasText: titleB }).first().click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.locator('button', { hasText: 'Delete Ticket' }).click()
      await page.waitForTimeout(400)
      const confirmDialog = h.topModal(page)
      await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('delete-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.tickets.list({}))
      const tickets = listRes?.data?.tickets || listRes?.data || []
      r.log('ticket-B-actually-gone', !tickets.some((t) => t.id === ticketBId))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'SERVICE') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const ticketRows = db.prepare(`SELECT id, invoiceId FROM ServiceTicket WHERE title LIKE '${TEST_PREFIX}%'`).all()
      let invoices = 0, invoiceItems = 0, tickets = 0
      for (const t of ticketRows) {
        if (t.invoiceId && t.invoiceId !== 'PENDING_INVOICE_GENERATION') {
          invoiceItems += db.prepare('DELETE FROM InvoiceItem WHERE invoiceId = ?').run(t.invoiceId).changes
          try { invoices += db.prepare('DELETE FROM Invoice WHERE id = ?').run(t.invoiceId).changes } catch { /* noop */ }
        }
        try { tickets += db.prepare('DELETE FROM ServiceTicket WHERE id = ?').run(t.id).changes } catch { /* noop */ }
      }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let custs = 0
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ tickets, invoices, invoiceItems, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nTICKETS INVOICE/UPDATE/DELETE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
