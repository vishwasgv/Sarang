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
  // Declared here (not inside try{}) — a const declared inside try{} is
  // block-scoped to that block alone and is NOT visible from finally{},
  // a real bug caught live when this suite's own cleanup block threw
  // "chequeNumber is not defined" on its first run.
  const bankAccountName = `${TEST_PREFIX} Bank ${suffix}`
  const coaCode = `TEST${suffix.toString().slice(-6)}`
  const chequeNumber = `CHQ${suffix.toString().slice(-6)}`
  const assetCode = `FA-E2E-${suffix.toString().slice(-6)}`
  let cashAccountId = null

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

    let bankAccountId = null
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
  } finally {
    // Phase 62 tables aren't covered by h.cleanupByNamePrefix — clean up
    // directly, same pattern suite 62's own "extra cleanup" block uses.
    const cleanup = h.withDb((db) => {
      let jeLines = 0, jes = 0, deps = 0, assets = 0, pdcs = 0, banks = 0, coas = 0
      for (const assetId of createdAssetIds) {
        const deprows = db.prepare('SELECT id FROM FixedAssetDepreciation WHERE fixedAssetId = ?').all(assetId)
        for (const d of deprows) {
          const je = db.prepare("SELECT id FROM JournalEntry WHERE sourceType = 'ASSET_DEPRECIATION' AND sourceId = ?").get(d.id)
          if (je) { jeLines += db.prepare('DELETE FROM JournalEntryLine WHERE journalEntryId = ?').run(je.id).changes; jes += db.prepare('DELETE FROM JournalEntry WHERE id = ?').run(je.id).changes }
        }
        deps += db.prepare('DELETE FROM FixedAssetDepreciation WHERE fixedAssetId = ?').run(assetId).changes
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
      return { jeLines, jes, deps, assets, pdcs, banks, coas }
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
