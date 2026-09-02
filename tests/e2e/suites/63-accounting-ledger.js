/**
 * Suite 63 — Phase 62 Banking, Ledger & Compliance Backbone: live UI
 * verification for every new screen built this phase, not just the
 * backend IPC layer (already covered by unit tests). Real click-through:
 * fill a real form, submit, confirm the row lands in the real dev DB with
 * the correct GL posting — not just "the screen didn't crash."
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Ledger'
const suffix = Date.now()

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  const createdBankAccountIds = []
  const createdAssetIds = []
  const createdCoaIds = []
  // Phase 62 gap-closure additions (2026-08-27).
  const createdCustomerIds = []
  const createdSupplierIds = []
  const createdInvoiceIds = []
  const createdBillIds = []
  const createdChequeBookIds = []
  // Declared here (not inside try{}) — a const declared inside try{} is
  // block-scoped to that block alone and is NOT visible from finally{},
  // a real bug caught live when this suite's own cleanup block threw
  // "chequeNumber is not defined" on its first run.
  const bankAccountName = `${TEST_PREFIX} Bank ${suffix}`
  const coaCode = `TEST${suffix.toString().slice(-6)}`
  const chequeNumber = `CHQ${suffix.toString().slice(-6)}`
  const assetCode = `FA-E2E-${suffix.toString().slice(-6)}`
  let cashAccountId = null
  // Same block-scoping gotcha as the header comment warns about -- declared
  // here, not inside try{}, so finally{}'s cleanup can see them.
  let manualJeId = null
  let pdcId = null
  let bouncedChequeNumber = null
  let bankAccountId = null

  let page
  try {
    page = await h.getMainWindow(app)
    await h.login(page)

    // ── Breadth: every new screen loads without crashing ──────────────────
    const routes = [
      ['#/accounting/chart-of-accounts', 'chart-of-accounts'],
      ['#/accounting/journal-entries', 'journal-entries'],
      ['#/accounting/bank-accounts', 'bank-accounts'],
      ['#/accounting/post-dated-cheques', 'post-dated-cheques'],
      ['#/accounting/fixed-assets', 'fixed-assets'],
      ['#/accounting/ledger-settings', 'ledger-settings'],
    ]
    for (const [route, label] of routes) {
      await r.step(`visit-${label}`, async () => {
        await h.gotoHash(page, route)
        await page.waitForTimeout(700)
        const crashed = await h.hasErrorBoundary(page)
        r.log(`${label}-loads-no-crash`, !crashed, crashed ? 'ErrorBoundary tripped' : '')
      })
    }

    // ── Bank Account creation, real UI form, real opening-balance GL post ──
    await r.step('create-bank-account-via-ui', async () => {
      await h.gotoHash(page, '#/accounting/bank-accounts')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'New Account' }).click()
      await page.waitForTimeout(400)
      await page.getByLabel('Account Name').fill(bankAccountName)
      await page.getByLabel('Opening Balance').fill('15000')
      await page.locator('button', { hasText: 'Create' }).click()
      await page.waitForTimeout(800)
      r.log('bank-account-modal-closed-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('bank-account-persisted-with-correct-balance-and-gl-entry', () => h.withDb((db) => {
      const row = db.prepare('SELECT * FROM BankAccount WHERE accountName = ?').get(bankAccountName)
      r.log('bank-account-row-exists', !!row, JSON.stringify(row))
      if (row) {
        createdBankAccountIds.push(row.id)
        bankAccountId = row.id
        r.log('bank-account-current-balance-correct', row.currentBalance === 15000, `currentBalance=${row.currentBalance}`)
        const je = db.prepare("SELECT * FROM JournalEntry WHERE sourceType = 'BANK_ACCOUNT_OPENING' AND sourceId = ?").get(row.id)
        r.log('bank-account-opening-je-posted', !!je, JSON.stringify(je))
        if (je) {
          const lines = db.prepare('SELECT SUM(debitAmount) d, SUM(creditAmount) c FROM JournalEntryLine WHERE journalEntryId = ?').get(je.id)
          r.log('bank-account-opening-je-balanced', lines.d === lines.c && lines.d === 15000, JSON.stringify(lines))
        }
      }
    }))

    // ── Documents repository extension: bank-statement inbox on the ────────
    // per-account Bank Reconciliation screen (Section 4.1 item 14).
    await r.step('bank-reconciliation-screen-shows-documents-panel', async () => {
      if (!bankAccountId) { r.log('bank-reconciliation-documents-panel-visible', false, 'no bankAccountId captured'); return }
      await h.gotoHash(page, `#/accounting/bank-accounts/${bankAccountId}`)
      await page.waitForTimeout(700)
      const crashed = await h.hasErrorBoundary(page)
      r.log('bank-reconciliation-detail-loads-no-crash', !crashed, crashed ? 'ErrorBoundary tripped' : '')
      const bodyText = await page.textContent('body')
      r.log('bank-reconciliation-documents-panel-visible', bodyText.includes('Documents'), 'expected "Documents" section heading from DocumentPanel')
    })

    // ── Chart of Accounts: create a custom account via UI ──────────────────
    await r.step('create-custom-account-via-ui', async () => {
      await h.gotoHash(page, '#/accounting/chart-of-accounts')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'New Account' }).click()
      await page.waitForTimeout(400)
      await page.getByLabel('Account Code').fill(coaCode)
      await page.getByLabel('Account Name').fill(`${TEST_PREFIX} Custom Account`)
      await page.locator('button', { hasText: 'Create' }).click()
      await page.waitForTimeout(800)
      r.log('coa-modal-closed-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('custom-account-persisted', () => h.withDb((db) => {
      const row = db.prepare('SELECT * FROM ChartOfAccounts WHERE accountCode = ?').get(coaCode)
      r.log('custom-account-row-exists', !!row, JSON.stringify(row))
      if (row) { createdCoaIds.push(row.id); r.log('custom-account-not-system', row.isSystem === 0) }
    }))

    // ── Manual Journal Entry: real dynamic line-builder UI ──────────────────
    await h.withDb((db) => {
      const row = db.prepare("SELECT id FROM ChartOfAccounts WHERE accountCode = '1000'").get()
      cashAccountId = row ? row.id : null
    })

    await r.step('post-manual-journal-entry-via-ui', async () => {
      await h.gotoHash(page, '#/accounting/journal-entries')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'New Entry' }).click()
      await page.waitForTimeout(400)
      // Scoped to the modal — the page also has an "All sources" filter
      // <select> above the modal in DOM order, so an unscoped
      // page.locator('select') picks that up as index 0 and throws off
      // every subsequent index.
      const modal = page.locator('div.fixed.inset-0.z-50')
      const selects = modal.locator('select')
      await selects.nth(0).selectOption({ label: '1000 — Cash & Bank' })
      await selects.nth(1).selectOption({ label: '3000 — Owner’s Capital' })
      const numberInputs = page.locator('input[type="number"]')
      await numberInputs.nth(0).fill('500') // line 1 debit
      await numberInputs.nth(3).fill('500') // line 2 credit (0=debit,1=credit per row, 2 rows -> idx 3 is row2 credit)
      await page.locator('button', { hasText: 'Post Entry' }).click()
      await page.waitForTimeout(800)
      r.log('journal-entry-modal-closed-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('manual-journal-entry-persisted-and-balanced', () => h.withDb((db) => {
      const je = db.prepare("SELECT * FROM JournalEntry WHERE sourceType = 'MANUAL' ORDER BY createdAt DESC LIMIT 1").get()
      r.log('manual-je-exists', !!je, JSON.stringify(je))
      if (je) {
        const lines = db.prepare('SELECT SUM(debitAmount) d, SUM(creditAmount) c FROM JournalEntryLine WHERE journalEntryId = ?').get(je.id)
        r.log('manual-je-balanced-500-each-side', lines.d === 500 && lines.c === 500, JSON.stringify(lines))
      }
    }))

    // ── Post-Dated Cheque, real UI form ─────────────────────────────────────
    await r.step('create-pdc-via-ui', async () => {
      await h.gotoHash(page, '#/accounting/post-dated-cheques')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'New Cheque' }).click()
      await page.waitForTimeout(400)
      await page.getByLabel('Bank Account').selectOption({ label: bankAccountName })
      await page.getByLabel('Cheque Number').fill(chequeNumber)
      const dueDateInput = page.locator('input[type="date"]').first()
      await dueDateInput.fill('2026-12-31')
      await page.getByLabel('Amount').fill('2500')
      await page.locator('button', { hasText: 'Create' }).click()
      await page.waitForTimeout(800)
      r.log('pdc-modal-closed-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('pdc-persisted-as-pending-no-je-yet', () => h.withDb((db) => {
      const row = db.prepare('SELECT * FROM PostDatedCheque WHERE chequeNumber = ?').get(chequeNumber)
      r.log('pdc-row-exists', !!row, JSON.stringify(row))
      if (row) {
        r.log('pdc-status-pending', row.status === 'PENDING')
        const je = db.prepare("SELECT * FROM JournalEntry WHERE sourceType = 'PDC_CLEARED' AND sourceId = ?").get(row.id)
        r.log('pdc-no-je-until-cleared', !je)
      }
    }))

    // ── Fixed Asset: create + navigate to detail + run depreciation ────────
    await r.step('create-fixed-asset-via-ui', async () => {
      await h.gotoHash(page, '#/accounting/fixed-assets')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'New Asset' }).click()
      await page.waitForTimeout(400)
      await page.getByLabel('Asset Code').fill(assetCode)
      await page.getByLabel('Asset Name').fill(`${TEST_PREFIX} Laptop`)
      await page.getByLabel('Purchase Cost').fill('60000')
      await page.getByLabel('Useful Life (months)').fill('36')
      await page.locator('button', { hasText: 'Create' }).click()
      await page.waitForTimeout(800)
      r.log('fixed-asset-modal-closed-no-crash', !(await h.hasErrorBoundary(page)))
    })

    let assetId = null
    await r.step('fixed-asset-persisted', () => h.withDb((db) => {
      const row = db.prepare('SELECT * FROM FixedAsset WHERE assetCode = ?').get(assetCode)
      r.log('fixed-asset-row-exists', !!row, JSON.stringify(row))
      if (row) { createdAssetIds.push(row.id); assetId = row.id }
    }))

    await r.step('run-depreciation-via-ui', async () => {
      if (!assetId) { r.log('skipped-no-asset-id', false); return }
      await h.gotoHash(page, `#/accounting/fixed-assets/${assetId}`)
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'Run Depreciation' }).click()
      await page.waitForTimeout(400)
      // The modal's own submit button is exactly "Run" — the page's
      // underlying "Run Depreciation" trigger button also matches a plain
      // substring locator (still present in the DOM behind the modal
      // overlay), so this needs an exact match, not hasText's substring default.
      await page.getByRole('button', { name: 'Run', exact: true }).click()
      await page.waitForTimeout(800)
      r.log('depreciation-modal-closed-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('depreciation-run-persisted-and-je-balanced', () => h.withDb((db) => {
      if (!assetId) { r.log('skipped-no-asset-id', false); return }
      const dep = db.prepare('SELECT * FROM FixedAssetDepreciation WHERE fixedAssetId = ?').get(assetId)
      r.log('depreciation-row-exists', !!dep, JSON.stringify(dep))
      // (60000 - 0) / 36 months = 1666.67/month; a ~1-month default period.
      if (dep) {
        r.log('depreciation-amount-plausible', dep.amount > 1000 && dep.amount < 2000, `amount=${dep.amount}`)
        const je = db.prepare("SELECT * FROM JournalEntry WHERE sourceType = 'ASSET_DEPRECIATION' AND sourceId = ?").get(dep.id)
        r.log('depreciation-je-posted', !!je)
        if (je) {
          const lines = db.prepare('SELECT SUM(debitAmount) d, SUM(creditAmount) c FROM JournalEntryLine WHERE journalEntryId = ?').get(je.id)
          r.log('depreciation-je-balanced', Math.abs(lines.d - lines.c) < 0.01, JSON.stringify(lines))
        }
        const updatedAsset = db.prepare('SELECT accumulatedDepreciation FROM FixedAsset WHERE id = ?').get(assetId)
        r.log('asset-accumulated-depreciation-updated', updatedAsset.accumulatedDepreciation === dep.amount, JSON.stringify(updatedAsset))
      }
    }))

    // ── Ledger Settings screen renders its two sections ─────────────────────
    await r.step('ledger-settings-shows-lock-and-year-end-sections', async () => {
      await h.gotoHash(page, '#/accounting/ledger-settings')
      await page.waitForTimeout(600)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('shows-transaction-lock-section', /Transaction Lock Date/i.test(bodyText))
      r.log('shows-year-end-close-section', /Year-End Close/i.test(bodyText))
    })

    // ── Journal Entry reverse ───────────────────────────────────────────────
    await r.step('reverse-manual-journal-entry-via-api', async () => {
      const je = h.withDb((db) => db.prepare("SELECT id FROM JournalEntry WHERE sourceType = 'MANUAL' ORDER BY createdAt DESC LIMIT 1").get())
      manualJeId = je?.id
      r.log('manual-je-found-for-reversal', !!manualJeId, JSON.stringify(je))
      if (!manualJeId) return
      const res = await page.evaluate((id) => window.api.journalEntries.reverse({ id, reason: 'E2E reversal test' }), manualJeId)
      r.log('journal-entry-reversed', !!res?.success, JSON.stringify(res?.error || ''))

      // The reversal keeps the SAME sourceType as the original ('MANUAL')
      // but its sourceId points at the ORIGINAL entry's own id (see
      // journal-entry.service.ts's reverseEntryTx) -- not a distinct
      // 'MANUAL_REVERSAL' sourceType.
      const reversalJe = h.withDb((db) => db.prepare("SELECT * FROM JournalEntry WHERE sourceType = 'MANUAL' AND sourceId = ?").get(manualJeId))
      r.log('reversal-je-exists', !!reversalJe, JSON.stringify(reversalJe))
      if (reversalJe) {
        const lines = h.withDb((db) => db.prepare('SELECT SUM(debitAmount) d, SUM(creditAmount) c FROM JournalEntryLine WHERE journalEntryId = ?').get(reversalJe.id))
        // A reversal flips debit<->credit from the original 500/500 entry --
        // still balanced, same amounts, opposite sides.
        r.log('reversal-je-balanced-and-mirrors-original', lines.d === 500 && lines.c === 500, JSON.stringify(lines))
      }

      const retry = await page.evaluate((id) => window.api.journalEntries.reverse({ id, reason: 'double reversal attempt' }), manualJeId)
      r.log('double-reversal-blocked', retry?.success === false, JSON.stringify(retry?.error))
    })

    // ── PDC clearing posts a JE; bounce does not ────────────────────────────
    await r.step('clear-pdc-posts-je-via-api', async () => {
      const pdc = h.withDb((db) => db.prepare('SELECT id FROM PostDatedCheque WHERE chequeNumber = ?').get(chequeNumber))
      pdcId = pdc?.id
      r.log('pdc-found-for-clearing', !!pdcId, JSON.stringify(pdc))
      if (!pdcId) return
      const res = await page.evaluate((id) => window.api.postDatedCheques.updateStatus({ id, status: 'CLEARED' }), pdcId)
      r.log('pdc-cleared', res?.data?.status === 'CLEARED', JSON.stringify(res?.error || ''))

      const je = h.withDb((db) => db.prepare("SELECT * FROM JournalEntry WHERE sourceType = 'PDC_CLEARED' AND sourceId = ?").get(pdcId))
      r.log('pdc-cleared-je-posted', !!je, JSON.stringify(je))
      if (je) {
        const lines = h.withDb((db) => db.prepare('SELECT SUM(debitAmount) d, SUM(creditAmount) c FROM JournalEntryLine WHERE journalEntryId = ?').get(je.id))
        r.log('pdc-cleared-je-balanced-2500', lines.d === 2500 && lines.c === 2500, JSON.stringify(lines))
      }
    })

    await r.step('bounce-a-second-pdc-no-je-posted', async () => {
      bouncedChequeNumber = `CHQB${suffix.toString().slice(-6)}`
      await h.gotoHash(page, '#/accounting/post-dated-cheques')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'New Cheque' }).click()
      await page.waitForTimeout(400)
      await page.getByLabel('Bank Account').selectOption({ label: bankAccountName })
      await page.getByLabel('Cheque Number').fill(bouncedChequeNumber)
      await page.locator('input[type="date"]').first().fill('2026-12-31')
      await page.getByLabel('Amount').fill('900')
      await page.locator('button', { hasText: 'Create' }).click()
      await page.waitForTimeout(800)
      r.log('second-pdc-created-no-crash', !(await h.hasErrorBoundary(page)))

      const pdc2 = h.withDb((db) => db.prepare('SELECT id FROM PostDatedCheque WHERE chequeNumber = ?').get(bouncedChequeNumber))
      if (!pdc2) return r.log('second-pdc-found', false)
      const res = await page.evaluate((id) => window.api.postDatedCheques.updateStatus({ id, status: 'BOUNCED', remarks: 'E2E bounce test' }), pdc2.id)
      r.log('pdc-bounced', res?.data?.status === 'BOUNCED', JSON.stringify(res?.error || ''))
      const je = h.withDb((db) => db.prepare("SELECT * FROM JournalEntry WHERE sourceType = 'PDC_CLEARED' AND sourceId = ?").get(pdc2.id))
      r.log('bounced-pdc-posts-no-clearing-je', !je, JSON.stringify(je))
    })

    // ── Fixed Asset dispose ──────────────────────────────────────────────────
    await r.step('dispose-fixed-asset-via-api', async () => {
      if (!assetId) return r.log('dispose-fixed-asset-via-api', false, 'no assetId captured')
      const res = await page.evaluate(({ id, today }) => window.api.fixedAssets.dispose({
        id, disposalDate: today, disposalAmount: 5000,
      }), { id: assetId, today: h.toLocalISODate(new Date()) })
      r.log('asset-disposed', !!res?.success, JSON.stringify(res?.error || ''))

      const row = h.withDb((db) => db.prepare('SELECT status, disposalAmount FROM FixedAsset WHERE id = ?').get(assetId))
      r.log('asset-status-disposed', row?.status === 'DISPOSED', JSON.stringify(row))
    })

    // ── Bank Reconciliation: real import + reconcile flow ───────────────────
    await r.step('bank-statement-import-and-reconcile-real-flow', async () => {
      if (!bankAccountId) return r.log('bank-statement-import-and-reconcile-real-flow', false, 'no bankAccountId captured')

      // A real matchable transaction: a supplier payment out of this bank account.
      const supRes = await page.evaluate((name) => window.api.suppliers.create({ supplierName: name }), `${TEST_PREFIX} Reconcile Vendor ${suffix}`)
      const supplierId = supRes?.data?.id
      if (supplierId) createdSupplierIds.push(supplierId)
      const billRes = await page.evaluate((supplierId) => window.api.bills.create({
        supplierId, items: [{ serviceDescription: 'E2E Reconcile bill', quantity: 1, unitCost: 1200, taxRate: 0 }]
      }), supplierId)
      if (billRes?.data?.id) createdBillIds.push(billRes.data.id)
      const payRes = await page.evaluate(({ billId, bankAccountId }) => window.api.supplierPayments.record({
        billId, paymentMethod: 'BANK_TRANSFER', amount: 1200, bankAccountId,
      }), { billId: billRes?.data?.id, bankAccountId })
      const supplierPaymentId = payRes?.data?.id
      r.log('reconcile-supplier-payment-created', !!supplierPaymentId, JSON.stringify(payRes?.error || ''))

      const today = h.toLocalISODate(new Date())
      const importRes = await page.evaluate(({ bankAccountId, today }) => window.api.bankStatement.import({
        bankAccountId, lines: [{ transactionDate: today, description: 'E2E Reconcile Vendor payment', debitAmount: 1200, creditAmount: 0 }],
      }), { bankAccountId, today })
      r.log('statement-lines-imported', !!importRes?.success, JSON.stringify(importRes?.error || ''))

      const autoMatchRes = await page.evaluate((bankAccountId) => window.api.bankStatement.autoMatch({ bankAccountId }), bankAccountId)
      r.log('automatch-runs-no-crash', !!autoMatchRes?.success, JSON.stringify(autoMatchRes?.error || ''))

      // autoMatch may have already reconciled this line by itself (an exact
      // single-candidate amount+date match is exactly what it's for) --
      // don't filter by reconciled state, just find our line either way.
      const listRes = await page.evaluate((bankAccountId) => window.api.bankStatement.list({ bankAccountId }), bankAccountId)
      const importedLine = (listRes?.data?.lines || []).find((l) => l.description === 'E2E Reconcile Vendor payment')
      r.log('imported-line-findable-via-api', !!importedLine, JSON.stringify(importedLine))

      if (importedLine && supplierPaymentId) {
        if (!importedLine.reconciled) {
          const reconRes = await page.evaluate(({ lineId, matchedId }) => window.api.bankStatement.reconcileLine({
            lineId, matchedType: 'SUPPLIER_PAYMENT', matchedId,
          }), { lineId: importedLine.id, matchedId: supplierPaymentId })
          r.log('line-reconciled', !!reconRes?.success, JSON.stringify(reconRes?.error || ''))
        } else {
          r.log('line-reconciled', true, 'already reconciled by autoMatch')
        }

        const summaryRes = await page.evaluate((bankAccountId) => window.api.bankStatement.summary({ bankAccountId }), bankAccountId)
        r.log('summary-shows-reconciled-count', (summaryRes?.data?.reconciledCount ?? 0) >= 1, JSON.stringify(summaryRes?.data))
      }
    })

    // ── Credit Interest: no legitimate app-level path to enable it (no UI,
    // no validation-schema field) -- flagged to the user as a possible real
    // product gap, not just a test gap. Enable directly via DB for this
    // test, same class of workaround the codebase's own comments use
    // elsewhere for pre-schema fields. ─────────────────────────────────────
    let overdueCustomerId
    await r.step('credit-interest-calculate-and-post', async () => {
      const custRes = await page.evaluate((name) => window.api.customers.create({ customerName: name, phone: `9${String(Date.now()).slice(-9)}`, creditLimit: 0, taxExempt: false, customerKind: 'INDIVIDUAL' }), `${TEST_PREFIX} Overdue Customer ${suffix}`)
      overdueCustomerId = custRes?.data?.id
      if (overdueCustomerId) createdCustomerIds.push(overdueCustomerId)
      const prodRes = await page.evaluate((name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 500, sellingPrice: 1000, taxRate: 0, openingQuantity: 10
      }), `${TEST_PREFIX} Overdue Product ${suffix}`)
      const overdueProductId = prodRes?.data?.id

      const overdueDate = h.toLocalISODate(new Date(Date.now() - 60 * 24 * 3600000))
      const invRes = await page.evaluate(({ customerId, productId, dueDate }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CREDIT', dueDate,
        items: [{ productId, quantity: 1, unitPrice: 1000, taxRate: 0 }],
      }), { customerId: overdueCustomerId, productId: overdueProductId, dueDate: overdueDate })
      if (invRes?.data?.id) createdInvoiceIds.push(invRes.data.id)
      r.log('overdue-invoice-created', !!invRes?.success, JSON.stringify(invRes?.error || ''))

      const blockedCalc = await page.evaluate((customerId) => window.api.creditInterest.calculate({ customerId }), overdueCustomerId)
      r.log('calculate-blocked-CI-001-when-disabled', blockedCalc?.success === false && blockedCalc?.error?.code === 'CI-001', JSON.stringify(blockedCalc?.error))

      h.withDb((db) => db.prepare("UPDATE BusinessProfile SET creditInterestEnabled = 1, creditInterestRatePercent = 18, creditInterestType = 'SIMPLE'").run())

      const calcRes = await page.evaluate((customerId) => window.api.creditInterest.calculate({ customerId }), overdueCustomerId)
      const line = (calcRes?.data?.lines || [])[0]
      // 1000 balance, 60 days overdue, 18% annual, SIMPLE = 1000*0.18*(60/365) ~= 29.59
      r.log('calculate-shows-plausible-interest', !!line && line.interest > 25 && line.interest < 35, JSON.stringify(calcRes?.data))

      const postRes = await page.evaluate((customerId) => window.api.creditInterest.post({ customerId }), overdueCustomerId)
      r.log('interest-posted', !!postRes?.success, JSON.stringify(postRes?.error || ''))

      const ledgerRes = await page.evaluate((id) => window.api.customers.getLedger ? window.api.customers.getLedger(id) : null, overdueCustomerId)
      void ledgerRes
      h.withDb((db) => db.prepare('UPDATE BusinessProfile SET creditInterestEnabled = 0, creditInterestRatePercent = 0').run())
    })

    // ── Transaction Locking: set a real lock date, verify enforcement, then
    // ALWAYS clear it -- a lingering lock would block the user's own future
    // work in this shared dev DB. ───────────────────────────────────────────
    await r.step('transaction-lock-enforcement', async () => {
      const lockDate = h.toLocalISODate(new Date(Date.now() - 2 * 24 * 3600000))
      const setRes = await page.evaluate((lockDate) => window.api.transactionLock.setLockDate({ lockDate }), lockDate)
      r.log('lock-date-set', !!setRes?.success, JSON.stringify(setRes?.error || ''))

      const getRes = await page.evaluate(async () => window.api.transactionLock.getLockDate())
      r.log('lock-date-readable', !!getRes?.data, JSON.stringify(getRes?.data))

      const catRes = await page.evaluate(() => window.api.expenses.listCategories())
      const categoryId = catRes?.data?.[0]?.id
      const beforeLockDate = h.toLocalISODate(new Date(Date.now() - 5 * 24 * 3600000))
      const blockedExp = await page.evaluate(({ categoryId, expenseDate }) => window.api.expenses.create({
        categoryId, expenseName: 'E2E Ledger Locked Expense', amount: 100, expenseDate,
      }), { categoryId, expenseDate: beforeLockDate })
      r.log('expense-before-lock-date-blocked-LOCK-001', blockedExp?.success === false && blockedExp?.error?.code === 'LOCK-001', JSON.stringify(blockedExp?.error))

      const todayExp = await page.evaluate(({ categoryId, expenseDate }) => window.api.expenses.create({
        categoryId, expenseName: 'E2E Ledger Unlocked Expense', amount: 100, expenseDate,
      }), { categoryId, expenseDate: h.toLocalISODate(new Date()) })
      r.log('expense-after-lock-date-succeeds', !!todayExp?.success, JSON.stringify(todayExp?.error || ''))

      const clearRes = await page.evaluate(() => window.api.transactionLock.setLockDate({ lockDate: null }))
      r.log('lock-date-cleared', !!clearRes?.success, JSON.stringify(clearRes?.error || ''))
    })

    // ── Cheque Books ─────────────────────────────────────────────────────────
    await r.step('cheque-book-create-list-next-number-set-active', async () => {
      if (!bankAccountId) return r.log('cheque-book-create-list-next-number-set-active', false, 'no bankAccountId captured')
      const cbRes = await page.evaluate((bankAccountId) => window.api.chequeBooks.create({
        bankAccountId, startNumber: 100001, endNumber: 100050,
      }), bankAccountId)
      const chequeBookId = cbRes?.data?.id
      if (chequeBookId) createdChequeBookIds.push(chequeBookId)
      r.log('cheque-book-created', !!chequeBookId, JSON.stringify(cbRes?.error || ''))

      const listRes = await page.evaluate((bankAccountId) => window.api.chequeBooks.list(bankAccountId), bankAccountId)
      const found = (listRes?.data || []).find((cb) => cb.id === chequeBookId)
      r.log('cheque-book-findable-via-list', !!found, JSON.stringify(found))

      const nextRes = await page.evaluate((bankAccountId) => window.api.chequeBooks.getNextNumber(bankAccountId), bankAccountId)
      r.log('next-cheque-number-is-100001', nextRes?.data?.chequeNumber === '100001', JSON.stringify(nextRes?.data))

      if (chequeBookId) {
        const activeRes = await page.evaluate((id) => window.api.chequeBooks.setActive({ id, isActive: true }), chequeBookId)
        r.log('cheque-book-set-active', !!activeRes?.success, JSON.stringify(activeRes?.error || ''))
      }
    })

    // ── Reverse Charge Mechanism (Bill + Expense) ───────────────────────────
    await r.step('reverse-charge-bill-and-expense', async () => {
      const supRes = await page.evaluate((name) => window.api.suppliers.create({ supplierName: name }), `${TEST_PREFIX} RCM Vendor ${suffix}`)
      const supplierId = supRes?.data?.id
      if (supplierId) createdSupplierIds.push(supplierId)

      const rcmBillRes = await page.evaluate((supplierId) => window.api.bills.create({
        supplierId, isReverseCharge: true, items: [{ serviceDescription: 'E2E RCM legal services', quantity: 1, unitCost: 1000, taxRate: 18 }],
      }), supplierId)
      if (rcmBillRes?.data?.id) createdBillIds.push(rcmBillRes.data.id)
      r.log('reverse-charge-bill-created', !!rcmBillRes?.success, JSON.stringify(rcmBillRes?.error || ''))
      r.log('reverse-charge-bill-flag-persisted', rcmBillRes?.data?.isReverseCharge === true, JSON.stringify(rcmBillRes?.data?.isReverseCharge))
      // Buyer self-assesses the tax under RCM -- taxAmount is still computed
      // (180 = 18% of 1000) even though the vendor never collected it.
      r.log('reverse-charge-bill-tax-still-computed-180', Math.abs((rcmBillRes?.data?.taxAmount ?? -1) - 180) < 0.01, JSON.stringify(rcmBillRes?.data?.taxAmount))

      const catRes = await page.evaluate(() => window.api.expenses.listCategories())
      const categoryId = catRes?.data?.[0]?.id
      const rcmExpRes = await page.evaluate(({ categoryId, today }) => window.api.expenses.create({
        categoryId, expenseName: 'E2E Ledger RCM Expense', amount: 500, expenseDate: today, isReverseCharge: true,
      }), { categoryId, today: h.toLocalISODate(new Date()) })
      r.log('reverse-charge-expense-flag-persisted', rcmExpRes?.data?.isReverseCharge === true, JSON.stringify(rcmExpRes?.data?.isReverseCharge || rcmExpRes?.error))
    })

    // ── Composition Scheme: forces 0% tax + "Bill of Supply" ────────────────
    await r.step('composition-scheme-forces-zero-tax-invoice', async () => {
      const before = h.withDb((db) => db.prepare('SELECT gstScheme FROM BusinessProfile LIMIT 1').get())
      const updRes = await page.evaluate(async () => window.api.businessProfile.update({ gstScheme: 'COMPOSITION' }))
      r.log('gst-scheme-set-to-composition', !!updRes?.success, JSON.stringify(updRes?.error || ''))

      const custRes = await page.evaluate((name) => window.api.customers.create({ customerName: name, phone: `9${String(Date.now()).slice(-9)}`, creditLimit: 0, taxExempt: false, customerKind: 'INDIVIDUAL' }), `${TEST_PREFIX} Composition Customer ${suffix}`)
      if (custRes?.data?.id) createdCustomerIds.push(custRes.data.id)
      const prodRes = await page.evaluate((name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 100, sellingPrice: 200, taxRate: 18, openingQuantity: 5
      }), `${TEST_PREFIX} Composition Product ${suffix}`)

      const invRes = await page.evaluate(({ customerId, productId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CASH', items: [{ productId, quantity: 1, unitPrice: 200, taxRate: 18 }],
      }), { customerId: custRes?.data?.id, productId: prodRes?.data?.id })
      if (invRes?.data?.id) createdInvoiceIds.push(invRes.data.id)
      // Line taxRate sent was 18%, but a composition-scheme business forces
      // 0% regardless -- proves the override, not just that 0% was sent.
      r.log('composition-invoice-tax-forced-to-zero', (invRes?.data?.taxAmount ?? -1) === 0, JSON.stringify(invRes?.data?.taxAmount))
      r.log('composition-invoice-total-equals-taxable-200', Math.abs((invRes?.data?.totalAmount ?? -1) - 200) < 0.01, JSON.stringify(invRes?.data?.totalAmount))

      // Restore the business's real GST scheme -- must not leave the shared
      // dev DB's every future invoice forced to 0% tax.
      await page.evaluate((scheme) => window.api.businessProfile.update({ gstScheme: scheme }), before?.gstScheme || 'REGULAR')
    })

    // ── TDS suggest + deduct on a supplier payment ──────────────────────────
    await r.step('tds-suggest-and-deduct-on-supplier-payment', async () => {
      const suggestRes = await page.evaluate(async () => window.api.supplierPayments.suggestTds({ amount: 50000 }))
      r.log('tds-suggested-applicable-above-threshold', suggestRes?.data?.applicable === true && suggestRes?.data?.suggestedAmount === 5000, JSON.stringify(suggestRes?.data))

      const supRes = await page.evaluate((name) => window.api.suppliers.create({ supplierName: name }), `${TEST_PREFIX} TDS Vendor ${suffix}`)
      const supplierId = supRes?.data?.id
      if (supplierId) createdSupplierIds.push(supplierId)
      const billRes = await page.evaluate((supplierId) => window.api.bills.create({
        supplierId, items: [{ serviceDescription: 'E2E TDS professional fee', quantity: 1, unitCost: 50000, taxRate: 0 }],
      }), supplierId)
      if (billRes?.data?.id) createdBillIds.push(billRes.data.id)

      const payRes = await page.evaluate((billId) => window.api.supplierPayments.record({
        billId, paymentMethod: 'BANK_TRANSFER', amount: 50000, tdsAmount: 5000, tdsSection: '194J',
      }), billRes?.data?.id)
      r.log('tds-payment-recorded', !!payRes?.success, JSON.stringify(payRes?.error || ''))

      const billAfter = await page.evaluate((id) => window.api.bills.get(id), billRes?.data?.id)
      // Full 50000 bill is settled by a 50000 payment even though only
      // 45000 net cash moved -- the other 5000 was deducted as TDS, not paid.
      r.log('bill-fully-paid-despite-tds-deduction', billAfter?.data?.status === 'PAID', JSON.stringify(billAfter?.data?.status))
    })

    // ── MSME 45-day due-date auto-default ───────────────────────────────────
    await r.step('msme-supplier-bill-gets-45-day-due-date-by-default', async () => {
      const supRes = await page.evaluate((name) => window.api.suppliers.create({
        supplierName: name, isMsmeRegistered: true, msmeCategory: 'MICRO',
      }), `${TEST_PREFIX} MSME Vendor ${suffix}`)
      const supplierId = supRes?.data?.id
      if (supplierId) createdSupplierIds.push(supplierId)
      r.log('msme-supplier-created', supRes?.data?.isMsmeRegistered === true, JSON.stringify(supRes?.error || ''))

      const billDate = h.toLocalISODate(new Date())
      const billRes = await page.evaluate(({ supplierId, billDate }) => window.api.bills.create({
        supplierId, billDate, items: [{ serviceDescription: 'E2E MSME test line', quantity: 1, unitCost: 1000, taxRate: 0 }],
      }), { supplierId, billDate })
      if (billRes?.data?.id) createdBillIds.push(billRes.data.id)

      // dueDate comes back as a raw epoch-ms number over IPC (no ISO-string
      // serializer on this field), not a string -- format via Date first.
      const expectedDueDate = h.toLocalISODate(new Date(Date.now() + 45 * 24 * 3600000))
      const actualDueDate = billRes?.data?.dueDate ? h.toLocalISODate(new Date(billRes.data.dueDate)) : null
      r.log('msme-bill-due-date-auto-defaults-to-45-days', actualDueDate === expectedDueDate, `expected=${expectedDueDate} actual=${actualDueDate}`)

      // A non-MSME supplier's bill must NOT get this auto-default.
      const nonMsmeSupRes = await page.evaluate((name) => window.api.suppliers.create({ supplierName: name }), `${TEST_PREFIX} Non-MSME Vendor ${suffix}`)
      const nonMsmeSupplierId = nonMsmeSupRes?.data?.id
      if (nonMsmeSupplierId) createdSupplierIds.push(nonMsmeSupplierId)
      const nonMsmeBillRes = await page.evaluate(({ supplierId, billDate }) => window.api.bills.create({
        supplierId, billDate, items: [{ serviceDescription: 'E2E non-MSME test line', quantity: 1, unitCost: 1000, taxRate: 0 }],
      }), { supplierId: nonMsmeSupplierId, billDate })
      if (nonMsmeBillRes?.data?.id) createdBillIds.push(nonMsmeBillRes.data.id)
      r.log('non-msme-bill-has-no-auto-due-date', !nonMsmeBillRes?.data?.dueDate, JSON.stringify(nonMsmeBillRes?.data?.dueDate))
    })
  } finally {
    // Safety nets -- must never leave the shared dev DB locked or with
    // credit interest silently enabled for every future invoice, even if an
    // earlier step threw before reaching its own inline cleanup.
    h.withDb((db) => {
      db.prepare('UPDATE BusinessProfile SET lockDate = NULL').run()
      db.prepare("UPDATE BusinessProfile SET creditInterestEnabled = 0, creditInterestRatePercent = 0, gstScheme = 'REGULAR'").run()
    })

    // Phase 62 tables aren't covered by h.cleanupByNamePrefix — clean up
    // directly, same pattern suite 62's own "extra cleanup" block uses.
    const cleanup = h.withDb((db) => {
      let jeLines = 0, jes = 0, deps = 0, assets = 0, pdcs = 0, banks = 0, coas = 0
      let payments = 0, bills = 0, billItems = 0, invoices = 0, invoiceItems = 0, chequeBooks = 0, customers = 0, suppliers = 0

      // Gap-closure additions (2026-08-27), deleted first in FK order.
      const deleteJeBySource = (sourceType, sourceId) => {
        const je = db.prepare('SELECT id FROM JournalEntry WHERE sourceType = ? AND sourceId = ?').get(sourceType, sourceId)
        if (je) { jeLines += db.prepare('DELETE FROM JournalEntryLine WHERE journalEntryId = ?').run(je.id).changes; jes += db.prepare('DELETE FROM JournalEntry WHERE id = ?').run(je.id).changes }
      }
      if (manualJeId) deleteJeBySource('MANUAL', manualJeId)
      if (pdcId) deleteJeBySource('PDC_CLEARED', pdcId)
      for (const cid of createdCustomerIds) deleteJeBySource('INTEREST_CHARGE', cid)

      if (bouncedChequeNumber) pdcs += db.prepare('DELETE FROM PostDatedCheque WHERE chequeNumber = ?').run(bouncedChequeNumber).changes
      for (const cbId of createdChequeBookIds) chequeBooks += db.prepare('DELETE FROM ChequeBook WHERE id = ?').run(cbId).changes

      for (const billId of createdBillIds) {
        payments += db.prepare('DELETE FROM SupplierPayment WHERE billId = ?').run(billId).changes
        billItems += db.prepare('DELETE FROM BillItem WHERE billId = ?').run(billId).changes
        try { bills += db.prepare('DELETE FROM Bill WHERE id = ?').run(billId).changes } catch { /* left as VOID if still referenced */ }
      }
      for (const invId of createdInvoiceIds) {
        invoiceItems += db.prepare('DELETE FROM InvoiceItem WHERE invoiceId = ?').run(invId).changes
        try { invoices += db.prepare('DELETE FROM Invoice WHERE id = ?').run(invId).changes } catch { /* left in place if still referenced */ }
      }
      if (bankAccountId) db.prepare('DELETE FROM BankStatementLine WHERE bankAccountId = ?').run(bankAccountId)
      for (const supplierId of createdSupplierIds) {
        db.prepare('DELETE FROM SupplierLedger WHERE supplierId = ?').run(supplierId)
        try { suppliers += db.prepare('DELETE FROM Supplier WHERE id = ?').run(supplierId).changes } catch { db.prepare('UPDATE Supplier SET isActive = 0 WHERE id = ?').run(supplierId) }
      }
      for (const customerId of createdCustomerIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(customerId)
        try { customers += db.prepare('DELETE FROM Customer WHERE id = ?').run(customerId).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(customerId) }
      }

      for (const assetId of createdAssetIds) {
        const deprows = db.prepare('SELECT id FROM FixedAssetDepreciation WHERE fixedAssetId = ?').all(assetId)
        for (const d of deprows) {
          const je = db.prepare("SELECT id FROM JournalEntry WHERE sourceType = 'ASSET_DEPRECIATION' AND sourceId = ?").get(d.id)
          if (je) { jeLines += db.prepare('DELETE FROM JournalEntryLine WHERE journalEntryId = ?').run(je.id).changes; jes += db.prepare('DELETE FROM JournalEntry WHERE id = ?').run(je.id).changes }
        }
        deps += db.prepare('DELETE FROM FixedAssetDepreciation WHERE fixedAssetId = ?').run(assetId).changes
        const disposeJe = db.prepare("SELECT id FROM JournalEntry WHERE sourceType = 'ASSET_DISPOSAL' AND sourceId = ?").get(assetId)
        if (disposeJe) { jeLines += db.prepare('DELETE FROM JournalEntryLine WHERE journalEntryId = ?').run(disposeJe.id).changes; jes += db.prepare('DELETE FROM JournalEntry WHERE id = ?').run(disposeJe.id).changes }
        assets += db.prepare('DELETE FROM FixedAsset WHERE id = ?').run(assetId).changes
      }
      pdcs += db.prepare('DELETE FROM PostDatedCheque WHERE chequeNumber = ?').run(chequeNumber).changes
      for (const bankAccountId of createdBankAccountIds) {
        const je = db.prepare("SELECT id FROM JournalEntry WHERE sourceType = 'BANK_ACCOUNT_OPENING' AND sourceId = ?").get(bankAccountId)
        if (je) { jeLines += db.prepare('DELETE FROM JournalEntryLine WHERE journalEntryId = ?').run(je.id).changes; jes += db.prepare('DELETE FROM JournalEntry WHERE id = ?').run(je.id).changes }
        banks += db.prepare('DELETE FROM BankAccount WHERE id = ?').run(bankAccountId).changes
      }
      // Any remaining MANUAL entries + their lines posted by this suite (matched by the two accounts used).
      const staleManual = db.prepare("SELECT id FROM JournalEntry WHERE sourceType = 'MANUAL'").all()
      for (const m of staleManual) {
        const hasCoaLine = createdCoaIds.length ? db.prepare(`SELECT 1 FROM JournalEntryLine WHERE journalEntryId = ? AND accountId IN (${createdCoaIds.map(() => '?').join(',')})`).get(m.id, ...createdCoaIds) : null
        if (hasCoaLine || (cashAccountId && db.prepare('SELECT 1 FROM JournalEntryLine WHERE journalEntryId = ? AND accountId = ?').get(m.id, cashAccountId))) {
          jeLines += db.prepare('DELETE FROM JournalEntryLine WHERE journalEntryId = ?').run(m.id).changes
          jes += db.prepare('DELETE FROM JournalEntry WHERE id = ?').run(m.id).changes
        }
      }
      for (const coaId of createdCoaIds) {
        coas += db.prepare('DELETE FROM ChartOfAccounts WHERE id = ?').run(coaId).changes
      }
      return { jeLines, jes, deps, assets, pdcs, banks, coas, payments, bills, billItems, invoices, invoiceItems, chequeBooks, customers, suppliers }
    })
    console.log('extra cleanup (Phase 62 accounting tables):', JSON.stringify(cleanup))
    await h.closeApp(app)
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nACCOUNTING & LEDGER UI (PHASE 62): ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
