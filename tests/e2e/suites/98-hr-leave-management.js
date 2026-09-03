/**
 * Suite 98 — Coverage-gap closure (2026-09-03 full-codebase audit,
 * continuation of suites 11/13/96/97/64/66): hr.createLeaveType,
 * hr.createLeaveRequest, and hr.updateLeaveStatus (approve/reject) had
 * ZERO E2E coverage of any kind before this suite — no prior suite ever
 * navigated to '#/hr/leave' at all. Drives the full real-world flow: add
 * a paid leave type, submit a leave request for a real employee, then
 * approve it via the real UI and confirm the leave balance actually
 * reflects the used days afterward.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Cov98'
const suffix = Date.now()

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  const employeeName = `${TEST_PREFIX} Employee ${suffix}`
  let employeeId = null

  const leaveTypeName = `${TEST_PREFIX} Sick Leave ${suffix}`
  let leaveTypeId = null

  let requestId = null

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('create-employee-for-leave-test', async () => {
      const res = await page.evaluate(async (name) => window.api.hr.createEmployee({
        fullName: name, employeeType: 'FULL_TIME', joinDate: new Date().toISOString().slice(0, 10),
        salaryType: 'MONTHLY', basicSalary: 15000,
      }), employeeName)
      employeeId = res?.data?.id
      r.log('employee-created', !!employeeId, JSON.stringify(res?.error || ''))
    })

    await r.step('leave-type-created-via-real-ui', async () => {
      await h.gotoHash(page, '#/hr/leave')
      await page.waitForTimeout(700)
      r.log('leave-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('button', { hasText: 'Leave Types' }).click()
      await page.waitForTimeout(400)
      await page.locator('button', { hasText: 'Add Leave Type' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      // These raw fields have no htmlFor/id association with their <label>
      // (not the shared Input component) — walk from the label instead.
      const nameInput = modal.locator('label', { hasText: 'Leave Type Name' }).locator('xpath=following-sibling::input')
      await nameInput.fill(leaveTypeName)
      const maxDaysInput = modal.locator('label', { hasText: 'Max Days Per Year' }).locator('xpath=following-sibling::input')
      await maxDaysInput.fill('')
      await maxDaysInput.fill('10')
      await modal.locator('button', { hasText: 'Save' }).click()
      await page.waitForTimeout(800)
      r.log('leave-type-create-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('leave-type-persisted', () => h.withDb((db) => {
      const row = db.prepare('SELECT * FROM LeaveType WHERE name = ?').get(leaveTypeName)
      r.log('leave-type-row-exists', !!row, JSON.stringify(row))
      if (row) {
        leaveTypeId = row.id
        r.log('leave-type-max-days-and-paid-correct', row.maxDays === 10 && row.isPaid === 1, JSON.stringify(row))
      }
    }))

    await r.step('leave-request-created-via-real-ui', async () => {
      if (!employeeId || !leaveTypeId) return r.log('skipped-no-employee-or-leavetype', false)
      await page.locator('button', { hasText: 'Leave Requests' }).click()
      await page.waitForTimeout(400)
      await page.locator('button', { hasText: 'New Request' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      const empSelect = modal.getByLabel('Employee')
      const empOptValue = await empSelect.locator('option', { hasText: employeeName }).first().getAttribute('value')
      if (empOptValue) await empSelect.selectOption(empOptValue)
      const typeSelect = modal.getByLabel('Leave Type')
      const typeOptValue = await typeSelect.locator('option', { hasText: leaveTypeName }).first().getAttribute('value')
      if (typeOptValue) await typeSelect.selectOption(typeOptValue)

      const fromDateInput = modal.locator('label', { hasText: 'From Date' }).locator('xpath=following-sibling::input')
      const toDateInput = modal.locator('label', { hasText: 'To Date' }).locator('xpath=following-sibling::input')
      const today = new Date()
      const from = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10)
      const to = new Date(today.getTime() + 9 * 86400000).toISOString().slice(0, 10)
      await fromDateInput.fill(from)
      await toDateInput.fill(to)

      const reasonInput = modal.locator('label', { hasText: 'Reason' }).locator('xpath=following-sibling::textarea')
      await reasonInput.fill('E2E Cov98 leave reason')
      await modal.locator('button', { hasText: 'Save' }).click()
      await page.waitForTimeout(800)
      r.log('leave-request-create-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('leave-request-persisted-as-pending-with-3-days', () => h.withDb((db) => {
      if (!employeeId) return r.log('skipped-no-employee-id', false)
      const row = db.prepare('SELECT * FROM LeaveRequest WHERE employeeId = ? ORDER BY createdAt DESC LIMIT 1').get(employeeId)
      r.log('leave-request-row-exists', !!row, JSON.stringify(row))
      if (row) {
        requestId = row.id
        r.log('leave-request-pending-3-days', row.status === 'PENDING' && row.days === 3, JSON.stringify({ status: row.status, days: row.days }))
      }
    }))

    await r.step('leave-request-approved-via-real-ui', async () => {
      if (!requestId) return r.log('skipped-no-request-id', false)
      const nameP = page.locator('p', { hasText: employeeName }).first()
      const card = nameP.locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]')
      await card.locator('button', { hasText: 'Approve' }).click()
      await page.waitForTimeout(800)
      r.log('leave-approve-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('leave-request-approval-persisted', () => h.withDb((db) => {
      if (!requestId) return r.log('skipped-no-request-id', false)
      const row = db.prepare('SELECT * FROM LeaveRequest WHERE id = ?').get(requestId)
      r.log('leave-request-status-approved', row?.status === 'APPROVED', JSON.stringify(row?.status))
      r.log('leave-request-approvedBy-set', !!row?.approvedBy, JSON.stringify(row?.approvedBy))
    }))

    await r.step('leave-balance-reflects-approved-days-used', async () => {
      if (!employeeId || !leaveTypeId) return r.log('skipped-no-employee-or-leavetype', false)
      const res = await page.evaluate(async ({ employeeId, year }) => window.api.hr.getLeaveBalance({ employeeId, year }), { employeeId, year: new Date().getFullYear() })
      const balances = res?.data?.balances || []
      const bal = balances.find((b) => b.leaveTypeId === leaveTypeId)
      r.log('leave-balance-shows-3-days-used', bal?.used === 3, JSON.stringify(bal))
    })

    await r.step('approve-button-no-longer-shown-for-approved-request', async () => {
      if (!requestId) return r.log('skipped-no-request-id', false)
      await page.reload()
      await page.waitForTimeout(1200)
      await h.gotoHash(page, '#/hr/leave')
      await page.waitForTimeout(700)
      const nameP = page.locator('p', { hasText: employeeName }).first()
      const card = nameP.locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]')
      const approveBtnCount = await card.locator('button', { hasText: 'Approve' }).count()
      r.log('approved-request-hides-approve-reject-buttons', approveBtnCount === 0, `count=${approveBtnCount}`)
      const cardText = await card.innerText().catch(() => '')
      r.log('approved-badge-shown', /Approved/i.test(cardText), cardText)
    })
  } catch (e) {
    r.log('FATAL', false, String((e && e.message) || e))
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()

    const cleanup = h.withDb((db) => {
      let requests = 0, leaveTypes = 0, employees = 0
      if (requestId) requests += db.prepare('DELETE FROM LeaveRequest WHERE id = ?').run(requestId).changes
      if (leaveTypeId) leaveTypes += db.prepare('DELETE FROM LeaveType WHERE id = ?').run(leaveTypeId).changes
      if (employeeId) { try { employees += db.prepare('DELETE FROM Employee WHERE id = ?').run(employeeId).changes } catch { db.prepare('UPDATE Employee SET isActive = 0 WHERE id = ?').run(employeeId) } }
      return { requests, leaveTypes, employees }
    })
    console.log('hr-leave-management cleanup:', JSON.stringify(cleanup))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nHR LEAVE MANAGEMENT: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
