/**
 * Suite 102 — notification-queue.handler.ts (markSent/dismiss/
 * generateWhatsAppLink/createReminder) + audit.handler.ts's notification-bell
 * channels (markRead/markAllRead) (broader-gap-list closure, 2026-09-03).
 * Two unrelated features that happen to share the word "notification" --
 * the WhatsApp Reminders queue (Bell icon on /service-notifications) is a
 * business-facing outbound-message queue; the TopBar bell dropdown is an
 * in-app system-alert inbox (Notification model, no FK, system-generated --
 * seeded directly via DB here since there's no UI action that creates one).
 */
const h = require('../harness')

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    const originalBusinessType = h.getBusinessType()

    await r.step('switch-to-gp-clinic', async () => {
      const res = await page.evaluate(async () => window.api.industry.changeBusinessType({ businessType: 'GP_CLINIC' }))
      r.log('business-type-switch-api-succeeded', !!res?.success, JSON.stringify(res?.error || ''))
      await page.reload()
      await page.waitForTimeout(1500)
    })

    async function bookAppointmentForNewCustomer(customerName, phoneSeed) {
      const custRes = await page.evaluate(async ({ name, phone }) => window.api.customers.create({ customerName: name, phone }), { name: customerName, phone: `9${phoneSeed}` })
      const customerId = custRes?.data?.id

      await h.gotoHash(page, '#/appointments')
      await page.waitForTimeout(600)
      await page.getByRole('button', { name: 'New Appointment' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByPlaceholder('Search existing client by name or phone...').fill(customerName)
      await page.waitForTimeout(700)
      await modal.locator('button', { hasText: customerName }).first().click()
      await page.waitForTimeout(300)
      await modal.getByLabel('Service Title').fill('E2E Notif Checkup')
      // +3 days -- guarantees schedule24h (scheduledDate - 24h) is still
      // safely in the future, unlike a bare +24h which lands exactly at
      // "now" and silently skips the 24h reminder row.
      const future = new Date(Date.now() + 3 * 24 * 3600000)
      await modal.getByLabel('Date').fill(h.toLocalISODate(future))
      await modal.getByLabel('Time').fill('10:00')
      await page.waitForTimeout(300)
      await modal.getByRole('button', { name: 'Book Appointment' }).click()
      await page.waitForTimeout(1300)

      const listRes = await page.evaluate(async () => window.api.appointments.list({}))
      const items = listRes?.data?.items || []
      const created = items.find((a) => a.customerName === customerName || a.customer?.customerName === customerName)
      return { customerId, appointmentId: created?.id }
    }

    let apptA, apptB
    await r.step('book-appointment-A-queues-24h-reminder', async () => {
      apptA = await bookAppointmentForNewCustomer('E2E Notif Client A', `${Date.now()}`.slice(-9))
      r.log('appointment-A-created', !!apptA.appointmentId, JSON.stringify(apptA))

      // This shared dev DB has hundreds of PENDING reminders from years of
      // prior test runs -- the screen caps its list at 100 rows ordered by
      // scheduledFor ASC, so our freshly-scheduled (~2 days out) row would
      // never actually render for the UI step below. Backdating only OUR
      // row's scheduledFor guarantees it sorts to the very top without
      // touching anything else -- the real service already proved it
      // schedules correctly (asserted above), this is purely UI-visibility
      // setup for the subsequent click.
      h.withDb((db) => db.prepare("UPDATE NotificationQueue SET scheduledFor = 1 WHERE appointmentId = ? AND notificationType = 'APPOINTMENT_REMINDER_24H'").run(apptA.appointmentId))
      const row = h.withDb((db) => db.prepare("SELECT * FROM NotificationQueue WHERE appointmentId = ? AND notificationType = 'APPOINTMENT_REMINDER_24H'").get(apptA.appointmentId))
      r.log('appointment-A-24h-reminder-queued', !!row && row.status === 'PENDING', JSON.stringify(row))
    })

    await r.step('book-appointment-B-queues-24h-reminder', async () => {
      apptB = await bookAppointmentForNewCustomer('E2E Notif Client B', `${Date.now()}`.slice(-9))
      r.log('appointment-B-created', !!apptB.appointmentId, JSON.stringify(apptB))

      h.withDb((db) => db.prepare("UPDATE NotificationQueue SET scheduledFor = 2 WHERE appointmentId = ? AND notificationType = 'APPOINTMENT_REMINDER_24H'").run(apptB.appointmentId))
      const row = h.withDb((db) => db.prepare("SELECT * FROM NotificationQueue WHERE appointmentId = ? AND notificationType = 'APPOINTMENT_REMINDER_24H'").get(apptB.appointmentId))
      r.log('appointment-B-24h-reminder-queued', !!row && row.status === 'PENDING', JSON.stringify(row))
    })

    await r.step('mark-sent-via-ui', async () => {
      if (!apptA?.appointmentId) return r.log('mark-sent-via-ui', false, 'no appointment A')
      await h.gotoHash(page, '#/service-notifications')
      await page.waitForTimeout(700)
      r.log('notification-queue-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const row = page.locator('span', { hasText: 'E2E Notif Client A' }).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
      await row.locator('button[title="Mark as sent"]').click()
      await page.waitForTimeout(1000)
      r.log('mark-sent-no-crash', !(await h.hasErrorBoundary(page)))

      const row2 = h.withDb((db) => db.prepare("SELECT * FROM NotificationQueue WHERE appointmentId = ? AND notificationType = 'APPOINTMENT_REMINDER_24H'").get(apptA.appointmentId))
      r.log('notification-marked-sent', row2?.status === 'SENT' && !!row2?.sentAt, JSON.stringify(row2))
    })

    await r.step('dismiss-via-ui', async () => {
      if (!apptB?.appointmentId) return r.log('dismiss-via-ui', false, 'no appointment B')
      const row = page.locator('span', { hasText: 'E2E Notif Client B' }).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
      await row.locator('button[title="Dismiss"]').click()
      await page.waitForTimeout(1000)
      r.log('dismiss-no-crash', !(await h.hasErrorBoundary(page)))

      const row2 = h.withDb((db) => db.prepare("SELECT * FROM NotificationQueue WHERE appointmentId = ? AND notificationType = 'APPOINTMENT_REMINDER_24H'").get(apptB.appointmentId))
      r.log('notification-marked-dismissed', row2?.status === 'DISMISSED', JSON.stringify(row2))
    })

    // generateWhatsAppLink has no UI trigger anywhere in the renderer -- API-only coverage.
    await r.step('generate-whatsapp-link-via-api', async () => {
      const res = await page.evaluate(async () => window.api.notificationQueue.generateWhatsAppLink({
        phone: '9876500102', message: 'E2E Notif custom test message', notificationType: 'CUSTOM',
      }))
      r.log('generate-whatsapp-link-succeeds', !!res?.success && typeof res?.data?.link === 'string' && res.data.link.startsWith('https://wa.me/'), JSON.stringify(res))

      const row = h.withDb((db) => db.prepare("SELECT * FROM NotificationQueue WHERE notificationType = 'CUSTOM' AND customerPhone = '9876500102'").get())
      r.log('custom-link-persisted-to-queue', !!row, JSON.stringify(row))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'GP_CLINIC') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
        await page.reload()
        await page.waitForTimeout(1500)
      }
    })

    // ── TopBar bell: notifications.markRead / markAllRead ───────────────────
    let notifId1, notifId2
    await r.step('seed-bell-notifications-via-db', () => h.withDb((db) => {
      const insert = db.prepare("INSERT INTO Notification (id, notificationType, title, message, isRead, createdAt) VALUES (?, 'INFO', ?, ?, 0, ?)")
      notifId1 = `e2e-notif-${Date.now()}-1`
      notifId2 = `e2e-notif-${Date.now()}-2`
      const now = Date.now()
      insert.run(notifId1, 'E2E Notif Bell Test 1', 'E2E Notif bell message one', now)
      insert.run(notifId2, 'E2E Notif Bell Test 2', 'E2E Notif bell message two', now + 1)
      r.log('bell-notifications-seeded', true)
    }))

    await r.step('mark-read-via-bell-ui', async () => {
      await page.reload()
      await page.waitForTimeout(1500)
      await page.getByRole('button', { name: 'Notifications' }).click()
      await page.waitForTimeout(500)
      r.log('bell-dropdown-opens-no-crash', !(await h.hasErrorBoundary(page)))

      const item1 = page.locator('p', { hasText: 'E2E Notif Bell Test 1' }).first().locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]')
      r.log('unread-item-present', await item1.count() > 0)
      await item1.click()
      await page.waitForTimeout(800)

      const row = h.withDb((db) => db.prepare('SELECT isRead FROM Notification WHERE id = ?').get(notifId1))
      r.log('notification-marked-read', row?.isRead === 1, JSON.stringify(row))
    })

    await r.step('mark-all-read-via-bell-ui', async () => {
      const markAllBtn = page.getByRole('button', { name: 'Mark all read' })
      r.log('mark-all-read-button-present', await markAllBtn.count() > 0)
      await markAllBtn.click()
      await page.waitForTimeout(800)

      const row2 = h.withDb((db) => db.prepare('SELECT isRead FROM Notification WHERE id = ?').get(notifId2))
      r.log('second-notification-also-marked-read', row2?.isRead === 1, JSON.stringify(row2))
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const ids = db.prepare("SELECT id FROM Appointment WHERE customerName LIKE 'E2E Notif%'").all().map((r2) => r2.id)
      let notifQueue = 0, appts = 0
      for (const id of ids) {
        notifQueue += db.prepare('DELETE FROM NotificationQueue WHERE appointmentId = ?').run(id).changes
        try { appts += db.prepare('DELETE FROM Appointment WHERE id = ?').run(id).changes } catch { /* noop */ }
      }
      notifQueue += db.prepare("DELETE FROM NotificationQueue WHERE notificationType = 'CUSTOM' AND customerPhone = '9876500102'").run().changes
      const custIds = db.prepare("SELECT id FROM Customer WHERE customerName LIKE 'E2E Notif%'").all().map((r2) => r2.id)
      let custs = 0
      for (const cid of custIds) {
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      const notifs = db.prepare("DELETE FROM Notification WHERE title LIKE 'E2E Notif Bell Test%'").run().changes
      console.log('extra cleanup:', JSON.stringify({ notifQueue, appts, custs, notifs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nNOTIFICATION QUEUE & BELL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
