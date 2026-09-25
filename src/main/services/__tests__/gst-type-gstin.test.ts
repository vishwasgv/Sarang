import { describe, it, expect, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { customerStateOf, supplierStateOf, resolveDocumentGstType } from '../gst-type.util'

describe('document tax presentation uses the GSTIN state when no state is saved (row 3.19)', () => {
  it('customer and supplier without a state but with a GSTIN give the GSTIN state; a saved state wins', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      customer: { findUnique: vi.fn().mockResolvedValueOnce({ state: null, taxNumber: '29AAPFU0939F1ZV' }).mockResolvedValueOnce({ state: 'Goa', taxNumber: '29AAPFU0939F1ZV' }) },
      supplier: { findUnique: vi.fn().mockResolvedValue({ state: '', taxNumber: '27AAPFU0939F1ZV' }) }
    } as never)
    expect(await customerStateOf('c1')).toBe('29')
    expect(await customerStateOf('c1')).toBe('Goa')
    expect(await supplierStateOf('s1')).toBe('27')
  })

  it('a Maharashtra business gets IGST for a Karnataka-GSTIN customer with no saved state, and CGST_SGST for its own state', async () => {
    vi.mocked(getPrisma).mockReturnValue({ businessProfile: { findFirst: vi.fn().mockResolvedValue({ state: 'Maharashtra', taxNumber: null }) } } as never)
    expect(await resolveDocumentGstType(undefined, '29')).toBe('IGST')
    expect(await resolveDocumentGstType(undefined, '27')).toBe('CGST_SGST')
  })

  it('a business with no saved state uses its own GSTIN', async () => {
    vi.mocked(getPrisma).mockReturnValue({ businessProfile: { findFirst: vi.fn().mockResolvedValue({ state: null, taxNumber: '27AAPFU0939F1ZV' }) } } as never)
    expect(await resolveDocumentGstType(undefined, '29')).toBe('IGST')
  })
})
