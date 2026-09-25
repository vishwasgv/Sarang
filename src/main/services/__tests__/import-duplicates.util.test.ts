import { describe, it, expect } from 'vitest'
import { PartyDuplicateIndex } from '../import-duplicates.util'

describe('customer import duplicates', () => {
  const idx = () => {
    const i = new PartyDuplicateIndex('customers')
    i.load([
      { name: 'Acme', phone: '98765 43210', email: 'a@x.com', taxNumber: '27AAAAA0000A1Z5', phoneCounts: true },
      { name: 'Old', phone: '90000 11111', email: 'old@x.com', taxNumber: null, phoneCounts: false }
    ])
    return i
  }

  it('catches the same phone written differently, the same tax number and the same email', () => {
    expect(idx().reason({ phone: '+91 9876543210' })).toContain('Phone')
    expect(idx().reason({ taxNumber: '27aaaaa0000a1z5' })).toContain('Tax number')
    expect(idx().reason({ email: 'A@X.com' })).toContain('Email')
    expect(idx().reason({ phone: '9111122223', email: 'new@x.com', taxNumber: '29ZZZZZ0000Z1Z5' })).toBeNull()
  })

  it('an archived customer keeps its email but its phone may be reused', () => {
    expect(idx().reason({ phone: '90000 11111' })).toBeNull()
    expect(idx().reason({ email: 'old@x.com' })).toContain('Email')
  })

  it('compares later rows of the same file with the earlier ones', () => {
    const i = idx()
    const first = { customerName: 'New', phone: '9222233334', email: 'n@x.com' }
    expect(i.reason(first)).toBeNull()
    i.remember(first)
    expect(i.reason({ customerName: 'Other', phone: '92222 33334' })).toContain('Phone')
    expect(i.reason({ customerName: 'Other', email: 'N@X.com' })).toContain('Email')
  })

  it('customers with the same name are not treated as duplicates', () => {
    expect(idx().reason({ customerName: 'Acme' })).toBeNull()
  })
})

describe('supplier import duplicates', () => {
  it('also compares the supplier name, ignoring case and extra spaces', () => {
    const i = new PartyDuplicateIndex('suppliers')
    i.load([{ name: 'Far  Supplies', phone: null, email: null, taxNumber: null }])
    expect(i.reason({ supplierName: 'far supplies' })).toContain('Supplier')
    expect(i.reason({ supplierName: 'Near Supplies' })).toBeNull()
    i.remember({ supplierName: 'Near Supplies', phone: '9333344445' })
    expect(i.reason({ supplierName: 'Another', phone: '+91 93333 44445' })).toContain('Phone')
  })
})
