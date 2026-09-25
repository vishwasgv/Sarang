import { describe, it, expect, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { checkCustomerUniqueness, validateCustomerFormats, phoneKey, groupDuplicates, normaliseCustomerIdentifiers } from '../customer-checks'

const party = (id: string, name: string, over: Record<string, unknown> = {}) => ({ id, code: id, name, phone: null, email: null, taxNumber: null, city: null, balance: 0, ...over })

describe('phoneKey', () => {
  it('compares phones by their last 10 digits', () => {
    expect(phoneKey('98765 43210')).toBe('9876543210')
    expect(phoneKey('+91-98765-43210')).toBe('9876543210')
    expect(phoneKey('')).toBe('')
    expect(phoneKey(null)).toBe('')
  })
})

describe('groupDuplicates', () => {
  it('finds same phone written differently, same tax number and same name in one city, each group once', () => {
    const g = groupDuplicates([
      party('a', 'Ramesh', { phone: '98765 43210', city: 'Pune' }),
      party('b', 'Ramesh K', { phone: '+91 9876543210', taxNumber: '27AAAAA0000A1Z5' }),
      party('c', 'Suresh', { taxNumber: '27aaaaa0000a1z5' }),
      party('d', 'Ramesh', { city: 'pune' }),
      party('e', 'Loner', { phone: '111' })
    ])
    expect(g.map((x) => x.reason).sort()).toEqual(['NAME', 'PHONE', 'TAX_NUMBER'])
    expect(g.find((x) => x.reason === 'PHONE')!.parties.map((p) => p.id).sort()).toEqual(['a', 'b'])
    expect(g.find((x) => x.reason === 'TAX_NUMBER')!.parties.map((p) => p.id).sort()).toEqual(['b', 'c'])
    expect(g.find((x) => x.reason === 'NAME')!.parties.map((p) => p.id).sort()).toEqual(['a', 'd'])
  })
  it('the same set of records is reported once, under the first reason', () => {
    const g = groupDuplicates([party('a', 'Ram', { phone: '9876543210', email: 'r@x.com' }), party('b', 'Ram', { phone: '9876543210', email: 'R@x.com' })])
    expect(g).toHaveLength(1)
    expect(g[0].reason).toBe('PHONE')
  })
})

describe('customer checks', () => {
  it('upper-cases the tax number', () => {
    expect(normaliseCustomerIdentifiers({ taxNumber: ' 27aaaaa0000a1z5 ' }).taxNumber).toBe('27AAAAA0000A1Z5')
  })

  it('checks the GSTIN format only for an Indian GST business', async () => {
    vi.mocked(getPrisma).mockReturnValue({ businessProfile: { findFirst: vi.fn().mockResolvedValue({ taxModel: 'GST', country: 'India' }) } } as never)
    expect(await validateCustomerFormats({ taxNumber: 'BAD' })).toMatchObject({ error: { code: 'CUS-009' } })
    expect(await validateCustomerFormats({ taxNumber: '27AAAAA0000A1Z5' })).toBeNull()
    vi.mocked(getPrisma).mockReturnValue({ businessProfile: { findFirst: vi.fn().mockResolvedValue({ taxModel: 'VAT', country: 'Germany' }) } } as never)
    expect(await validateCustomerFormats({ taxNumber: 'DE123456789' })).toBeNull()
  })

  it('refuses a GSTIN or email another customer already has, and says when that customer is archived', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      customer: { findMany: vi.fn().mockResolvedValue([
        { id: '1', customerCode: 'CUS-1', customerName: 'Acme', email: 'a@x.com', taxNumber: '27AAAAA0000A1Z5', isActive: true },
        { id: '2', customerCode: 'CUS-2', customerName: 'Old', email: 'old@x.com', taxNumber: null, isActive: false }
      ]) }
    } as never)
    expect(await checkCustomerUniqueness({ taxNumber: '27aaaaa0000a1z5' })).toMatchObject({ error: { code: 'CUS-006' } })
    expect(await checkCustomerUniqueness({ email: 'OLD@x.com' })).toMatchObject({ error: { code: 'CUS-007', message: expect.stringContaining('archived') } })
    expect(await checkCustomerUniqueness({ taxNumber: '27AAAAA0000A1Z5' }, '1')).toBeNull()
    expect(await checkCustomerUniqueness({ email: 'new@x.com' })).toBeNull()
  })
})
