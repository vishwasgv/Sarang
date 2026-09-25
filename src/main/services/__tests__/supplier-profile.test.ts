import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../auth.service', () => ({ getCurrentSession: vi.fn().mockReturnValue({ userId: 'u1' }) }))
vi.mock('../supplier-checks', () => ({
  normaliseSupplierIdentifiers: (p: unknown) => p,
  validateSupplierFormats: vi.fn().mockResolvedValue(null),
  checkSupplierUniqueness: vi.fn().mockResolvedValue(null)
}))
vi.mock('../sequence.service', () => ({ generateSequenceNumber: vi.fn().mockResolvedValue('SUP-00001') }))

import { getPrisma } from '../../database/db'
import { createSupplier } from '../supplier.service'
import { CreateSupplierSchema } from '../../validation/supplier.validation'

function makeDb() {
  const ledger: Array<Record<string, unknown>> = []
  const tx = {
    supplier: { create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'sup-1', ...data })), findMany: vi.fn().mockResolvedValue([]) },
    supplierLedger: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 0, creditAmount: 0 } }),
      create: vi.fn().mockImplementation(({ data }) => { ledger.push(data); return Promise.resolve(data) })
    }
  }
  const db = { ...tx, $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)) }
  return { db, tx, ledger }
}

describe('supplier profile fields', () => {
  beforeEach(() => vi.clearAllMocks())

  it('validation: rating 1-5, credit limit not negative, opening balance may be negative', () => {
    const ok = CreateSupplierSchema.safeParse({ supplierName: 'X', creditLimit: 5000, rating: 4, contactPerson: ' Sam ', supplierCategory: 'Packaging', openingBalance: -300 })
    expect(ok.success).toBe(true)
    expect(ok.success && ok.data.contactPerson).toBe('Sam')
    expect(CreateSupplierSchema.safeParse({ supplierName: 'X', rating: 6 }).success).toBe(false)
    expect(CreateSupplierSchema.safeParse({ supplierName: 'X', rating: 0 }).success).toBe(false)
    expect(CreateSupplierSchema.safeParse({ supplierName: 'X', creditLimit: -1 }).success).toBe(false)
  })

  it('stores credit limit, contact person, category and rating', async () => {
    const { db, tx } = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createSupplier({ supplierName: 'Acme', creditLimit: 5000, contactPerson: ' Sam ', supplierCategory: 'Packaging', rating: 4, openingBalance: 0 } as never)
    expect(res.success).toBe(true)
    expect(tx.supplier.create.mock.calls[0][0].data).toMatchObject({ creditLimit: 5000, contactPerson: 'Sam', supplierCategory: 'Packaging', rating: 4 })
  })

  it('a positive opening balance is a debit (we owe) and a negative one is a credit (advance paid)', async () => {
    const owe = makeDb()
    vi.mocked(getPrisma).mockReturnValue(owe.db as never)
    await createSupplier({ supplierName: 'Owed', openingBalance: 800 } as never)
    expect(owe.ledger[0]).toMatchObject({ debitAmount: 800, creditAmount: 0, balance: 800 })

    const advance = makeDb()
    vi.mocked(getPrisma).mockReturnValue(advance.db as never)
    await createSupplier({ supplierName: 'Advance', openingBalance: -300 } as never)
    expect(advance.ledger[0]).toMatchObject({ debitAmount: 0, creditAmount: 300, balance: -300 })
    expect(String(advance.ledger[0].remarks)).toContain('advance')
  })

  it('no ledger entry when the opening balance is zero', async () => {
    const zero = makeDb()
    vi.mocked(getPrisma).mockReturnValue(zero.db as never)
    await createSupplier({ supplierName: 'Fresh', openingBalance: 0 } as never)
    expect(zero.ledger).toHaveLength(0)
  })
})
