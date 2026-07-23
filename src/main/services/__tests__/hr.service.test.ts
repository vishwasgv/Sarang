import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { createLeaveRequest } from '../hr.service'

function makeMockDb() {
  return {
    leaveRequest: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'lr-1', ...data, employee: { fullName: 'Test Employee' }, leaveType: { name: 'Casual' } })
      ),
    },
  }
}

beforeEach(() => vi.clearAllMocks())

// Regression for a real defect found 2026-07-22: fromDate/toDate used to be
// stored via `new Date(dateString)`, which parses a bare "YYYY-MM-DD" as
// UTC midnight, not local midnight — the same bug class fixed across many
// other files this session.
describe('hr.service.createLeaveRequest — local calendar-date correctness', () => {
  it('stores fromDate/toDate at local midnight, not UTC midnight', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createLeaveRequest({
      employeeId: 'emp-1', leaveTypeId: 'lt-1',
      fromDate: '2026-07-31', toDate: '2026-08-02', days: 3,
    })

    const createCall = db.leaveRequest.create.mock.calls[0][0]
    const storedFrom = createCall.data.fromDate as Date
    const storedTo = createCall.data.toDate as Date
    // Local calendar components must read July 31st / August 2nd — what
    // new Date('2026-07-31') (UTC midnight) would NOT reliably show once
    // local components are inspected in a timezone behind UTC.
    expect(storedFrom.getFullYear()).toBe(2026)
    expect(storedFrom.getMonth()).toBe(6) // 0-indexed: July
    expect(storedFrom.getDate()).toBe(31)
    expect(storedFrom.getHours()).toBe(0)
    expect(storedTo.getMonth()).toBe(7) // August
    expect(storedTo.getDate()).toBe(2)
  })
})
