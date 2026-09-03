/**
 * Suite 157 — Low-priority batch 1: auth.changePassword, loyaltyProgram.redeem,
 * recall.upsert, roles.updatePermissions, print.kot, print.listPrinters,
 * import.validatePreview/getFields, app.handler.ts first-run/settings toggles.
 *
 * Deliberately NOT attempted anywhere in this suite (genuinely un-automatable,
 * not just untested) -- all open a real native OS dialog Playwright cannot
 * drive, or in tutorial.exit's case call app.exit(0) mid-process:
 *   dialog:openFile, documents.pick/open, print:invoice, print:receipt
 *   (both hardcode silent:false, unlike print:kot/print:labels),
 *   export.toCsv/toExcel/toPdf (dialog.showSaveDialog -- already documented
 *   as a known gap in suite 12's own header + docs/RELEASE_CHECKLIST.md),
 *   import.parseFile/downloadTemplate (dialog.showOpenDialog/showSaveDialog),
 *   tutorial.exit (calls app.exit(0) to relaunch the whole process -- already
 *   verified via manual click-through per project memory, not a fit for this
 *   harness's per-suite Playwright-driven lifecycle).
 * auth.getPermissions is exercised on every single login this whole session
 * (App.tsx/LoginScreen.tsx) -- a false positive, not a real gap, not re-tested
 * here by name.
 */
const h = require('../harness')
const { createTestProduct } = require('../fixtures/seed')

const TEST_PREFIX = 'E2E157'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('app-first-run-and-settings-toggles-via-api', async () => {
      const disc1 = await page.evaluate(async () => window.api.app.acknowledgeDisclaimer())
      r.log('acknowledge-disclaimer', !!disc1?.success, JSON.stringify(disc1?.error || ''))
      const disc2 = await page.evaluate(async () => window.api.app.isDisclaimerAccepted())
      r.log('disclaimer-actually-accepted', disc2?.data === true, JSON.stringify(disc2))

      const bp1 = await page.evaluate(async () => window.api.app.dismissBackupPrompt())
      r.log('dismiss-backup-prompt', !!bp1?.success, JSON.stringify(bp1?.error || ''))
      const bp2 = await page.evaluate(async () => window.api.app.isBackupPromptDismissed())
      r.log('backup-prompt-actually-dismissed', bp2?.data === true, JSON.stringify(bp2))

      const tp1 = await page.evaluate(async () => window.api.app.dismissTutorialPrompt())
      r.log('dismiss-tutorial-prompt', !!tp1?.success, JSON.stringify(tp1?.error || ''))
      const tp2 = await page.evaluate(async () => window.api.app.isTutorialPromptDismissed())
      r.log('tutorial-prompt-actually-dismissed', tp2?.data === true, JSON.stringify(tp2))

      const au1 = await page.evaluate(async () => window.api.app.setAutoUpdateCheckEnabled({ enabled: false }))
      r.log('set-auto-update-check', !!au1?.success, JSON.stringify(au1?.error || ''))
      const au2 = await page.evaluate(async () => window.api.app.isAutoUpdateCheckEnabled())
      r.log('auto-update-check-actually-set', au2?.data === false, JSON.stringify(au2))
      await page.evaluate(async () => window.api.app.setAutoUpdateCheckEnabled({ enabled: true }))

      const paths = await page.evaluate(async () => window.api.app.getPaths())
      r.log('get-paths-returns-real-data', !!paths?.data?.userData, JSON.stringify(paths?.data))
      const platform = await page.evaluate(async () => window.api.app.getPlatform())
      r.log('get-platform-returns-real-data', typeof platform?.data === 'string' && platform.data.length > 0, JSON.stringify(platform))

      const logo = await page.evaluate(async () => window.api.app.getBusinessLogoDataUri())
      r.log('get-business-logo-data-uri-no-crash', logo?.success === true, JSON.stringify(logo?.error || ''))
    })

    let printerListRes
    await r.step('list-printers-via-api', async () => {
      printerListRes = await page.evaluate(async () => window.api.print.listPrinters())
      r.log('list-printers-succeeds', !!printerListRes?.success, JSON.stringify(printerListRes?.error || ''))
    })

    await r.step('print-kot-via-real-ui', async () => {
      const sw = await h.switchBusinessType(page, 'Restaurant')
      r.log('business-type-switched', sw.to === 'RESTAURANT', JSON.stringify(sw))

      const tableRes = await page.evaluate(async (prefix) => window.api.restaurant.createTable({
        tableNumber: `${prefix}-T1`, tableName: `${prefix} Table 1`,
      }), TEST_PREFIX)
      const tableId = tableRes?.data?.id

      const prodRes = await createTestProduct(page, { productName: `${TEST_PREFIX} Fried Rice ${suffix}`, sellingPrice: 90, costPrice: 30, taxRate: 5 })
      const productId = prodRes?.data?.id

      const invRes = await page.evaluate(async (pid) => window.api.billing.createInvoice({
        paymentMethod: 'CASH', items: [{ productId: pid, quantity: 1, unitPrice: 90, taxRate: 5 }],
      }), productId)
      const invoiceId = invRes?.data?.id

      const kotRes = await page.evaluate(({ invId, tblId }) => window.api.restaurant.createKOT({ invoiceId: invId, tableId: tblId }), { invId: invoiceId, tblId: tableId })
      const kotId = kotRes?.data?.id
      r.log('kot-created', !!kotId, JSON.stringify(kotRes?.error || ''))

      await h.gotoHash(page, '#/restaurant/kot')
      await page.waitForTimeout(700)
      r.log('kot-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const printBtn = page.locator('button[title="Print kitchen ticket"]').first()
      r.log('print-button-present', await printBtn.count() > 0)
      await printBtn.click()
      await page.waitForTimeout(900)
      // silent:true means no OS dialog either way (unlike print:invoice/
      // print:receipt), so this click is safe to fire for real. Whether the
      // OS actually has a printer installed is environmental and out of
      // scope -- no-crash-after-click is what proves the channel is wired.
      r.log('print-kot-no-crash', !(await h.hasErrorBoundary(page)))

      await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), 'MANUFACTURING')
    })

    let custId
    await r.step('redeem-loyalty-reward-via-real-ui', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Loyalty Customer ${suffix}`)
      custId = custRes?.data?.id

      await page.evaluate(async (rewardDescription) => window.api.loyaltyProgram.upsert({
        isActive: true, punchesRequired: 1, rewardDescription, minPurchaseAmount: 0,
      }), `${TEST_PREFIX} Free Item`)

      // loyaltyProgram.isActive alone doesn't make createInvoice record a
      // punch -- billing.service.ts separately gates recordPunchTx on the
      // loyalty_program TemplateModule flag. Backend-only gate (isModuleEnabled
      // reads fresh from DB each call), so a raw API update is safe here --
      // unlike the frontend-gated barcode buttons in suite 154.
      const tplRes = await page.evaluate(async () => window.api.industry.getTemplate())
      const currentModules = tplRes?.data?.enabledModules || []
      if (!currentModules.includes('loyalty_program')) {
        await page.evaluate(async (mods) => window.api.industry.updateModules({ modules: mods }), [...currentModules, 'loyalty_program'])
      }

      const prodRes = await createTestProduct(page, { productName: `${TEST_PREFIX} Loyalty Widget ${suffix}`, sellingPrice: 100, costPrice: 50, taxRate: 0 })
      const prodId = prodRes?.data?.id
      const invRes = await page.evaluate(({ pid, cid }) => window.api.billing.createInvoice({
        customerId: cid, paymentMethod: 'CASH', items: [{ productId: pid, quantity: 1, unitPrice: 100, taxRate: 0 }],
      }), { pid: prodId, cid: custId })
      r.log('qualifying-invoice-created', !!invRes?.data?.id, JSON.stringify(invRes?.error || ''))

      await h.gotoHash(page, '#/pricing/loyalty')
      await page.waitForTimeout(700)
      r.log('loyalty-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const row = page.locator('tr', { hasText: `${TEST_PREFIX} Loyalty Customer` }).first()
      r.log('customer-ready-for-reward', await row.getByText('Redeem').count() > 0)
      await row.getByText('Redeem').click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByRole('button', { name: 'Redeem', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('redeem-no-crash', !(await h.hasErrorBoundary(page)))

      const cardsRes = await page.evaluate(async () => window.api.loyaltyProgram.listCards())
      const card = (cardsRes?.data?.rows || []).find((c) => c.customerId === custId)
      r.log('reward-actually-redeemed', card?.totalRewardsRedeemed === 1 && card?.currentPunches === 0, JSON.stringify(card))

      if (!currentModules.includes('loyalty_program')) {
        await page.evaluate(async (mods) => window.api.industry.updateModules({ modules: mods }), currentModules)
      }
    })

    let patientId
    await r.step('save-recall-record-via-real-ui', async () => {
      const sw = await h.switchBusinessType(page, 'Dental Clinic')
      r.log('business-type-switched-dental', sw.to === 'DENTAL_CLINIC', JSON.stringify(sw))

      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Dental Patient ${suffix}`)
      patientId = custRes?.data?.id

      await h.gotoHash(page, `#/dental/patient/${patientId}`)
      await page.waitForTimeout(700)
      r.log('dental-patient-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: /Recall/ }).click()
      await page.waitForTimeout(400)

      const dateInputs = page.locator('input[type="date"]')
      await dateInputs.nth(0).fill(h.toLocalISODate(new Date()))
      await dateInputs.nth(1).fill(h.toLocalISODate(new Date(Date.now() + 180 * 24 * 3600000)))
      await page.waitForTimeout(200)
      await page.getByRole('button', { name: 'Set Recall Date' }).click()
      await page.waitForTimeout(1000)
      r.log('recall-save-no-crash', !(await h.hasErrorBoundary(page)))

      const getRes = await page.evaluate((pid) => window.api.recall.get({ patientId: pid }), patientId)
      r.log('recall-actually-saved', !!getRes?.data?.id && getRes?.data?.recallType === 'HYGIENE_6M', JSON.stringify(getRes?.data))

      const listRes = await page.evaluate(async () => window.api.recall.list())
      r.log('recall-appears-in-list', (listRes?.data || []).some((rec) => rec.patientId === patientId), JSON.stringify(listRes?.data?.length))
    })

    await r.step('update-role-permissions-via-api', async () => {
      const rolesRes = await page.evaluate(async () => window.api.roles.list())
      const nonAdminRole = (rolesRes?.data || []).find((role) => role.roleName !== 'Admin')
      r.log('non-admin-role-found', !!nonAdminRole, JSON.stringify(nonAdminRole?.roleName))
      if (!nonAdminRole) return

      const permsRes = await page.evaluate(async () => window.api.roles.getPermissions())
      const somePerm = (permsRes?.data || [])[0]
      r.log('permissions-list-non-empty', !!somePerm, JSON.stringify(permsRes?.data?.length))
      if (!somePerm) return

      const originalPermIds = (nonAdminRole.rolePermissions || []).map((rp) => rp.permissionId ?? rp.permission?.id).filter(Boolean)
      const newPermIds = [...new Set([...originalPermIds, somePerm.id])]

      const updRes = await page.evaluate(({ roleId, permissionIds }) => window.api.roles.updatePermissions({ roleId, permissionIds }), { roleId: nonAdminRole.id, permissionIds: newPermIds })
      r.log('update-permissions-succeeds', !!updRes?.success, JSON.stringify(updRes?.error || ''))

      const afterRes = await page.evaluate(async () => window.api.roles.list())
      const afterRole = (afterRes?.data || []).find((role) => role.id === nonAdminRole.id)
      const afterPermIds = (afterRole?.rolePermissions || []).map((rp) => rp.permissionId ?? rp.permission?.id)
      r.log('permission-actually-added', afterPermIds.includes(somePerm.id), JSON.stringify(afterPermIds?.length))

      // restore original permission set
      await page.evaluate(({ roleId, permissionIds }) => window.api.roles.updatePermissions({ roleId, permissionIds }), { roleId: nonAdminRole.id, permissionIds: originalPermIds })

      const adminRole = (rolesRes?.data || []).find((role) => role.roleName === 'Admin')
      if (adminRole) {
        const blockRes = await page.evaluate(({ roleId }) => window.api.roles.updatePermissions({ roleId, permissionIds: [] }), { roleId: adminRole.id })
        r.log('admin-role-permissions-immutable', blockRes?.success === false && blockRes?.error?.code === 'PERM-002', JSON.stringify(blockRes?.error))
      }
    })

    let sessionId
    await r.step('import-validate-preview-and-get-fields-via-api', async () => {
      const fieldsRes = await page.evaluate(async () => window.api.import.getFields({ module: 'products' }))
      r.log('get-fields-succeeds', !!fieldsRes?.success && Array.isArray(fieldsRes?.data), JSON.stringify(fieldsRes?.data?.length))

      const csvPath = require('path').join(require('os').tmpdir(), `e2e157-import-${Date.now()}.csv`)
      require('fs').writeFileSync(csvPath, [
        'Product Name,SKU,Selling Price,Cost Price,Unit',
        `${TEST_PREFIX} Import Widget ${suffix},SKU157${suffix},199,99,PCS`,
      ].join('\n'), 'utf-8')

      try {
        const parseRes = await page.evaluate(async (fp) => window.api.import.parseDroppedFile({ module: 'products', filePath: fp }), csvPath)
        sessionId = parseRes?.data?.sessionId
        const mapping = parseRes?.data?.mapping || parseRes?.data?.suggestedMapping
        r.log('csv-parsed-for-preview', !!sessionId, JSON.stringify(parseRes?.error || ''))
        if (!sessionId) return

        const previewRes = await page.evaluate(({ sessionId, mapping }) => window.api.import.validatePreview({
          sessionId, mapping, module: 'products',
        }), { sessionId, mapping })
        r.log('validate-preview-succeeds', !!previewRes?.success, JSON.stringify(previewRes?.error || ''))
        r.log('validate-preview-shows-our-row', (previewRes?.data?.rows || previewRes?.data || []).length > 0, JSON.stringify(previewRes?.data)?.slice(0, 300))
      } finally {
        require('fs').unlinkSync(csvPath)
      }
    })

    await r.step('change-own-password-via-real-ui', async () => {
      await h.gotoHash(page, '#/settings')
      await page.waitForTimeout(600)
      await page.locator('button:has-text("Security")').click()
      await page.waitForTimeout(500)

      const card = page.locator('div.rounded-xl.border.border-slate-200', { hasText: 'Change Password' }).first()
      const inputs = card.locator('input')
      await inputs.nth(0).fill(h.UAT_PASSWORD)
      await inputs.nth(1).fill(`${h.UAT_PASSWORD}New1`)
      await inputs.nth(2).fill(`${h.UAT_PASSWORD}New1`)
      await page.waitForTimeout(200)
      await card.getByRole('button', { name: 'Change Password' }).click()
      await page.waitForTimeout(1200)
      r.log('change-password-no-crash', !(await h.hasErrorBoundary(page)))

      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('change-password-success-message-shown', bodyText.includes('Password changed successfully'))

      h.withDb((db) => {
        const admin = db.prepare("SELECT passwordChangedAt FROM User WHERE username = 'admin'").get()
        r.log('password-actually-changed-in-db', !!admin?.passwordChangedAt, JSON.stringify(admin))
      })
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let custs = 0, emps = 0, recalls = 0, kots = 0, invs = 0, tables = 0, prods = 0
      try { recalls = db.prepare('DELETE FROM RecallRecord WHERE patientId IN (SELECT id FROM Customer WHERE customerName LIKE ?)').run(`${TEST_PREFIX}%`).changes } catch { /* noop */ }
      try { db.prepare("DELETE FROM LoyaltyRedemption WHERE loyaltyCardId IN (SELECT id FROM LoyaltyCard WHERE customerId IN (SELECT id FROM Customer WHERE customerName LIKE ?))").run(`${TEST_PREFIX}%`) } catch { /* noop */ }
      try { db.prepare("DELETE FROM LoyaltyCard WHERE customerId IN (SELECT id FROM Customer WHERE customerName LIKE ?)").run(`${TEST_PREFIX}%`) } catch { /* noop */ }
      try { kots = db.prepare(`DELETE FROM KOT WHERE tableId IN (SELECT id FROM RestaurantTable WHERE tableNumber LIKE '${TEST_PREFIX}%')`).run().changes } catch { /* noop */ }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const cid of custIds) {
        try { invs += db.prepare('DELETE FROM InvoiceItem WHERE invoiceId IN (SELECT id FROM Invoice WHERE customerId = ?)').run(cid).changes } catch { /* noop */ }
        try { db.prepare('DELETE FROM Invoice WHERE customerId = ?').run(cid) } catch { /* noop */ }
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      try { db.prepare(`DELETE FROM Invoice WHERE items IS NOT NULL AND id IN (SELECT invoiceId FROM InvoiceItem WHERE productId IN (SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'))`).run() } catch { /* noop */ }
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of prodIds) {
        try { db.prepare('DELETE FROM InvoiceItem WHERE productId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM Inventory WHERE productId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM ProductCostHistory WHERE productId = ?').run(id) } catch { /* noop */ }
        try { prods += db.prepare('DELETE FROM Product WHERE id = ?').run(id).changes } catch { db.prepare('UPDATE Product SET isActive = 0 WHERE id = ?').run(id) }
      }
      try { tables = db.prepare(`DELETE FROM RestaurantTable WHERE tableNumber LIKE '${TEST_PREFIX}%'`).run().changes } catch { /* noop */ }
      console.log('extra cleanup:', JSON.stringify({ custs, emps, recalls, kots, invs, tables, prods }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nLOW-PRIORITY BATCH 1: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
