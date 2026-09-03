/**
 * Suite 153 — Section C medium gap: placement:delete (Placement Agency).
 * placement.create/update/generateInvoice already covered via real UI
 * (suite 27); delete was the only uncovered channel on this screen.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Plc153'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-placement-agency', async () => {
      const sw = await h.switchBusinessType(page, 'Placement / Recruitment Agency')
      r.log('business-type-switched', sw.to === 'PLACEMENT_AGENCY', JSON.stringify(sw))
    })

    let hiringCompanyId, jobOrderId, candidateId
    await r.step('seed-prerequisites-via-api', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Hiring Co ${suffix}`)
      hiringCompanyId = custRes?.data?.id

      const joRes = await page.evaluate(({ clientId, title }) => window.api.jobOrder.create({
        clientId, jobTitle: title, commissionType: 'PERCENTAGE', commissionValue: 10,
      }), { clientId: hiringCompanyId, title: `${TEST_PREFIX} Backend Engineer ${suffix}` })
      jobOrderId = joRes?.data?.id

      const candRes = await page.evaluate(async (name) => window.api.candidate.create({
        fullName: name,
      }), `${TEST_PREFIX} Candidate ${suffix}`)
      candidateId = candRes?.data?.id
      r.log('prerequisites-created', !!hiringCompanyId && !!jobOrderId && !!candidateId,
        JSON.stringify({ hiringCompanyId, jobOrderId, candidateId }))
    })

    let placement1Id
    await r.step('create-placement1-and-delete-via-ui', async () => {
      const res = await page.evaluate(({ candidateId, jobOrderId, clientId, joiningDate }) => window.api.placement.create({
        candidateId, jobOrderId, clientId, joiningDate, offeredSalary: 50000, commissionAmount: 5000,
      }), { candidateId, jobOrderId, clientId: hiringCompanyId, joiningDate: h.toLocalISODate(new Date()) })
      placement1Id = res?.data?.id
      r.log('placement1-seeded', !!placement1Id, JSON.stringify(res?.error || ''))
      if (!placement1Id) return

      await h.gotoHash(page, '#/placement/candidates')
      await page.waitForTimeout(700)
      r.log('placement-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Placements' }).click()
      await page.waitForTimeout(500)

      const row = page.locator('div.flex.items-start.justify-between.gap-3', { hasText: res.data.placementNumber })
      await row.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      r.log('confirm-dialog-title-correct', await modal.getByRole('heading', { name: 'Delete Placement' }).isVisible())
      await modal.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('delete-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.placement.list({}))
      r.log('placement1-actually-deleted', !(listRes?.data || []).some((p) => p.id === placement1Id), JSON.stringify(listRes?.data?.length))
    })

    await r.step('post-invoice-placement-delete-is-rejected', async () => {
      const res = await page.evaluate(({ candidateId, jobOrderId, clientId, joiningDate }) => window.api.placement.create({
        candidateId, jobOrderId, clientId, joiningDate, offeredSalary: 50000, commissionAmount: 5000,
      }), { candidateId, jobOrderId, clientId: hiringCompanyId, joiningDate: h.toLocalISODate(new Date()) })
      const placement2Id = res?.data?.id
      r.log('placement2-seeded', !!placement2Id, JSON.stringify(res?.error || ''))
      if (!placement2Id) return

      await page.evaluate((id) => window.api.placement.update({ id, status: 'JOINED' }), placement2Id)
      const invRes = await page.evaluate((id) => window.api.placement.generateInvoice(id), placement2Id)
      r.log('placement2-invoiced', !!invRes?.success, JSON.stringify(invRes?.error || ''))

      const delRes = await page.evaluate((id) => window.api.placement.delete(id), placement2Id)
      r.log('post-invoice-delete-rejected', delRes?.success === false && delRes?.error?.code === 'PLC-002', JSON.stringify(delRes?.error))

      const getRes = await page.evaluate(async () => window.api.placement.list({}))
      r.log('placement2-still-present', (getRes?.data || []).some((p) => p.id === placement2Id))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'PLACEMENT_AGENCY') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let plcs = 0, jos = 0, cands = 0, custs = 0
      const plcIds = db.prepare(`SELECT p.id FROM Placement p JOIN Candidate c ON c.id = p.candidateId WHERE c.fullName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of plcIds) { try { plcs += db.prepare('DELETE FROM Placement WHERE id = ?').run(id).changes } catch { /* post-invoice, expected */ } }
      const joIds = db.prepare(`SELECT id FROM JobOrder WHERE jobTitle LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of joIds) { try { jos += db.prepare('DELETE FROM JobOrder WHERE id = ?').run(id).changes } catch { /* noop */ } }
      const candIds = db.prepare(`SELECT id FROM Candidate WHERE fullName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of candIds) { try { cands += db.prepare('DELETE FROM Candidate WHERE id = ?').run(id).changes } catch { /* noop */ } }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ plcs, jos, cands, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nPLACEMENT DELETE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
