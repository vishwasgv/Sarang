/**
 * Suite 13 — Role-based permission enforcement (Section 4). Logs in as
 * real Cashier and Staff users (not just the Admin every other suite
 * uses) and confirms both the IPC-level enforcement (`requirePermission`
 * → PERM-001) and the UI-level route gate (`ProtectedRoute` →
 * "Access Denied") actually work, per each role's real seeded permission
 * set in `src/main/database/seed.ts` — not by reading the permission
 * matrix and assuming it's wired up correctly everywhere.
 *
 * Cashier has `billing.createInvoice` but not `inventory.adjustStock`.
 * Staff has neither. Both facts are asserted against, in both directions
 * (granted actions succeed, denied actions are actually blocked) so a
 * too-narrow role isn't mistaken for a correctly-enforced one.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E RolePerm'
const TEST_USER_PASSWORD = 'E2ERolePw!2026Test'

async function createRoleUser(page, roleName, username) {
  const rolesRes = await page.evaluate(async () => window.api.roles.list())
  const roles = rolesRes?.data || []
  const role = roles.find((rl) => rl.roleName === roleName)
  if (!role) return { success: false, error: { code: 'NO-ROLE', message: `role ${roleName} not found` } }
  return page.evaluate(async ({ roleId, username, password, fullName }) => window.api.users.create({
    fullName, username, password, roleId,
  }), { roleId: role.id, username, password: TEST_USER_PASSWORD, fullName: `${TEST_PREFIX} ${roleName}` })
}

async function switchToUser(page, username) {
  // A raw window.api.auth.logout() call clears the MAIN process session but
  // the renderer's own Zustand auth store (which gates route rendering and
  // decides whether the login form is even shown) never finds out — it only
  // updates via the real "Sign Out" button's onClick (clearAuth()). Driving
  // the actual UI control, not the bare IPC call, is what makes the login
  // form reappear for h.login()'s retry loop to find.
  // Search/dark-toggle/notifications buttons all carry an aria-label; the
  // user-menu button (avatar + name + chevron) is the only one that doesn't.
  await page.locator('header button:not([aria-label])').first().click()
  await page.waitForTimeout(300)
  await page.locator('button:has-text("Sign Out")').click()
  await page.waitForTimeout(800)
  await h.login(page, username, TEST_USER_PASSWORD)
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    const cashierUsername = `e2ecashier${Date.now()}`
    const staffUsername = `e2estaff${Date.now()}`

    await r.step('create-cashier-and-staff-test-users', async () => {
      const cashRes = await createRoleUser(page, 'Cashier', cashierUsername)
      r.log('cashier-user-created', !!cashRes?.success, JSON.stringify(cashRes?.error || ''))
      const staffRes = await createRoleUser(page, 'Staff', staffUsername)
      r.log('staff-user-created', !!staffRes?.success, JSON.stringify(staffRes?.error || ''))
    })

    let productId
    await r.step('setup-product-for-permission-tests', async () => {
      const prodRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} Widget`, productType: 'STANDARD', unit: 'PCS',
        costPrice: 50, sellingPrice: 100, taxRate: 18, openingQuantity: 20,
      }), TEST_PREFIX)
      productId = prodRes?.data?.id
      r.log('permission-test-product-created', !!prodRes?.success)
    })

    // ── Cashier: granted action succeeds, ungranted action is blocked ────
    await r.step('cashier-can-create-invoice-granted-permission', async () => {
      await switchToUser(page, cashierUsername)
      const who = await page.evaluate(async () => window.api.auth.getCurrentUser())
      r.log('logged-in-as-cashier', who?.data?.username === cashierUsername, JSON.stringify(who?.data?.username))

      const invRes = await page.evaluate(async (pid) => window.api.billing.createInvoice({
        paymentMethod: 'CASH', items: [{ productId: pid, quantity: 1, unitPrice: 100, taxRate: 18 }],
      }), productId)
      r.log('cashier-invoice-creation-succeeds', !!invRes?.success, JSON.stringify(invRes?.error || ''))
    })

    await r.step('cashier-cannot-adjust-stock-ungranted-permission', async () => {
      const adjRes = await page.evaluate(async (pid) => window.api.inventory.adjustStock({
        productId: pid, quantity: 5, reason: 'E2E permission test — should be blocked',
      }), productId)
      r.log('cashier-stock-adjustment-blocked', adjRes?.success === false && adjRes?.error?.code === 'PERM-001', JSON.stringify(adjRes?.error || adjRes))
    })

    await r.step('cashier-cannot-reach-inventory-movements-screen', async () => {
      // Cashier has inventory.view but NOT inventory.viewMovements (seed.ts).
      await h.gotoHash(page, '#/inventory/movements')
      await page.waitForTimeout(700)
      const bodyText = await page.locator('body').innerText()
      r.log('cashier-sees-access-denied-for-inventory-movements', /Access Denied/i.test(bodyText), bodyText.slice(0, 120))
    })

    // ── Staff: no billing permission at all ──────────────────────────────
    await r.step('staff-cannot-create-invoice-no-billing-permission', async () => {
      await switchToUser(page, staffUsername)
      const who = await page.evaluate(async () => window.api.auth.getCurrentUser())
      r.log('logged-in-as-staff', who?.data?.username === staffUsername, JSON.stringify(who?.data?.username))

      const invRes = await page.evaluate(async (pid) => window.api.billing.createInvoice({
        paymentMethod: 'CASH', items: [{ productId: pid, quantity: 1, unitPrice: 100, taxRate: 18 }],
      }), productId)
      r.log('staff-invoice-creation-blocked', invRes?.success === false && invRes?.error?.code === 'PERM-001', JSON.stringify(invRes?.error || invRes))
    })

    await r.step('staff-cannot-reach-billing-new-screen', async () => {
      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)
      const bodyText = await page.locator('body').innerText()
      r.log('staff-sees-access-denied-for-billing-new', /Access Denied/i.test(bodyText), bodyText.slice(0, 120))
    })

    await r.step('staff-can-still-view-products-granted-permission', async () => {
      await h.gotoHash(page, '#/products')
      await page.waitForTimeout(700)
      r.log('staff-products-screen-not-access-denied', !(await h.hasErrorBoundary(page)) && !/Access Denied/i.test(await page.locator('body').innerText()))
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const userIds = db.prepare("SELECT id FROM User WHERE fullName LIKE 'E2E RolePerm%'").all().map((row) => row.id)
      for (const uid of userIds) {
        // Real bug found+fixed 2026-07-15: see the identical fix + full
        // explanation in 06-trust-compliance.js's cleanup — a hard DELETE
        // here silently corrupts historical AuditLog hash verification via
        // the userId ON DELETE SET NULL cascade, and the real app never
        // hard-deletes a user anyway (only `users:deactivate` exists).
        db.prepare('UPDATE User SET isActive = 0 WHERE id = ?').run(uid)
      }
      console.log('role-user cleanup:', userIds.length)
    })
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nROLE PERMISSIONS: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
