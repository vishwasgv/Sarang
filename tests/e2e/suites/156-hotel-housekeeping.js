/**
 * Suite 156 — Hotel housekeeping CRUD (hotel.handler.ts housekeeping
 * channels), flagged in the gap list as not covered by the earlier hotel
 * suite (112) despite the vertical itself being well-tested. assign/
 * updateStatus have real UI triggers on HotelHousekeepingScreen.tsx;
 * create/delete have NO UI trigger anywhere in the renderer (confirmed via
 * grep — checkOutBooking creates its task inline via Prisma, not through
 * the createHousekeepingTask service/channel at all) -- real product gaps,
 * covered API-only.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E156'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-hotel', async () => {
      const sw = await h.switchBusinessType(page, 'Hotel / Lodge')
      r.log('business-type-switched', sw.to === 'HOTEL_LODGE', JSON.stringify(sw))
    })

    let roomId, bookingId
    await r.step('checkin-checkout-creates-housekeeping-task-via-api', async () => {
      const roomRes = await page.evaluate(async (roomNumber) => window.api.hotel.createRoom({
        roomNumber, roomType: 'Deluxe', baseRate: 2000,
      }), `${TEST_PREFIX}-${suffix}`)
      roomId = roomRes?.data?.id
      r.log('room-created', !!roomId, JSON.stringify(roomRes?.error || ''))

      const bookRes = await page.evaluate(({ roomId, guestName, checkInDate, checkOutDate }) => window.api.hotel.createBooking({
        roomId, guestName, checkInDate, checkOutDate,
      }), {
        roomId, guestName: `${TEST_PREFIX} Guest ${suffix}`,
        checkInDate: h.toLocalISODate(new Date()), checkOutDate: h.toLocalISODate(new Date(Date.now() + 86400000)),
      })
      bookingId = bookRes?.data?.id
      r.log('booking-created', !!bookingId, JSON.stringify(bookRes?.error || ''))

      const ciRes = await page.evaluate(({ id, guestName }) => window.api.hotel.checkIn({
        id, guests: [{ guestName, idType: 'PASSPORT', idNumber: `P-${Date.now()}` }],
      }), { id: bookingId, guestName: `${TEST_PREFIX} Guest` })
      r.log('checked-in', !!ciRes?.success, JSON.stringify(ciRes?.error || ''))

      const coRes = await page.evaluate((id) => window.api.hotel.checkOut({ id }), bookingId)
      r.log('checked-out', !!coRes?.success, JSON.stringify(coRes?.error || ''))

      const roomAfter = await page.evaluate(async () => window.api.hotel.listRooms({}))
      const found = (roomAfter?.data?.rooms || []).find((rm) => rm.id === roomId)
      r.log('room-now-cleaning', found?.status === 'CLEANING', JSON.stringify(found?.status))

      const tasksRes = await page.evaluate(async () => window.api.hotel.listHousekeepingTasks())
      const task = (tasksRes?.data?.tasks || []).find((t) => t.roomId === roomId)
      r.log('housekeeping-task-auto-created', !!task && task.status === 'PENDING', JSON.stringify(task))
    })

    let employeeId
    await r.step('assign-task-via-ui', async () => {
      const empRes = await page.evaluate(async ({ name, joinDate }) => window.api.hr.createEmployee({
        fullName: name, phone: `9${String(Date.now()).slice(-9)}`, joinDate,
      }), { name: `${TEST_PREFIX} Housekeeper ${suffix}`, joinDate: h.toLocalISODate(new Date()) })
      employeeId = empRes?.data?.id
      r.log('employee-created', !!employeeId, JSON.stringify(empRes?.error || ''))

      const roomRes = await page.evaluate(async () => window.api.hotel.listRooms({}))
      const roomNumber = (roomRes?.data?.rooms || []).find((rm) => rm.id === roomId)?.roomNumber

      await h.gotoHash(page, '#/hotel/housekeeping')
      await page.waitForTimeout(700)
      r.log('housekeeping-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const card = page.locator('div.rounded-xl.border.border-slate-200', { hasText: `Room ${roomNumber}` }).first()
      await card.locator('select[title="Assign housekeeping staff"]').selectOption({ label: `${TEST_PREFIX} Housekeeper ${suffix}` })
      await page.waitForTimeout(900)
      r.log('assign-no-crash', !(await h.hasErrorBoundary(page)))

      const tasksRes = await page.evaluate(async () => window.api.hotel.listHousekeepingTasks())
      const task = (tasksRes?.data?.tasks || []).find((t) => t.roomId === roomId)
      r.log('task-actually-assigned', task?.assignedToId === employeeId, JSON.stringify(task))
    })

    await r.step('update-status-via-ui', async () => {
      const roomRes = await page.evaluate(async () => window.api.hotel.listRooms({}))
      const roomNumber = (roomRes?.data?.rooms || []).find((rm) => rm.id === roomId)?.roomNumber
      const card = page.locator('div.rounded-xl.border.border-slate-200', { hasText: `Room ${roomNumber}` }).first()

      await card.getByRole('button', { name: 'Start' }).click()
      await page.waitForTimeout(900)
      r.log('start-no-crash', !(await h.hasErrorBoundary(page)))

      let tasksRes = await page.evaluate(async () => window.api.hotel.listHousekeepingTasks())
      let task = (tasksRes?.data?.tasks || []).find((t) => t.roomId === roomId)
      r.log('task-actually-in-progress', task?.status === 'IN_PROGRESS', JSON.stringify(task))

      const cardAfterStart = page.locator('div.rounded-xl.border.border-slate-200', { hasText: `Room ${roomNumber}` }).first()
      await cardAfterStart.getByRole('button', { name: 'Mark Done' }).click()
      await page.waitForTimeout(900)
      r.log('mark-done-no-crash', !(await h.hasErrorBoundary(page)))

      tasksRes = await page.evaluate(async () => window.api.hotel.listHousekeepingTasks())
      task = (tasksRes?.data?.tasks || []).find((t) => t.roomId === roomId)
      r.log('task-actually-done', task?.status === 'DONE' && !!task?.completedAt, JSON.stringify(task))

      const roomAfter = await page.evaluate(async () => window.api.hotel.listRooms({}))
      const foundRoom = (roomAfter?.data?.rooms || []).find((rm) => rm.id === roomId)
      r.log('room-auto-flipped-to-available', foundRoom?.status === 'AVAILABLE', JSON.stringify(foundRoom?.status))
    })

    let extraTaskId
    await r.step('create-and-delete-task-via-api', async () => {
      const createRes = await page.evaluate(({ roomId, taskLabel }) => window.api.hotel.createHousekeepingTask({
        roomId, taskLabel,
      }), { roomId, taskLabel: `${TEST_PREFIX} Deep Clean ${suffix}` })
      extraTaskId = createRes?.data?.id
      r.log('task-created-via-api', !!extraTaskId, JSON.stringify(createRes?.error || ''))

      const delRes = await page.evaluate((id) => window.api.hotel.deleteHousekeepingTask({ id }), extraTaskId)
      r.log('task-delete-succeeds', !!delRes?.success, JSON.stringify(delRes?.error || ''))

      const tasksRes = await page.evaluate(async () => window.api.hotel.listHousekeepingTasks())
      r.log('task-actually-deleted', !(tasksRes?.data?.tasks || []).some((t) => t.id === extraTaskId), JSON.stringify(tasksRes?.data?.tasks?.length))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'HOTEL_LODGE') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let tasks = 0, bookings = 0, rooms = 0, emps = 0
      try { tasks = db.prepare(`DELETE FROM HotelHousekeepingTask WHERE taskLabel LIKE '${TEST_PREFIX}%' OR taskLabel LIKE 'Clean & inspect%'`).run().changes } catch { /* noop */ }
      const bookIds = db.prepare(`SELECT id FROM HotelBooking WHERE guestName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of bookIds) {
        try { db.prepare('DELETE FROM HotelHousekeepingTask WHERE bookingId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM HotelGuestRegister WHERE bookingId = ?').run(id) } catch { /* noop */ }
        try { bookings += db.prepare('DELETE FROM HotelBooking WHERE id = ?').run(id).changes } catch { /* noop */ }
      }
      const roomIds = db.prepare(`SELECT id FROM HotelRoom WHERE roomNumber LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of roomIds) {
        try { db.prepare('DELETE FROM HotelHousekeepingTask WHERE roomId = ?').run(id) } catch { /* noop */ }
        try { rooms += db.prepare('DELETE FROM HotelRoom WHERE id = ?').run(id).changes } catch { /* noop */ }
      }
      const empIds = db.prepare(`SELECT id FROM Employee WHERE fullName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of empIds) { try { emps += db.prepare('DELETE FROM Employee WHERE id = ?').run(id).changes } catch { /* noop */ } }
      console.log('extra cleanup:', JSON.stringify({ tasks, bookings, rooms, emps }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nHOTEL HOUSEKEEPING: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
