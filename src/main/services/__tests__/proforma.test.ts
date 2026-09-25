import { describe, it, expect, vi } from 'vitest'
import { CreateQuotationSchema } from '../../validation/quotation.validation'

describe('proforma invoice document kind', () => {
  it('defaults to a quotation and accepts a proforma, refusing anything else', () => {
    const base = { items: [{ productName: 'X', quantity: 1, unitPrice: 10 }] }
    expect(CreateQuotationSchema.parse(base).documentKind).toBe('QUOTATION')
    expect(CreateQuotationSchema.parse({ ...base, documentKind: 'PROFORMA' }).documentKind).toBe('PROFORMA')
    expect(CreateQuotationSchema.safeParse({ ...base, documentKind: 'INVOICE' }).success).toBe(false)
  })
})
