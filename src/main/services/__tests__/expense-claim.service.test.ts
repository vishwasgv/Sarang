import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../expense.service', () => ({ createExpense: vi.fn() }))

import { getPrisma } from '../../database/db'
import { createExpense } from '../expense.service'
import { expenseClaimService, canMove } from '../expense-claim.service'

function makeDb(status = 'SUBMITTED') {
  return {
    expenseCategory: { findUnique: vi.fn().mockResolvedValue({ id: 'c1' }) },
    expenseClaim: {
      create: vi.fn().mockResolvedValue({ id: 'k1', amount: 100, claimantName: 'Ravi' }),
      findUnique: vi.fn().mockResolvedValue({ id: 'k1', status, categoryId: 'c1', description: 'Taxi', claimantName: 'Ravi', amount: 250, claimDate: new Date('2026-09-20') }),
      update: vi.fn().mockResolvedValue({})
    }
  }
}

describe('expense claims', () => {
  beforeEach(() => vi.clearAllMocks())

  it('allows only forward moves', () => {
    expect(canMove('SUBMITTED', 'APPROVED')).toBe(true)
    expect(canMove('SUBMITTED', 'PAID')).toBe(false)
    expect(canMove('APPROVED', 'PAID')).toBe(true)
    expect(canMove('PAID', 'REJECTED')).toBe(false)
    expect(canMove('REJECTED', 'APPROVED')).toBe(false)
  })

  it('validates a submission', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)
    expect((await expenseClaimService.submit({ claimantName: '', categoryId: 'c1', description: 'x', amount: 5 })).success).toBe(false)
    expect((await expenseClaimService.submit({ claimantName: 'R', categoryId: 'c1', description: 'x', amount: 0 })).success).toBe(false)
    expect((await expenseClaimService.submit({ claimantName: 'R', categoryId: 'c1', description: 'x', amount: 5 })).success).toBe(true)
  })

  it('cannot pay a claim that is not approved', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb('SUBMITTED') as never)
    const r = await expenseClaimService.pay('k1', 'CASH')
    expect(r.success).toBe(false)
    expect(createExpense).not.toHaveBeenCalled()
  })

  it('paying creates the expense once and links it', async () => {
    const db = makeDb('APPROVED')
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(createExpense).mockResolvedValue({ success: true, data: { id: 'e9' } } as never)
    const r = await expenseClaimService.pay('k1', 'CASH')
    expect(r.success).toBe(true)
    expect(vi.mocked(createExpense).mock.calls[0][0].amount).toBe(250)
    expect(db.expenseClaim.update.mock.calls[0][0].data).toEqual({ status: 'PAID', expenseId: 'e9' })
  })

  it('leaves the claim approved when the expense fails', async () => {
    const db = makeDb('APPROVED')
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(createExpense).mockResolvedValue({ success: false, error: { code: 'EXP-004', message: 'no' } } as never)
    const r = await expenseClaimService.pay('k1', 'CASH')
    expect(r.success).toBe(false)
    expect(db.expenseClaim.update).not.toHaveBeenCalled()
  })
})
