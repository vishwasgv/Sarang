import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { chequeBookService } from '../cheque-book.service'

function makeBook(overrides: Record<string, unknown> = {}) {
  return { id: 'book-1', bankAccountId: 'bank-1', startNumber: 100001, endNumber: 100010, nextNumber: 100001, isActive: true, createdAt: new Date('2026-01-01'), ...overrides }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  const db: Record<string, any> = {
    bankAccount: { findUnique: vi.fn().mockResolvedValue({ id: 'bank-1', accountName: 'HDFC Current' }) },
    chequeBook: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(makeBook()),
      create: vi.fn().mockResolvedValue(makeBook()),
      update: vi.fn().mockResolvedValue(makeBook({ nextNumber: 100002 })),
    },
    ...overrides,
  }
  db.$transaction = vi.fn((arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(db)
  )
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('chequeBookService.createChequeBook', () => {
  it('returns error for a non-existent bank account', async () => {
    const db = makeDb({ bankAccount: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await chequeBookService.createChequeBook({ bankAccountId: 'ghost', startNumber: 1, endNumber: 10 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BANK-001')
  })

  it('rejects a range that overlaps an existing active cheque book', async () => {
    const db = makeDb({ chequeBook: { findFirst: vi.fn().mockResolvedValue(makeBook({ startNumber: 100001, endNumber: 100010 })) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await chequeBookService.createChequeBook({ bankAccountId: 'bank-1', startNumber: 100005, endNumber: 100015 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CHQ-003')
  })

  it('creates a book with nextNumber seeded at startNumber, not 0 or 1', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await chequeBookService.createChequeBook({ bankAccountId: 'bank-1', startNumber: 500, endNumber: 600 })

    expect(res.success).toBe(true)
    expect(db.chequeBook.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ startNumber: 500, endNumber: 600, nextNumber: 500 })
    }))
  })
})

describe('chequeBookService.getNextChequeNumber', () => {
  it('returns null when no active book exists', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await chequeBookService.getNextChequeNumber('bank-1')

    expect(res.success).toBe(true)
    expect(res.data).toBeNull()
  })

  it('skips an exhausted book and returns the next book that still has room', async () => {
    const exhausted = makeBook({ id: 'book-1', startNumber: 1, endNumber: 5, nextNumber: 6, createdAt: new Date('2026-01-01') })
    const fresh = makeBook({ id: 'book-2', startNumber: 100, endNumber: 200, nextNumber: 100, createdAt: new Date('2026-02-01') })
    const db = makeDb({ chequeBook: { findMany: vi.fn().mockResolvedValue([exhausted, fresh]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await chequeBookService.getNextChequeNumber('bank-1')

    expect(res.success).toBe(true)
    expect(res.data).toEqual({ chequeBookId: 'book-2', chequeNumber: '100' })
  })
})

describe('chequeBookService.consumeNextChequeNumber', () => {
  it('returns null when every active book is exhausted', async () => {
    const exhausted = makeBook({ nextNumber: 100011, endNumber: 100010 })
    const tx = { chequeBook: { findMany: vi.fn().mockResolvedValue([exhausted]), update: vi.fn() } }

    const result = await chequeBookService.consumeNextChequeNumber(tx as never, 'bank-1')

    expect(result).toBeNull()
    expect(tx.chequeBook.update).not.toHaveBeenCalled()
  })

  it('increments nextNumber by exactly 1 and returns the pre-increment number', async () => {
    const book = makeBook({ nextNumber: 100005, endNumber: 100010 })
    const tx = { chequeBook: { findMany: vi.fn().mockResolvedValue([book]), update: vi.fn().mockResolvedValue({}) } }

    const result = await chequeBookService.consumeNextChequeNumber(tx as never, 'bank-1')

    expect(result).toEqual({ chequeBookId: 'book-1', chequeNumber: '100005' })
    expect(tx.chequeBook.update).toHaveBeenCalledWith({ where: { id: 'book-1' }, data: { nextNumber: 100006 } })
  })

  it('two sequential calls against the same book never return the same number', async () => {
    let nextNumber = 100001
    const tx = {
      chequeBook: {
        findMany: vi.fn(async () => [makeBook({ nextNumber, endNumber: 100010 })]),
        update: vi.fn(async ({ data }: { data: { nextNumber: number } }) => { nextNumber = data.nextNumber; return {} })
      }
    }

    const first = await chequeBookService.consumeNextChequeNumber(tx as never, 'bank-1')
    const second = await chequeBookService.consumeNextChequeNumber(tx as never, 'bank-1')

    expect(first?.chequeNumber).toBe('100001')
    expect(second?.chequeNumber).toBe('100002')
  })
})
