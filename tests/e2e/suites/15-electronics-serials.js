/**
 * Suite 15 — Electronics vertical (serial_tracking, imei_tracking,
 * warranty_tracking). Real UI-driven serial/IMEI unit sale via Billing's
 * "Select Device" picker, qty-locked-to-one enforcement, and the
 * cannot-resell-a-sold-unit guard (SER-012). See project memory
 * project_vertical_uat_research.md for the researched IPC/UI contract this
 * suite is based on, and project_final_testing_pass_2026_07_15.md for the
 * "one vertical at a time" testing convention.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Elec'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-electronics', async () => {
      const sw = await h.switchBusinessType(page, 'Electronics')
      r.log('business-type-switched-to-electronics', sw.to === 'ELECTRONICS', JSON.stringify(sw))
    })

    let productId

    await r.step('create-electronics-product', async () => {
      const res = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Elec Phone X200',
        unit: 'PCS',
        sellingPrice: 25000,
        costPrice: 20000,
        taxRate: 18,
        productType: 'STANDARD',
      }))
      r.log('product-created', !!res?.success, JSON.stringify(res?.error || ''))
      productId = res?.data?.id
    })

    let serial1Id, serial2Id

    await r.step('create-two-serial-units', async () => {
      const s1 = await page.evaluate(async (pid) => window.api.serials.create({
        productId: pid, serialNumber: `E2ESER${Date.now()}1`, imeiNumber: `35${String(Date.now()).slice(-13)}`, warrantyMonths: 12,
      }), productId)
      r.log('serial-1-created', !!s1?.success, JSON.stringify(s1?.error || ''))
      serial1Id = s1?.data?.id

      const s2 = await page.evaluate(async (pid) => window.api.serials.create({
        productId: pid, serialNumber: `E2ESER${Date.now()}2`, imeiNumber: `35${String(Date.now()).slice(-13)}9`, warrantyMonths: 6,
      }), productId)
      r.log('serial-2-created', !!s2?.success, JSON.stringify(s2?.error || ''))
      serial2Id = s2?.data?.id
    })

    await r.step('inventory-incremented-by-2-serials', async () => {
      const invRes = await page.evaluate(async (pid) => window.api.products.get(pid), productId)
      const qty = invRes?.data?.inventory?.quantity
      r.log('inventory-quantity-is-2', qty === 2, `quantity=${qty}`)
    })

    let customerId

    await r.step('create-customer', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Elec Buyer', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      r.log('customer-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))
      customerId = custRes?.data?.id
    })

    let invoiceId

    await r.step('sell-one-device-via-real-ui-select-device-picker', async () => {
      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)

      const prodSearch = page.locator('input[placeholder="Search products…"]')
      await prodSearch.fill('E2E Elec Phone X200')
      await page.waitForTimeout(700)
      const prodOption = page.locator('button:has-text("E2E Elec Phone X200")').first()
      r.log('product-search-found-result', await prodOption.count() > 0)
      await prodOption.click()
      await page.waitForTimeout(600)

      const deviceModalHeading = page.locator('h3', { hasText: 'Select Device' })
      r.log('select-device-modal-opened', await deviceModalHeading.count() > 0)
      await h.shot(page, 'electronics-select-device-modal')

      const deviceRows = page.locator('button', { hasText: 'IMEI:' })
      r.log('device-picker-shows-both-serials', await deviceRows.count() === 2, `count=${await deviceRows.count()}`)

      await deviceRows.first().click()
      await page.waitForTimeout(500)
      r.log('device-added-to-cart-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'electronics-cart-after-device-pick')

      const custSearch = page.locator('input[placeholder="Search customers…"]')
      await custSearch.fill('E2E Elec Buyer')
      await page.waitForTimeout(700)
      const custOption = page.locator('button:has-text("E2E Elec Buyer")').first()
      r.log('customer-search-found-result', await custOption.count() > 0)
      await custOption.click()
      await page.waitForTimeout(300)
    })

    await r.step('qty-stepper-locked-to-one-for-serial-line', async () => {
      const disabledInputs = page.locator('input[type="number"][disabled]')
      r.log('at-least-one-qty-input-disabled-for-serial-line', await disabledInputs.count() > 0, `disabledCount=${await disabledInputs.count()}`)
    })

    await r.step('submit-invoice-via-real-ui', async () => {
      await page.keyboard.press('F10')
      await page.waitForTimeout(1500)
      const url = page.url()
      const match = url.match(/#\/billing\/([a-zA-Z0-9]+)/)
      r.log('invoice-created-navigated-to-detail', !!match, url)
      if (match) invoiceId = match[1]
      r.log('billing-screen-no-crash-after-submit', !(await h.hasErrorBoundary(page)))
    })

    await r.step('verify-invoice-via-api', async () => {
      if (!invoiceId) return r.log('verify-invoice-via-api', false, 'no invoiceId captured')
      const res = await page.evaluate(async (id) => window.api.billing.getInvoice(id), invoiceId)
      r.log('invoice-fetch-success', !!res?.success)
      r.log('invoice-customer-linked', res?.data?.customerId === customerId, `expected=${customerId} actual=${res?.data?.customerId}`)
    })

    let soldSerialId

    await r.step('sold-serial-marked-sold-and-not-resellable', async () => {
      const listRes = await page.evaluate(async (pid) => window.api.serials.list({ productId: pid }), productId)
      const serials = listRes?.data?.serials || []
      const sold = serials.filter((s) => s.status === 'SOLD')
      const available = serials.filter((s) => s.status === 'AVAILABLE')
      r.log('exactly-one-serial-marked-sold', sold.length === 1, `sold=${sold.length}`)
      r.log('exactly-one-serial-still-available', available.length === 1, `available=${available.length}`)

      const soldId = sold[0]?.id
      soldSerialId = soldId
      if (soldId) {
        const resellRes = await page.evaluate(async ({ productId, customerId, soldId }) => window.api.billing.createInvoice({
          customerId, paymentMethod: 'CASH',
          items: [{ productId, quantity: 1, unitPrice: 25000, taxRate: 18, serialId: soldId }],
        }), { productId, customerId, soldId })
        r.log('reselling-sold-unit-correctly-rejected', resellRes?.success === false, JSON.stringify(resellRes?.error || resellRes))
      } else {
        r.log('reselling-sold-unit-correctly-rejected', false, 'no sold serial id captured')
      }
    })

    await r.step('warranty-expiry-computed-from-purchase-plus-months', async () => {
      const listRes = await page.evaluate(async (pid) => window.api.serials.list({ productId: pid }), productId)
      const serials = listRes?.data?.serials || []
      const withWarranty = serials.find((s) => s.warrantyMonths === 12)
      r.log('warranty-expiry-date-set', !!withWarranty?.warrantyExpiryDate, JSON.stringify(withWarranty?.warrantyExpiryDate))
    })

    await r.step('serial-warranty-report-renders', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      // Real, generalizable E2E bug found live 2026-08-20 (Phase 67 §9.1
      // item 2): every report tile in ReportsScreen.tsx is a real <button>,
      // but its own parent category wrapper <div> ALSO matches `hasText`
      // (the wrapper's own concatenated text includes every nested tile
      // label) — a combined `'button, div'` locator's `.first()` picks that
      // non-clickable parent div first (it precedes its own child button in
      // DOM order), so the click silently no-ops and whatever report was
      // already active stays active. `button`-only avoids the ambiguity.
      const tile = page.locator('button', { hasText: 'Serial & Warranty Report' }).first()
      r.log('serial-warranty-report-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) {
          await genBtn.click()
          await page.waitForTimeout(1000)
        }
        r.log('serial-warranty-report-renders-no-crash', !(await h.hasErrorBoundary(page)))
      }
    })

    // ─── Phase 67 §9.1 item 1: RMA SLA Tracker ──────────────────────────────
    let repairTicketId
    let technicianId

    await r.step('rma-sla-due-date-set-to-30-days-out-on-sent-to-vendor', async () => {
      if (!soldSerialId) return r.log('rma-sla-due-date-set-to-30-days-out-on-sent-to-vendor', false, 'no soldSerialId captured')

      const createRes = await page.evaluate((serialId) => window.api.repairTickets.create({
        serialId, issueDescription: 'E2E Elec RMA screen defect',
      }), soldSerialId)
      r.log('repair-ticket-created', !!createRes?.success, JSON.stringify(createRes?.error || ''))
      repairTicketId = createRes?.data?.id

      const updRes = await page.evaluate((id) => window.api.repairTickets.updateStatus({
        id, status: 'SENT_TO_VENDOR', vendorRmaNumber: 'VRMA-E2E-1',
      }), repairTicketId)
      r.log('ticket-moved-to-sent-to-vendor', !!updRes?.success, JSON.stringify(updRes?.error || ''))

      const getRes = await page.evaluate((id) => window.api.repairTickets.get({ id }), repairTicketId)
      const ticket = getRes?.data
      r.log('vendor-sla-due-date-set', !!ticket?.vendorSlaDueDate, JSON.stringify(ticket?.vendorSlaDueDate))
      if (ticket?.vendorSlaDueDate && ticket?.sentToVendorDate) {
        const deltaDays = (new Date(ticket.vendorSlaDueDate).getTime() - new Date(ticket.sentToVendorDate).getTime()) / (1000 * 60 * 60 * 24)
        r.log('vendor-sla-due-date-is-30-days-out', Math.abs(deltaDays - 30) < 0.01, `deltaDays=${deltaDays}`)
      }
      r.log('not-overdue-yet-30-days-out', ticket?.isOverdue === false, `isOverdue=${ticket?.isOverdue}`)
    })

    await r.step('rma-overdue-flagged-via-real-api-ui-and-dashboard-once-past-sla', async () => {
      if (!repairTicketId) return r.log('rma-overdue-flagged-via-real-api-ui-and-dashboard-once-past-sla', false, 'no repairTicketId captured')

      // Backdate this real ticket's own sentToVendorDate/vendorSlaDueDate —
      // same "simulate elapsed time via a direct DB write, not a fake clock"
      // approach suite 68 already established for the template-suggestion
      // business-age gate. Real bug caught here: DateTime columns in this
      // SQLite DB are stored as epoch-ms INTEGER (confirmed via a direct
      // typeof() query against Invoice/BusinessProfile), not an ISO string —
      // writing toISOString() left a real, working single-row read (Prisma's
      // client-side deserialization is lenient) but silently broke every
      // SQL-level WHERE-clause comparison (the dashboard alert's own count
      // query, and the per-row Overdue badge which the same live data feeds).
      h.withDb((db) => {
        const past = Date.now() - 45 * 86400000
        const dueDate = Date.now() - 15 * 86400000
        db.prepare('UPDATE RepairTicket SET sentToVendorDate = ?, vendorSlaDueDate = ? WHERE id = ?')
          .run(past, dueDate, repairTicketId)
      })

      const getRes = await page.evaluate((id) => window.api.repairTickets.get({ id }), repairTicketId)
      r.log('ticket-now-overdue-via-real-api', getRes?.data?.isOverdue === true, `isOverdue=${getRes?.data?.isOverdue}`)
      r.log('days-with-vendor-computed-as-45', getRes?.data?.daysWithVendor === 45, `daysWithVendor=${getRes?.data?.daysWithVendor}`)

      await h.gotoHash(page, '#/electronics/repair-tickets')
      await page.waitForTimeout(700)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      // Case-insensitive — Badge labels are CSS-uppercased, so Chromium's
      // own innerText() honors that transform (known gotcha, not a
      // rendering bug — see feedback_uppercase_css_innertext_gotcha).
      r.log('repair-tickets-screen-shows-overdue-badge', bodyText.toLowerCase().includes('overdue'))
      r.log('repair-tickets-screen-shows-overdue-count-in-header', bodyText.includes('overdue from vendor RMA'))
      await h.shot(page, 'electronics-rma-overdue')

      const alertsRes = await page.evaluate(() => window.api.analytics.getDashboardAlerts())
      const alerts = alertsRes?.data || []
      const rmaAlert = alerts.find((a) => a.type === 'RMA_OVERDUE')
      r.log('dashboard-alert-shows-rma-overdue', !!rmaAlert, JSON.stringify(rmaAlert))
    })

    // ─── Phase 67 §9.1 item 2: RMA Aging Report ─────────────────────────────
    await r.step('rma-aging-report-computes-and-renders-correctly', async () => {
      if (!repairTicketId) return r.log('rma-aging-report-computes-and-renders-correctly', false, 'no repairTicketId captured')

      const reportRes = await page.evaluate(() => window.api.reports.rmaAging())
      r.log('rma-aging-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const ourRow = (reportRes?.data?.rows || []).find((rr) => rr.daysWithVendor === 45)
      r.log('rma-aging-report-includes-our-ticket', !!ourRow, JSON.stringify(ourRow))
      if (ourRow) {
        r.log('rma-aging-row-marked-overdue', ourRow.isOverdue === true, `isOverdue=${ourRow.isOverdue}`)
        r.log('rma-aging-row-has-vendor-name', ourRow.vendorName === null || typeof ourRow.vendorName === 'string')
      }
      r.log('rma-aging-summary-overdue-count-at-least-one', (reportRes?.data?.summary?.overdueCount ?? 0) >= 1, JSON.stringify(reportRes?.data?.summary))

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'RMA Aging Report' }).first()
      r.log('rma-aging-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) {
          await genBtn.click()
          await page.waitForTimeout(1000)
        }
        r.log('rma-aging-report-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('rma-aging-report-shows-claim-number', bodyText.includes('RMA-'))
        await h.shot(page, 'electronics-rma-aging-report')
      }
    })

    // ─── Phase 67 §9.1 item 3: Vendor Recovery Ledger ───────────────────────
    await r.step('vendor-recovery-ledger-claim-recovery-writeoff-lifecycle', async () => {
      if (!repairTicketId) return r.log('vendor-recovery-ledger-claim-recovery-writeoff-lifecycle', false, 'no repairTicketId captured')

      const claimRes = await page.evaluate((id) => window.api.repairTickets.recordVendorClaim({ id, amount: 5000 }), repairTicketId)
      r.log('vendor-claim-recorded', !!claimRes?.success, JSON.stringify(claimRes?.error || ''))

      const afterClaim = await page.evaluate((id) => window.api.repairTickets.get({ id }), repairTicketId)
      r.log('vendor-claim-amount-set', afterClaim?.data?.vendorClaimAmount === 5000, JSON.stringify(afterClaim?.data?.vendorClaimAmount))
      r.log('vendor-claim-outstanding-equals-claim-before-recovery', afterClaim?.data?.vendorClaimOutstanding === 5000, JSON.stringify(afterClaim?.data?.vendorClaimOutstanding))

      const recoveryRes = await page.evaluate((id) => window.api.repairTickets.recordVendorRecovery({ id, amount: 2000 }), repairTicketId)
      r.log('vendor-recovery-recorded', !!recoveryRes?.success, JSON.stringify(recoveryRes?.error || ''))

      const afterRecovery = await page.evaluate((id) => window.api.repairTickets.get({ id }), repairTicketId)
      r.log('vendor-recovery-outstanding-computed-correctly', afterRecovery?.data?.vendorClaimOutstanding === 3000, JSON.stringify(afterRecovery?.data?.vendorClaimOutstanding))
      r.log('vendor-claim-not-closed-on-partial-recovery', afterRecovery?.data?.vendorClaimClosedAt === null)

      const ledgerRes = await page.evaluate(() => window.api.reports.vendorRecoveryLedger())
      r.log('vendor-recovery-ledger-api-succeeded', !!ledgerRes?.success, JSON.stringify(ledgerRes?.error || ''))
      const ourRow = (ledgerRes?.data?.rows || []).find((rr) => rr.claimNumber === afterRecovery?.data?.claimNumber)
      r.log('vendor-recovery-ledger-includes-our-claim', !!ourRow, JSON.stringify(ourRow))
      if (ourRow) {
        r.log('vendor-recovery-ledger-row-outstanding-correct', ourRow.outstandingAmount === 3000, `outstandingAmount=${ourRow.outstandingAmount}`)
        r.log('vendor-recovery-ledger-row-not-closed', ourRow.isClosed === false)
      }

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Vendor Recovery Ledger' }).first()
      r.log('vendor-recovery-ledger-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) {
          await genBtn.click()
          await page.waitForTimeout(1000)
        }
        r.log('vendor-recovery-ledger-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('vendor-recovery-ledger-shows-claim-number', bodyText.includes(afterRecovery?.data?.claimNumber || 'RMA-'))
        await h.shot(page, 'electronics-vendor-recovery-ledger')
      }

      // Write off the remaining outstanding amount, closing the claim.
      const writeOffRes = await page.evaluate((id) => window.api.repairTickets.writeOffVendorClaim({ id }), repairTicketId)
      r.log('vendor-claim-written-off', !!writeOffRes?.success, JSON.stringify(writeOffRes?.error || ''))

      const afterWriteOff = await page.evaluate((id) => window.api.repairTickets.get({ id }), repairTicketId)
      r.log('vendor-claim-closed-after-writeoff', !!afterWriteOff?.data?.vendorClaimClosedAt, JSON.stringify(afterWriteOff?.data?.vendorClaimClosedAt))
      r.log('vendor-recovered-amount-unchanged-by-writeoff', afterWriteOff?.data?.vendorRecoveredAmount === 2000, JSON.stringify(afterWriteOff?.data?.vendorRecoveredAmount))

      // A second write-off attempt on an already-closed claim must be rejected.
      const secondWriteOff = await page.evaluate((id) => window.api.repairTickets.writeOffVendorClaim({ id }), repairTicketId)
      r.log('second-writeoff-rejected', secondWriteOff?.success === false && secondWriteOff?.error?.code === 'RPR-022', JSON.stringify(secondWriteOff))
    })

    // ─── Phase 67 §9.1 item 4: Repair Turnaround by Technician ──────────────
    await r.step('repair-turnaround-by-technician-report-computes-and-renders-correctly', async () => {
      if (!repairTicketId) return r.log('repair-turnaround-by-technician-report-computes-and-renders-correctly', false, 'no repairTicketId captured')

      const techName = `E2E Elec Tech ${Date.now()}`
      const techRes = await page.evaluate((fullName) => window.api.hr.createEmployee({
        fullName, joinDate: new Date().toISOString(),
      }), techName)
      r.log('technician-employee-created', !!techRes?.success, JSON.stringify(techRes?.error || ''))
      technicianId = techRes?.data?.id

      // Backdate receivedDate 7 days before "now" so the RETURNED_TO_CUSTOMER
      // transition below (which stamps deliveredDate = now) produces a real,
      // deterministic turnaround — same epoch-ms-integer convention every
      // other backdating write in this suite already established.
      h.withDb((db) => {
        const past = Date.now() - 7 * 86400000
        db.prepare('UPDATE RepairTicket SET receivedDate = ? WHERE id = ?').run(past, repairTicketId)
      })

      const assignRes = await page.evaluate((args) => window.api.repairTickets.updateStatus({
        id: args.id, status: 'REPAIRED', technicianId: args.technicianId,
      }), { id: repairTicketId, technicianId })
      r.log('ticket-moved-to-repaired-with-technician-assigned', !!assignRes?.success, JSON.stringify(assignRes?.error || ''))

      const returnRes = await page.evaluate((id) => window.api.repairTickets.updateStatus({ id, status: 'RETURNED_TO_CUSTOMER' }), repairTicketId)
      r.log('ticket-returned-to-customer', !!returnRes?.success, JSON.stringify(returnRes?.error || ''))

      const getRes = await page.evaluate((id) => window.api.repairTickets.get({ id }), repairTicketId)
      r.log('ticket-turnaround-days-approximately-7', Math.abs((getRes?.data?.turnaroundDays ?? -999) - 7) <= 1, `turnaroundDays=${getRes?.data?.turnaroundDays}`)
      r.log('ticket-technician-set-via-real-api', getRes?.data?.technician?.id === technicianId, JSON.stringify(getRes?.data?.technician))

      const reportRes = await page.evaluate(() => window.api.reports.repairTurnaroundByTechnician())
      r.log('repair-turnaround-report-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const ourRow = (reportRes?.data?.rows || []).find((rr) => rr.technicianId === technicianId)
      r.log('repair-turnaround-report-includes-our-technician', !!ourRow, JSON.stringify(ourRow))
      if (ourRow) {
        r.log('repair-turnaround-row-ticket-count-is-one', ourRow.ticketCount === 1, `ticketCount=${ourRow.ticketCount}`)
        r.log('repair-turnaround-row-avg-days-approximately-7', Math.abs(ourRow.avgTurnaroundDays - 7) <= 1, `avgTurnaroundDays=${ourRow.avgTurnaroundDays}`)
      }

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Repair Turnaround by Technician' }).first()
      r.log('repair-turnaround-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) {
          await genBtn.click()
          await page.waitForTimeout(1000)
        }
        r.log('repair-turnaround-report-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('repair-turnaround-report-shows-technician-name', bodyText.includes(techName))
        await h.shot(page, 'electronics-repair-turnaround-by-technician')
      }
    })

    // ─── Phase 67 §9.1 item 5: Serial-Number Service Lookup ─────────────────
    await r.step('serial-service-lookup-computes-and-renders-correctly', async () => {
      if (!repairTicketId) return r.log('serial-service-lookup-computes-and-renders-correctly', false, 'no repairTicketId captured')

      const ticketRes = await page.evaluate((id) => window.api.repairTickets.get({ id }), repairTicketId)
      const serialNumber = ticketRes?.data?.serial?.serialNumber
      const imeiNumber = ticketRes?.data?.serial?.imeiNumber
      r.log('captured-serial-and-imei-for-lookup', !!serialNumber && !!imeiNumber, `serial=${serialNumber} imei=${imeiNumber}`)

      const bySerialRes = await page.evaluate((search) => window.api.repairTickets.lookupSerialService({ search }), serialNumber)
      r.log('lookup-by-serial-number-succeeded', !!bySerialRes?.success, JSON.stringify(bySerialRes?.error || ''))
      r.log('lookup-by-serial-shows-correct-product', bySerialRes?.data?.serial?.productName === 'E2E Elec Phone X200', JSON.stringify(bySerialRes?.data?.serial))
      r.log('lookup-by-serial-includes-purchase-info', bySerialRes?.data?.purchase?.unitPrice === 25000, JSON.stringify(bySerialRes?.data?.purchase))
      r.log('lookup-by-serial-includes-customer-name', typeof bySerialRes?.data?.purchase?.customerName === 'string' && bySerialRes.data.purchase.customerName.length > 0)
      const ourTicket = (bySerialRes?.data?.tickets || []).find((tk) => tk.id === repairTicketId)
      r.log('lookup-by-serial-includes-our-repair-ticket', !!ourTicket, JSON.stringify(ourTicket))

      const byImeiRes = await page.evaluate((search) => window.api.repairTickets.lookupSerialService({ search }), imeiNumber)
      r.log('lookup-by-imei-also-resolves-the-same-serial', byImeiRes?.data?.serial?.id === bySerialRes?.data?.serial?.id, JSON.stringify(byImeiRes?.data?.serial))

      const notFoundRes = await page.evaluate(() => window.api.repairTickets.lookupSerialService({ search: 'NO-SUCH-SERIAL-EXISTS' }))
      r.log('lookup-not-found-correctly-rejected', notFoundRes?.success === false && notFoundRes?.error?.code === 'RPR-025', JSON.stringify(notFoundRes))

      await h.gotoHash(page, '#/electronics/serials')
      await page.waitForTimeout(700)
      const searchInput = page.locator('input[placeholder*="Scan or enter"]')
      r.log('service-lookup-box-present', await searchInput.count() > 0)
      if (await searchInput.count()) {
        await searchInput.fill(serialNumber)
        await searchInput.press('Enter')
        await page.waitForTimeout(700)
        r.log('service-lookup-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('service-lookup-shows-product-name', bodyText.includes('E2E Elec Phone X200'))
        r.log('service-lookup-shows-repair-claim-number', bodyText.includes(ourTicket?.claimNumber || 'RMA-'))
        await h.shot(page, 'electronics-serial-service-lookup')
      }
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'ELECTRONICS') {
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
      const serialIds = db.prepare("SELECT id FROM ProductSerial WHERE serialNumber LIKE 'E2ESER%'").all().map((r2) => r2.id)
      // Phase 67 §9.1 — Electronics: RMA SLA tracker needed the first-ever
      // E2E test RepairTicket. RepairTicket.serialId has no onDelete clause
      // (defaults to RESTRICT), so a leftover ticket would otherwise force
      // the ProductSerial delete below into its own try/catch fallback,
      // silently leaking both rows on every run — deleted first, in FK-
      // dependency order, same reasoning as every other cleanup block this
      // phase has added.
      let ticketsRemoved = 0
      for (const sid of serialIds) {
        const rows = db.prepare('SELECT id FROM RepairTicket WHERE serialId = ? OR replacementSerialId = ?').all(sid, sid)
        for (const row of rows) {
          try { db.prepare('DELETE FROM RepairTicket WHERE id = ?').run(row.id); ticketsRemoved++ } catch { /* still referenced — leave it */ }
        }
      }
      for (const sid of serialIds) {
        try { db.prepare('DELETE FROM ProductSerial WHERE id = ?').run(sid) } catch { /* leave it, harmless test row */ }
      }
      // Phase 67 §9.1 — Electronics: repair turnaround by technician needed
      // the first-ever E2E test Employee. RepairTicket.technicianId is
      // onDelete: SetNull (unlike serialId's RESTRICT above), so deletion
      // order here doesn't matter — any remaining reference is nulled out
      // automatically rather than blocking the delete.
      const techRemoved = db.prepare("DELETE FROM Employee WHERE fullName LIKE 'E2E Elec Tech%'").run().changes
      console.log('extra cleanup: serials', serialIds.length, 'repairTickets', ticketsRemoved, 'technicians', techRemoved)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nELECTRONICS VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
