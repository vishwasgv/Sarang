import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../auth.service', () => ({ getCurrentSession: vi.fn().mockReturnValue({ userId: 'u1' }) }))

import { getPrisma } from '../../database/db'
import {
  calculateEAN13CheckDigit,
  validateEAN13,
  decodeBarcode,
  calculateLooseLineTotal,
  generateBarcode,
  bulkGenerateMissingBarcodes,
  generateWeightEmbeddedLabel,
  getProductByScannedBarcode,
  generateVariantBarcode,
  bulkGenerateMissingVariantBarcodes
} from '../barcode.service'

beforeEach(() => vi.clearAllMocks())

// ─────────────────────────────────────────────────────────────────────────────
// EAN-13 check digit — verified against a known real-world barcode
// (4006381333931, a widely-used EAN-13 test vector) so the test doesn't just
// check the implementation against itself.
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateEAN13CheckDigit', () => {
  it('matches a known real-world EAN-13 check digit', () => {
    expect(calculateEAN13CheckDigit('400638133393')).toBe('1')
  })

  it('computes the check digit for an internally-generated "20"-prefix plain code', () => {
    // Hand-verified: 2*1+0*3+0*1+0*3+0*1+0*3+0*1+0*3+0*1+0*3+0*1+1*3 = 5 → (10-5)%10 = 5
    expect(calculateEAN13CheckDigit('200000000001')).toBe('5')
  })

  it('computes the check digit for a "21"-prefix weight-embedded code', () => {
    // itemCode 00042 + weight 00250 → hand-verified sum 30 → check digit 0
    expect(calculateEAN13CheckDigit('210004200250')).toBe('0')
  })

  it('rejects a non-12-digit input', () => {
    expect(() => calculateEAN13CheckDigit('123')).toThrow()
    expect(() => calculateEAN13CheckDigit('12345678901X')).toThrow()
  })
})

describe('validateEAN13', () => {
  it('accepts a valid real-world EAN-13', () => {
    expect(validateEAN13('4006381333931')).toBe(true)
  })

  it('rejects a corrupted check digit (fat-finger typo)', () => {
    expect(validateEAN13('4006381333930')).toBe(false) // last digit wrong
  })

  it('rejects a transposed-digit typo', () => {
    expect(validateEAN13('4006381339331')).toBe(false) // two digits swapped mid-code
  })

  it('rejects non-13-digit strings without throwing', () => {
    expect(validateEAN13('123')).toBe(false)
    expect(validateEAN13('abcdefghijklm')).toBe(false)
    expect(validateEAN13('')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// decodeBarcode — pure dispatch, the core "no logical errors" surface area
// ─────────────────────────────────────────────────────────────────────────────
describe('decodeBarcode', () => {
  it('decodes a valid "20"-prefix plain code and extracts the item code', () => {
    const result = decodeBarcode('2000000000015')
    expect(result).toEqual({ type: 'PLAIN', itemCode: '0000000001' })
  })

  it('decodes a valid "21"-prefix weight-embedded code and extracts item code + weight', () => {
    const result = decodeBarcode('2100042002500')
    expect(result).toEqual({ type: 'WEIGHT_EMBEDDED', looseItemCode: 42, weightGrams: 250 })
  })

  it('treats a real manufacturer EAN-13 (not our reserved prefix) as EXTERNAL', () => {
    expect(decodeBarcode('4006381333931')).toEqual({ type: 'EXTERNAL' })
  })

  it('treats a "20"/"21"-prefix code with a corrupted checksum as EXTERNAL, not a crash', () => {
    // Same digits as the valid plain-code fixture but with the check digit flipped —
    // must never be trusted just because the prefix matches; the checksum is what
    // proves it's genuinely one of ours.
    expect(decodeBarcode('2000000000010')).toEqual({ type: 'EXTERNAL' })
  })

  it('treats a non-numeric or wrong-length string as EXTERNAL without throwing', () => {
    expect(decodeBarcode('not-a-barcode')).toEqual({ type: 'EXTERNAL' })
    expect(decodeBarcode('123')).toEqual({ type: 'EXTERNAL' })
    expect(decodeBarcode('')).toEqual({ type: 'EXTERNAL' })
  })

  it('treats a 13-digit code with an unreserved prefix as EXTERNAL even if numeric', () => {
    expect(decodeBarcode('9900000000012')).toEqual({ type: 'EXTERNAL' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// calculateLooseLineTotal — the highest-risk area for silent financial bugs
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateLooseLineTotal', () => {
  it('computes a normal case correctly', () => {
    expect(calculateLooseLineTotal(0.25, 80, 2)).toBe(20)
  })

  it('rounds to the configured decimal places, not always 2', () => {
    // 0.333 kg * 33.33/kg = 11.09889 → rounds to 11.1 at 1 decimal place
    expect(calculateLooseLineTotal(0.333, 33.33, 1)).toBe(11.1)
  })

  it('handles a boundary rounding case (exact .5 at the rounding digit)', () => {
    // 0.005 kg * 100/kg = 0.5 → rounds to 1 at 0 decimal places (round-half-up via Math.round)
    expect(calculateLooseLineTotal(0.005, 100, 0)).toBe(1)
  })

  it('rejects zero quantity', () => {
    expect(() => calculateLooseLineTotal(0, 80, 2)).toThrow()
  })

  it('rejects negative quantity', () => {
    expect(() => calculateLooseLineTotal(-0.1, 80, 2)).toThrow()
  })

  it('rejects negative price', () => {
    expect(() => calculateLooseLineTotal(0.25, -80, 2)).toThrow()
  })

  it('allows zero price (e.g. a promotional loose item)', () => {
    expect(calculateLooseLineTotal(0.25, 0, 2)).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// generateBarcode — uniqueness/collision handling
// ─────────────────────────────────────────────────────────────────────────────
function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    product: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      aggregate: vi.fn().mockResolvedValue({ _max: { looseItemCode: null } })
    },
    // Phase 58 §2 — maxPlainItemCode/generateUniquePlainBarcode now scan+check
    // BOTH Product and ProductVariant (shared counter/collision space, see
    // barcode.service.ts's comment) — every test touching plain-code
    // generation needs this present, even ones only about Product.
    productVariant: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({})
    },
    labelPrintLog: { create: vi.fn().mockResolvedValue({}), findFirst: vi.fn().mockResolvedValue(null) },
    ...overrides
  }
}
function makeDb(tx: ReturnType<typeof makeTx>) {
  return {
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
    // Needed by getDecimalPlaces(), called after the transaction commits when
    // computing a weight-embedded label's printable price.
    setting: { findUnique: vi.fn().mockResolvedValue({ settingValue: '2' }) }
  }
}

describe('generateBarcode', () => {
  it('generates and assigns a unique barcode to a product with none', async () => {
    // Same distinct-purpose findUnique calls as bulkGenerateMissingBarcodes: fetch-by-id
    // first, collision-check-by-barcode second. Differentiate by which key is present.
    const findUnique = vi.fn().mockImplementation(({ where }: { where: { id?: string; barcode?: string } }) => {
      if (where.id) return Promise.resolve({ id: 'p1', barcode: null })
      return Promise.resolve(null) // no collision on the candidate
    })
    const tx = makeTx({
      product: {
        findUnique,
        findMany: vi.fn().mockResolvedValue([]), // no existing "20"-prefix codes → starts at 1
        update: vi.fn().mockResolvedValue({})
      }
    })
    vi.mocked(getPrisma).mockReturnValue(makeDb(tx) as never)

    const result = await generateBarcode('p1')

    expect(result.success).toBe(true)
    const barcode = (result.data as { barcode: string }).barcode
    expect(barcode).toMatch(/^20\d{11}$/)
    expect(validateEAN13(barcode)).toBe(true)
    expect(tx.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { barcode, barcodeSource: 'GENERATED' } })
  })

  it('refuses to overwrite a product that already has a barcode', async () => {
    const tx = makeTx({ product: { findUnique: vi.fn().mockResolvedValue({ id: 'p1', barcode: '4006381333931' }), findMany: vi.fn(), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(makeDb(tx) as never)

    const result = await generateBarcode('p1')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('BCD-004')
  })

  it('returns PRD-001 for a non-existent product', async () => {
    const tx = makeTx({ product: { findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn(), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(makeDb(tx) as never)

    const result = await generateBarcode('ghost')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('PRD-001')
  })

  it('increments past the highest existing "20"-prefix code rather than colliding', async () => {
    const tx = makeTx({
      product: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({ id: 'p2', barcode: null }) // the product being generated for
          .mockResolvedValueOnce(null), // collision check on the candidate — no clash
        findMany: vi.fn().mockResolvedValue([{ barcode: '2000000000015' }, { barcode: '2000000000237' }]),
        update: vi.fn().mockResolvedValue({})
      }
    })
    vi.mocked(getPrisma).mockReturnValue(makeDb(tx) as never)

    const result = await generateBarcode('p2')

    expect(result.success).toBe(true)
    const barcode = (result.data as { barcode: string }).barcode
    // Highest existing embedded code was 23 (from 2000000000237) → next must be 24, zero-padded
    expect(barcode.slice(2, 12)).toBe('0000000024')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// bulkGenerateMissingBarcodes — idempotency, never overwrites
// ─────────────────────────────────────────────────────────────────────────────
describe('bulkGenerateMissingBarcodes', () => {
  it('generates for exactly the products missing a barcode, skipping the rest', async () => {
    // findUnique is called for two different purposes in this code path — the
    // "still missing a barcode?" re-check (keyed by id) and the "does this
    // candidate barcode already exist?" collision check (keyed by barcode) —
    // a single unconditional mock would make the collision check look like a
    // clash on every attempt. Differentiate by which key is present.
    const findUnique = vi.fn().mockImplementation(({ where }: { where: { id?: string; barcode?: string } }) => {
      if (where.id) return Promise.resolve({ barcode: null }) // still missing → proceed
      return Promise.resolve(null) // no collision on the candidate
    })
    const tx = makeTx({
      product: {
        findUnique,
        findMany: vi.fn().mockResolvedValue([]), // no existing "20"-prefix codes yet
        update: vi.fn().mockResolvedValue({})
      }
    })
    const db = {
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]) }, // 2 products missing barcodes
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx))
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await bulkGenerateMissingBarcodes()

    expect(result.success).toBe(true)
    expect((result.data as { generated: number; totalMissing: number }).generated).toBe(2)
    expect((result.data as { generated: number; totalMissing: number }).totalMissing).toBe(2)
    expect(tx.product.update).toHaveBeenCalledTimes(2)
  })

  it('is idempotent — running it again with nothing missing generates zero and does not error', async () => {
    const db = {
      product: { findMany: vi.fn().mockResolvedValue([]) }, // nothing missing this time
      $transaction: vi.fn()
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await bulkGenerateMissingBarcodes()

    expect(result.success).toBe(true)
    expect((result.data as { generated: number }).generated).toBe(0)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('skips a product that already got a barcode from a concurrent action mid-batch', async () => {
    const tx = makeTx({
      product: {
        // Re-check inside the transaction finds it's no longer missing — must skip, not overwrite.
        findUnique: vi.fn().mockResolvedValue({ barcode: '4006381333931' }),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({})
      }
    })
    const db = {
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'a' }]) },
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx))
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await bulkGenerateMissingBarcodes()

    expect(result.success).toBe(true)
    expect((result.data as { generated: number }).generated).toBe(0)
    expect(tx.product.update).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 58 §2 — Clothing/Footwear variant barcode generation. Mirrors
// generateBarcode/bulkGenerateMissingBarcodes' own test coverage, plus a
// dedicated test proving the shared counter/collision space actually works
// cross-table (the whole reason maxPlainItemCode/generateUniquePlainBarcode
// were generalized).
// ─────────────────────────────────────────────────────────────────────────────
describe('generateVariantBarcode', () => {
  it('generates and assigns a unique barcode to a variant with none', async () => {
    const findUnique = vi.fn().mockImplementation(({ where }: { where: { id?: string; barcode?: string } }) => {
      if (where.id) return Promise.resolve({ id: 'v1', barcode: null })
      return Promise.resolve(null)
    })
    const tx = makeTx({
      productVariant: {
        findUnique,
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({})
      }
    })
    vi.mocked(getPrisma).mockReturnValue(makeDb(tx) as never)

    const result = await generateVariantBarcode('v1')

    expect(result.success).toBe(true)
    const barcode = (result.data as { barcode: string }).barcode
    expect(barcode).toMatch(/^20\d{11}$/)
    expect(validateEAN13(barcode)).toBe(true)
    expect(tx.productVariant.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { barcode, barcodeSource: 'GENERATED' } })
  })

  it('refuses to overwrite a variant that already has a barcode', async () => {
    const tx = makeTx({ productVariant: { findUnique: vi.fn().mockResolvedValue({ id: 'v1', barcode: '4006381333931' }), findMany: vi.fn(), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(makeDb(tx) as never)

    const result = await generateVariantBarcode('v1')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('BCD-004')
  })

  it('returns VAR-001 for a non-existent variant', async () => {
    const tx = makeTx({ productVariant: { findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn(), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(makeDb(tx) as never)

    const result = await generateVariantBarcode('ghost')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAR-001')
  })

  // The core guarantee this whole refactor exists for: a variant's generated
  // barcode must never collide with a PRODUCT's barcode, even though they're
  // two independently-unique-constrained columns in different tables.
  it('shares the counter/collision space with Product — starts past the highest existing code in EITHER table', async () => {
    const findUnique = vi.fn()
      .mockResolvedValueOnce({ id: 'v1', barcode: null }) // the variant being generated for
      .mockResolvedValueOnce(null) // collision check on the candidate — no clash
    const tx = makeTx({
      product: {
        findUnique: vi.fn(), update: vi.fn(), aggregate: vi.fn(),
        findMany: vi.fn().mockResolvedValue([{ barcode: '2000000000015' }]) // Product's highest is 1
      },
      productVariant: {
        findUnique,
        findMany: vi.fn().mockResolvedValue([{ barcode: '2000000000237' }]), // a DIFFERENT variant's highest is 23
        update: vi.fn().mockResolvedValue({})
      }
    })
    vi.mocked(getPrisma).mockReturnValue(makeDb(tx) as never)

    const result = await generateVariantBarcode('v1')

    expect(result.success).toBe(true)
    const barcode = (result.data as { barcode: string }).barcode
    // Must start past 23 (the higher of the two tables' max), not past 1
    // (Product's own max) — proves the two tables share one counter.
    expect(barcode.slice(2, 12)).toBe('0000000024')
    // And the candidate is checked against BOTH tables before being accepted.
    expect(tx.product.findUnique).toHaveBeenCalledWith({ where: { barcode } })
    expect(findUnique).toHaveBeenCalledWith({ where: { barcode } })
  })
})

describe('bulkGenerateMissingVariantBarcodes', () => {
  it('generates for exactly the variants of one product missing a barcode, skipping the rest', async () => {
    const findUnique = vi.fn().mockImplementation(({ where }: { where: { id?: string; barcode?: string } }) => {
      if (where.id) return Promise.resolve({ barcode: null })
      return Promise.resolve(null)
    })
    const tx = makeTx({
      productVariant: {
        findUnique,
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({})
      }
    })
    const db = {
      productVariant: { findMany: vi.fn().mockResolvedValue([{ id: 'v1' }, { id: 'v2' }]) },
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx))
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await bulkGenerateMissingVariantBarcodes('p1')

    expect(result.success).toBe(true)
    expect((result.data as { generated: number; totalMissing: number }).generated).toBe(2)
    expect(tx.productVariant.update).toHaveBeenCalledTimes(2)
    // Scoped to the one product's variants only — not every variant in the DB.
    expect(db.productVariant.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { productId: 'p1', barcode: null, isActive: true } }))
  })

  it('is idempotent — running it again with nothing missing generates zero and does not error', async () => {
    const db = {
      productVariant: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn()
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await bulkGenerateMissingVariantBarcodes('p1')

    expect(result.success).toBe(true)
    expect((result.data as { generated: number }).generated).toBe(0)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('skips a variant that already got a barcode from a concurrent action mid-batch', async () => {
    const tx = makeTx({
      productVariant: {
        findUnique: vi.fn().mockResolvedValue({ barcode: '4006381333931' }),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({})
      }
    })
    const db = {
      productVariant: { findMany: vi.fn().mockResolvedValue([{ id: 'v1' }]) },
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx))
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await bulkGenerateMissingVariantBarcodes('p1')

    expect(result.success).toBe(true)
    expect((result.data as { generated: number }).generated).toBe(0)
    expect(tx.productVariant.update).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// generateWeightEmbeddedLabel
// ─────────────────────────────────────────────────────────────────────────────
describe('generateWeightEmbeddedLabel', () => {
  it('rejects a product that is not configured for loose billing', async () => {
    const tx = makeTx({ product: { findUnique: vi.fn().mockResolvedValue({ id: 'p1', sellByWeight: false }), findMany: vi.fn(), update: vi.fn(), aggregate: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(makeDb(tx) as never)

    const result = await generateWeightEmbeddedLabel('p1', 250)

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('BCD-007')
  })

  it('rejects a loose product with no price-per-unit set', async () => {
    const tx = makeTx({ product: { findUnique: vi.fn().mockResolvedValue({ id: 'p1', sellByWeight: true, pricePerWeightUnit: null }), findMany: vi.fn(), update: vi.fn(), aggregate: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(makeDb(tx) as never)

    const result = await generateWeightEmbeddedLabel('p1', 250)

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('BCD-008')
  })

  it('rejects zero or negative weight before touching the database', async () => {
    const resultZero = await generateWeightEmbeddedLabel('p1', 0)
    const resultNeg = await generateWeightEmbeddedLabel('p1', -5)
    expect(resultZero.success).toBe(false)
    expect(resultNeg.success).toBe(false)
    expect(getPrisma).not.toHaveBeenCalled()
  })

  it('rejects weight over the 99,999g label capacity', async () => {
    const result = await generateWeightEmbeddedLabel('p1', 100_000)
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('BCD-006')
  })

  it('rejects a sub-gram weight that would round away to zero in the encoded barcode', async () => {
    // 0.4g rounds to 0 under Math.round — must be rejected before encoding,
    // not silently accepted and printed as a physically meaningless label.
    const result = await generateWeightEmbeddedLabel('p1', 0.4)
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('BCD-006')
    expect(getPrisma).not.toHaveBeenCalled()
  })

  it('accepts a weight that rounds up to exactly 1 gram', async () => {
    const tx = makeTx({
      product: {
        findUnique: vi.fn().mockResolvedValue({ id: 'p1', sellByWeight: true, pricePerWeightUnit: 80, weightUnit: 'kg', looseItemCode: 5 }),
        findMany: vi.fn(), update: vi.fn().mockResolvedValue({}), aggregate: vi.fn()
      }
    })
    vi.mocked(getPrisma).mockReturnValue(makeDb(tx) as never)

    const result = await generateWeightEmbeddedLabel('p1', 0.6) // rounds to 1

    expect(result.success).toBe(true)
    expect((result.data as { barcode: string }).barcode.slice(7, 12)).toBe('00001')
  })

  it('assigns a looseItemCode on first use and reuses it on subsequent prints for the same product', async () => {
    const tx = makeTx({
      product: {
        findUnique: vi.fn().mockResolvedValue({ id: 'p1', sellByWeight: true, pricePerWeightUnit: 80, weightUnit: 'kg', looseItemCode: null }),
        findMany: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
        aggregate: vi.fn().mockResolvedValue({ _max: { looseItemCode: 41 } })
      }
    })
    vi.mocked(getPrisma).mockReturnValue(makeDb(tx) as never)

    const result = await generateWeightEmbeddedLabel('p1', 250)

    expect(result.success).toBe(true)
    const barcode = (result.data as { barcode: string }).barcode
    expect(barcode.slice(0, 2)).toBe('21')
    expect(barcode.slice(2, 7)).toBe('00042') // 41 + 1
    expect(barcode.slice(7, 12)).toBe('00250')
    expect(validateEAN13(barcode)).toBe(true)
    expect(tx.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { looseItemCode: 42 } })
    expect(tx.labelPrintLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ productId: 'p1', weightGrams: 250, pricePerWeightUnitAtPrint: 80, weightUnitAtPrint: 'kg' })
    }))
  })

  it('does not reassign looseItemCode if the product already has one', async () => {
    const tx = makeTx({
      product: {
        findUnique: vi.fn().mockResolvedValue({ id: 'p1', sellByWeight: true, pricePerWeightUnit: 80, weightUnit: 'kg', looseItemCode: 7 }),
        findMany: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
        aggregate: vi.fn()
      }
    })
    vi.mocked(getPrisma).mockReturnValue(makeDb(tx) as never)

    const result = await generateWeightEmbeddedLabel('p1', 500)

    expect(result.success).toBe(true)
    const barcode = (result.data as { barcode: string }).barcode
    expect(barcode.slice(2, 7)).toBe('00007')
    // looseItemCode update should NOT be called since it already had one — only labelPrintLog.create
    expect(tx.product.update).not.toHaveBeenCalled()
  })

  // Regression test for a real bug caught in final independent review: the
  // frontend used to hardcode weightGrams/1000 to compute the printed price,
  // which is correct for kg/L (both map to 1000 in GRAMS_PER_UNIT) but silently
  // 1000x-undercharged the printed label for any product priced per gram or
  // per millilitre (g/mL both map to 1 in GRAMS_PER_UNIT). The fix moves this
  // computation into the service (the one place that owns GRAMS_PER_UNIT) so
  // the frontend can no longer duplicate — and get wrong — the conversion.
  it('computes the correct price for a product priced per gram, not divided by 1000', async () => {
    const tx = makeTx({
      product: {
        findUnique: vi.fn().mockResolvedValue({ id: 'p1', sellByWeight: true, pricePerWeightUnit: 500, weightUnit: 'g', looseItemCode: 10 }),
        findMany: vi.fn(), update: vi.fn().mockResolvedValue({}), aggregate: vi.fn()
      }
    })
    vi.mocked(getPrisma).mockReturnValue(makeDb(tx) as never)

    // Saffron-style product: ₹500/g, weigh 5g → must charge/print ₹2500, not ₹2.50.
    const result = await generateWeightEmbeddedLabel('p1', 5)

    expect(result.success).toBe(true)
    const data = result.data as { quantityInSellUnit: number; weightUnit: string; preTaxAmount: number }
    expect(data.weightUnit).toBe('g')
    expect(data.quantityInSellUnit).toBe(5) // 5g / 1 (g maps to 1 in GRAMS_PER_UNIT), NOT 5/1000
    expect(data.preTaxAmount).toBe(2500) // 5 * 500, not (5/1000)*500
  })

  // Reprint-at-changed-price mitigation: since the barcode is deterministic
  // (same product + same weight = same barcode text, always), an old physical
  // label can't be told apart from a reprint by scanning alone — the only
  // defense is warning whoever is printing right now, while they can still
  // remove the stale one from the shelf.
  it('flags reprintPriceChanged when a prior label for the same product+weight was printed at a different price', async () => {
    const tx = makeTx({
      product: {
        findUnique: vi.fn().mockResolvedValue({ id: 'p1', sellByWeight: true, pricePerWeightUnit: 90, weightUnit: 'kg', looseItemCode: 10 }),
        findMany: vi.fn(), update: vi.fn().mockResolvedValue({}), aggregate: vi.fn()
      },
      labelPrintLog: {
        create: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue({ pricePerWeightUnitAtPrint: 80 }) // prior print was at ₹80/kg, now ₹90/kg
      }
    })
    vi.mocked(getPrisma).mockReturnValue(makeDb(tx) as never)

    const result = await generateWeightEmbeddedLabel('p1', 250)

    expect(result.success).toBe(true)
    expect((result.data as { reprintPriceChanged: boolean }).reprintPriceChanged).toBe(true)
  })

  it('does not flag reprintPriceChanged when the prior label at this exact product+weight was printed at the same price', async () => {
    const tx = makeTx({
      product: {
        findUnique: vi.fn().mockResolvedValue({ id: 'p1', sellByWeight: true, pricePerWeightUnit: 80, weightUnit: 'kg', looseItemCode: 10 }),
        findMany: vi.fn(), update: vi.fn().mockResolvedValue({}), aggregate: vi.fn()
      },
      labelPrintLog: {
        create: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue({ pricePerWeightUnitAtPrint: 80 })
      }
    })
    vi.mocked(getPrisma).mockReturnValue(makeDb(tx) as never)

    const result = await generateWeightEmbeddedLabel('p1', 250)

    expect(result.success).toBe(true)
    expect((result.data as { reprintPriceChanged: boolean }).reprintPriceChanged).toBe(false)
  })

  it('does not flag reprintPriceChanged for a genuinely first-time print (no prior label at all)', async () => {
    const tx = makeTx({
      product: {
        findUnique: vi.fn().mockResolvedValue({ id: 'p1', sellByWeight: true, pricePerWeightUnit: 80, weightUnit: 'kg', looseItemCode: 10 }),
        findMany: vi.fn(), update: vi.fn().mockResolvedValue({}), aggregate: vi.fn()
      }
      // labelPrintLog.findFirst defaults to null via makeTx — no prior label exists.
    })
    vi.mocked(getPrisma).mockReturnValue(makeDb(tx) as never)

    const result = await generateWeightEmbeddedLabel('p1', 250)

    expect(result.success).toBe(true)
    expect((result.data as { reprintPriceChanged: boolean }).reprintPriceChanged).toBe(false)
  })

  it('computes the correct price for a product priced per millilitre', async () => {
    const tx = makeTx({
      product: {
        findUnique: vi.fn().mockResolvedValue({ id: 'p1', sellByWeight: true, pricePerWeightUnit: 10, weightUnit: 'mL', looseItemCode: 10 }),
        findMany: vi.fn(), update: vi.fn().mockResolvedValue({}), aggregate: vi.fn()
      }
    })
    vi.mocked(getPrisma).mockReturnValue(makeDb(tx) as never)

    const result = await generateWeightEmbeddedLabel('p1', 200)

    expect(result.success).toBe(true)
    const data = result.data as { quantityInSellUnit: number; preTaxAmount: number }
    expect(data.quantityInSellUnit).toBe(200) // mL maps to 1, not 1000
    expect(data.preTaxAmount).toBe(2000) // 200 * 10
  })

  it('still computes correctly for kg (divide by 1000, unlike g/mL)', async () => {
    const tx = makeTx({
      product: {
        findUnique: vi.fn().mockResolvedValue({ id: 'p1', sellByWeight: true, pricePerWeightUnit: 80, weightUnit: 'kg', looseItemCode: 10 }),
        findMany: vi.fn(), update: vi.fn().mockResolvedValue({}), aggregate: vi.fn()
      }
    })
    vi.mocked(getPrisma).mockReturnValue(makeDb(tx) as never)

    const result = await generateWeightEmbeddedLabel('p1', 250)

    expect(result.success).toBe(true)
    const data = result.data as { quantityInSellUnit: number; preTaxAmount: number }
    expect(data.quantityInSellUnit).toBe(0.25) // 250g / 1000
    expect(data.preTaxAmount).toBe(20) // 0.25 * 80
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getProductByScannedBarcode — stale-price detection (Section 3's resolved rule:
// charge the embedded price, warn if it no longer matches current config)
// ─────────────────────────────────────────────────────────────────────────────
describe('getProductByScannedBarcode', () => {
  it('looks up a plain barcode by exact match', async () => {
    const db = {
      product: { findFirst: vi.fn().mockResolvedValue({ id: 'p1', productName: 'Widget', barcode: '4006381333931' }) }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getProductByScannedBarcode('4006381333931')

    expect(result.success).toBe(true)
    expect((result.data as { kind: string }).kind).toBe('PLAIN')
  })

  it('charges the price embedded in the label and flags it stale when the product price has since changed', async () => {
    const db = {
      product: { findFirst: vi.fn().mockResolvedValue({ id: 'p1', looseItemCode: 42, pricePerWeightUnit: 90, weightUnit: 'kg' }) },
      labelPrintLog: { findFirst: vi.fn().mockResolvedValue({ pricePerWeightUnitAtPrint: 80, weightUnitAtPrint: 'kg' }) },
      setting: { findUnique: vi.fn().mockResolvedValue({ settingValue: '2' }) }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getProductByScannedBarcode('2100042002500') // 250g

    expect(result.success).toBe(true)
    const data = result.data as { kind: string; preTaxAmount: number; priceIsStale: boolean; pricePerWeightUnitAtPrint: number; currentPricePerWeightUnit: number }
    expect(data.kind).toBe('WEIGHT_EMBEDDED')
    expect(data.pricePerWeightUnitAtPrint).toBe(80) // embedded/printed price, not the current 90
    expect(data.preTaxAmount).toBe(20) // 0.25kg * 80 = 20, charged at the printed price
    expect(data.priceIsStale).toBe(true)
    expect(data.currentPricePerWeightUnit).toBe(90)
  })

  it('does not flag stale pricing when the price has not changed since printing', async () => {
    const db = {
      product: { findFirst: vi.fn().mockResolvedValue({ id: 'p1', looseItemCode: 42, pricePerWeightUnit: 80, weightUnit: 'kg' }) },
      labelPrintLog: { findFirst: vi.fn().mockResolvedValue({ pricePerWeightUnitAtPrint: 80, weightUnitAtPrint: 'kg' }) },
      setting: { findUnique: vi.fn().mockResolvedValue({ settingValue: '2' }) }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getProductByScannedBarcode('2100042002500')

    expect((result.data as { priceIsStale: boolean }).priceIsStale).toBe(false)
  })

  it('includes inventory on the WEIGHT_EMBEDDED product lookup so the POS cart shows real stock, not a false zero', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'p1', looseItemCode: 42, pricePerWeightUnit: 80, weightUnit: 'kg', inventory: { quantity: 12.5 } })
    const db = {
      product: { findFirst },
      labelPrintLog: { findFirst: vi.fn().mockResolvedValue(null) },
      setting: { findUnique: vi.fn().mockResolvedValue({ settingValue: '2' }) }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getProductByScannedBarcode('2100042002500')

    expect(result.success).toBe(true)
    expect((result.data as { product: { inventory: { quantity: number } } }).product.inventory.quantity).toBe(12.5)
    // The lookup must actually request inventory — a query that returns it only
    // because the mock happens to include it would pass without proving the fix.
    expect(findFirst.mock.calls[0][0]).toMatchObject({ include: { inventory: expect.anything() } })
  })

  it('treats a weight-embedded code that decodes to zero grams as not-found rather than throwing a generic error', async () => {
    const db = { product: { findFirst: vi.fn() } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // "21" + itemCode 00042 + weight 00000 + valid check digit
    const zeroWeightCode = '21' + '00042' + '00000'
    const checkDigit = calculateEAN13CheckDigit(zeroWeightCode)
    const result = await getProductByScannedBarcode(zeroWeightCode + checkDigit)

    expect(result.success).toBe(true)
    expect(result.data).toBeNull()
    // Must short-circuit before ever touching the database for a meaningless scan.
    expect(db.product.findFirst).not.toHaveBeenCalled()
  })

  it('returns null data for a well-formed but unrecognized external barcode', async () => {
    const db = { product: { findFirst: vi.fn().mockResolvedValue(null) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getProductByScannedBarcode('4006381333931')

    expect(result.success).toBe(true)
    expect(result.data).toBeNull()
  })
})
