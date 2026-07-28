import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { createLeaveRequest, updateLeaveStatus } from '../hr.service'

function makeMockDb() {
  return {
    leaveRequest: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'lr-1', ...data, employee: { fullName: 'Test Employee' }, leaveType: { name: 'Casual' } })
      ),
    },
  }
}

function makePendingRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lr-1', employeeId: 'emp-1', leaveTypeId: 'lt-1',
    fromDate: new Date('2026-08-01'), toDate: new Date('2026-08-03'),
    days: 3, status: 'PENDING',
    ...overrides,
  }
}

function makeApprovalMockDb(overrides: Record<string, unknown> = {}) {
  const db: Record<string, any> = {
    leaveRequest: {
      findUnique: vi.fn().mockResolvedValue(makePendingRequest()),
      aggregate: vi.fn().mockResolvedValue({ _sum: { days: 0 } }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    leaveType: {
      findUnique: vi.fn().mockResolvedValue({ id: 'lt-1', name: 'Casual', maxDays: 12 }),
    },
    ...overrides,
  }
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return db
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

// Real bug found live (2026-07-28 reports/HR audit): LeaveType.maxDays was
// computed for display in getLeaveBalance but never actually enforced
// anywhere — an employee already at (or over) their cap could still have
// further leave requests approved with no error.
describe('hr.service.updateLeaveStatus — leave-day cap enforcement on approval', () => {
  it('approves a request that stays within the leave type cap', async () => {
    const db = makeApprovalMockDb()
    db.leaveRequest.aggregate.mockResolvedValue({ _sum: { days: 5 } }) // 5 used + 3 requested = 8, cap 12
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateLeaveStatus({ id: 'lr-1', status: 'APPROVED', approvedBy: 'mgr-1' })

    expect(res.success).toBe(true)
    expect(db.leaveRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'lr-1', status: 'PENDING' },
      data: expect.objectContaining({ status: 'APPROVED', approvedBy: 'mgr-1' }),
    })
  })

  it('rejects approval that would push the employee over the leave type cap', async () => {
    const db = makeApprovalMockDb()
    db.leaveRequest.findUnique.mockResolvedValue(makePendingRequest({ days: 5 }))
    db.leaveRequest.aggregate.mockResolvedValue({ _sum: { days: 10 } }) // 10 used + 5 requested = 15 > cap 12
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateLeaveStatus({ id: 'lr-1', status: 'APPROVED' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HR-036')
    expect(db.leaveRequest.updateMany).not.toHaveBeenCalled()
  })

  it('allows unlimited approval when the leave type has no cap (maxDays <= 0)', async () => {
    const db = makeApprovalMockDb({ leaveType: { findUnique: vi.fn().mockResolvedValue({ id: 'lt-1', name: 'Unpaid', maxDays: 0 }) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateLeaveStatus({ id: 'lr-1', status: 'APPROVED' })

    expect(res.success).toBe(true)
    expect(db.leaveRequest.aggregate).not.toHaveBeenCalled()
  })

  it('rejects approving a request that is not PENDING', async () => {
    const db = makeApprovalMockDb()
    db.leaveRequest.findUnique.mockResolvedValue(makePendingRequest({ status: 'REJECTED' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateLeaveStatus({ id: 'lr-1', status: 'APPROVED' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HR-035')
  })

  it('rejects the race loser when another action already approved/rejected it inside the transaction window', async () => {
    const db = makeApprovalMockDb()
    db.leaveRequest.updateMany.mockResolvedValue({ count: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateLeaveStatus({ id: 'lr-1', status: 'APPROVED' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HR-035')
  })

  it('rejecting a request does not go through the balance-check path', async () => {
    const db = makeApprovalMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateLeaveStatus({ id: 'lr-1', status: 'REJECTED' })

    expect(res.success).toBe(true)
    expect(db.leaveRequest.update).toHaveBeenCalledWith({
      where: { id: 'lr-1' },
      data: expect.objectContaining({ status: 'REJECTED' }),
    })
    expect(db.leaveType.findUnique).not.toHaveBeenCalled()
  })
})
