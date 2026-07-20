import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { getCurrentSession } from './auth.service'
import { ServiceError } from '../errors/service-error'
import type { ApiResponse } from '../ipc/channels'
import type { Prisma } from '@prisma/client'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 38 — Barcode System + Loose/Weight Billing
//
// Internally generated barcodes are always valid 13-digit EAN-13 (any ordinary
// scanner reads them with zero special configuration) but use a reserved prefix
// range real GS1-issued manufacturer barcodes never assign for purchased retail
// goods — the same principle real in-store/restricted-circulation barcodes use.
// This guarantees a scanned-in manufacturer barcode can never collide with one
// this app generated, without needing a licensed GS1 company prefix.
//
//   "20" + 10-digit sequential internal product code + 1 check digit  → plain
//   "21" + 5-digit product's looseItemCode + 5-digit weight-in-grams + 1 check digit → weight-embedded
// ─────────────────────────────────────────────────────────────────────────────

const PLAIN_PREFIX = '20'
const WEIGHT_PREFIX = '21'
const GRAMS_PER_UNIT: Record<string, number> = { kg: 1000, g: 1, L: 1000, mL: 1 }

// Standard EAN-13 check digit algorithm: alternating x1/x3 weights on the first
// 12 digits, right to left, check digit makes the total a multiple of 10.
export function calculateEAN13CheckDigit(first12Digits: string): string {
  if (!/^\d{12}$/.test(first12Digits)) {
    throw new ServiceError('BCD-001', 'Invalid barcode payload — expected 12 digits before the check digit.')
  }
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = Number(first12Digits[i])
    // Position from the right (1-indexed) determines the x1/x3 weight.
    const weight = (12 - i) % 2 === 0 ? 1 : 3
    sum += digit * weight
  }
  const checkDigit = (10 - (sum % 10)) % 10
  return String(checkDigit)
}

export function validateEAN13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false
  return calculateEAN13CheckDigit(code.slice(0, 12)) === code[12]
}

export type DecodedBarcode =
  | { type: 'PLAIN'; itemCode: string }
  | { type: 'WEIGHT_EMBEDDED'; looseItemCode: number; weightGrams: number }
  | { type: 'EXTERNAL' } // not one of ours — real manufacturer code, or manually entered

// Pure, DB-free dispatch — deliberately separated from lookup logic so both
// halves (which code shape is this? / what product does it point to?) are
// independently unit-testable.
export function decodeBarcode(raw: string): DecodedBarcode {
  if (!/^\d{13}$/.test(raw)) return { type: 'EXTERNAL' }
  const prefix = raw.slice(0, 2)
  if (prefix !== PLAIN_PREFIX && prefix !== WEIGHT_PREFIX) return { type: 'EXTERNAL' }
  if (!validateEAN13(raw)) return { type: 'EXTERNAL' } // malformed/corrupted — never trust a bad checksum, even with our prefix

  if (prefix === PLAIN_PREFIX) {
    return { type: 'PLAIN', itemCode: raw.slice(2, 12) }
  }
  return {
    type: 'WEIGHT_EMBEDDED',
    looseItemCode: Number(raw.slice(2, 7)),
    weightGrams: Number(raw.slice(7, 12))
  }
}

function buildEAN13(prefix: string, body10: string): string {
  const first12 = prefix + body10
  return first12 + calculateEAN13CheckDigit(first12)
}

// Only considers codes this app actually generated (barcodeSource: 'GENERATED'),
// not any manually-entered barcode that happens to start with "20" — a shop
// migrating from a prior weighing-scale/PLU system could plausibly have a
// legacy "20…"-prefixed manufacturer/in-store code typed into a product's
// barcode field, and folding that into the sequence would either corrupt the
// numbering (jumping far ahead) or spuriously trip the capacity cap.
//
// Phase 58 §2 — Clothing/Footwear variant barcode generation shares this SAME
// counter/collision space with Product, not a separate one: Product.barcode
// and ProductVariant.barcode are two independently-unique-constrained
// columns in different tables, so nothing at the DB level stops the same
// 13-digit string being assigned to a Product AND an unrelated Product's
// variant. Scanning/checking against BOTH tables here (and in
// generateUniquePlainBarcode below) makes that collision structurally
// impossible instead of merely unlikely.
async function maxPlainItemCode(tx?: Prisma.TransactionClient): Promise<number> {
  const db = tx ?? getPrisma()
  const [products, variants] = await Promise.all([
    db.product.findMany({
      where: { barcode: { startsWith: PLAIN_PREFIX }, barcodeSource: 'GENERATED' },
      select: { barcode: true }
    }),
    db.productVariant.findMany({
      where: { barcode: { startsWith: PLAIN_PREFIX }, barcodeSource: 'GENERATED' },
      select: { barcode: true }
    })
  ])
  let max = 0
  for (const row of [...products, ...variants]) {
    if (!row.barcode || row.barcode.length !== 13) continue
    const n = parseInt(row.barcode.slice(2, 12), 10)
    if (!isNaN(n)) max = Math.max(max, n)
  }
  return max
}

// Shared by generateBarcode/bulkGenerateMissingBarcodes and their variant
// counterparts below (previously two copies of the same 8-line retry loop).
// Takes a mutable in-memory counter rather than re-deriving the max from a
// table scan on every attempt — the caller computes the starting point once
// (via maxPlainItemCode) and this function only does cheap, indexed collision
// checks from there. Bulk backfill on a large catalog previously re-scanned
// the whole barcoded-product table on every retry attempt of every product,
// effectively O(n²) work. Checks BOTH Product and ProductVariant for a
// collision — see maxPlainItemCode's comment for why this must be shared.
async function generateUniquePlainBarcode(tx: Prisma.TransactionClient, counter: { value: number }): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    counter.value += 1
    if (counter.value > 9_999_999_999) {
      throw new ServiceError('BCD-002', 'Internal barcode capacity reached. Contact support.')
    }
    const candidate = buildEAN13(PLAIN_PREFIX, String(counter.value).padStart(10, '0'))
    const [clashProduct, clashVariant] = await Promise.all([
      tx.product.findUnique({ where: { barcode: candidate } }),
      tx.productVariant.findUnique({ where: { barcode: candidate } })
    ])
    if (!clashProduct && !clashVariant) return candidate
  }
  throw new ServiceError('BCD-005', 'Could not generate a unique barcode. Try again.')
}

async function nextLooseItemCode(tx?: Prisma.TransactionClient): Promise<number> {
  const client = tx ?? getPrisma()
  const max = await client.product.aggregate({ _max: { looseItemCode: true } })
  const next = (max._max.looseItemCode ?? 0) + 1
  if (next > 99_999) {
    throw new ServiceError('BCD-003', 'Loose-billed product capacity reached (99,999 max). Contact support.')
  }
  return next
}

// ─────────────────────────────────────────────────────────────────────────────
// Barcode generation
// ─────────────────────────────────────────────────────────────────────────────

export async function generateBarcode(productId: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const barcode = await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } })
      if (!product) throw new ServiceError('PRD-001', 'Product not found.')
      if (product.barcode) throw new ServiceError('BCD-004', 'This product already has a barcode.')

      // The DB unique constraint on Product.barcode is the actual uniqueness
      // guarantee (already present pre-Phase-38) — generateUniquePlainBarcode's
      // collision check just gives a clean error path instead of a raw
      // constraint-violation exception.
      const counter = { value: await maxPlainItemCode(tx) }
      const code = await generateUniquePlainBarcode(tx, counter)

      await tx.product.update({ where: { id: productId }, data: { barcode: code, barcodeSource: 'GENERATED' } })
      return code
    })

    await logAction({ userId: getCurrentSession()?.userId, action: 'BARCODE_GENERATED', entityType: 'Product', entityId: productId, newValue: { barcode } })
    return { success: true, data: { barcode } }
  } catch (err) {
    if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function bulkGenerateMissingBarcodes(): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const missing = await db.product.findMany({ where: { barcode: null, isActive: true }, select: { id: true } })

    let generated = 0
    const BATCH_SIZE = 200
    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE)
      await db.$transaction(async (tx) => {
        // Computed once per batch, not once per product/attempt — see
        // generateUniquePlainBarcode's comment for why this matters at scale.
        const counter = { value: await maxPlainItemCode(tx) }
        for (const { id } of batch) {
          // Re-check inside the transaction — a product could have been given a
          // barcode by a concurrent action between the initial query and now.
          const current = await tx.product.findUnique({ where: { id }, select: { barcode: true } })
          if (current?.barcode) continue

          let code: string
          try {
            code = await generateUniquePlainBarcode(tx, counter)
          } catch {
            continue // skip this one, don't fail the whole batch — surfaced via the count being lower than expected
          }

          await tx.product.update({ where: { id }, data: { barcode: code, barcodeSource: 'GENERATED' } })
          generated++
        }
      })
    }

    await logAction({ userId: getCurrentSession()?.userId, action: 'BARCODES_BULK_GENERATED', entityType: 'Product', newValue: { count: generated } })
    return { success: true, data: { generated, totalMissing: missing.length } }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 58 §2 — Clothing/Footwear variant-aware barcode generation. Mirrors
// generateBarcode/bulkGenerateMissingBarcodes exactly, just targeting
// ProductVariant instead of Product, sharing the same counter/collision
// space (see maxPlainItemCode's comment above) so a variant's barcode can
// never collide with any product's — or any other variant's — barcode.
// ─────────────────────────────────────────────────────────────────────────────

export async function generateVariantBarcode(variantId: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const barcode = await db.$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({ where: { id: variantId } })
      if (!variant) throw new ServiceError('VAR-001', 'Variant not found.')
      if (variant.barcode) throw new ServiceError('BCD-004', 'This variant already has a barcode.')

      const counter = { value: await maxPlainItemCode(tx) }
      const code = await generateUniquePlainBarcode(tx, counter)

      await tx.productVariant.update({ where: { id: variantId }, data: { barcode: code, barcodeSource: 'GENERATED' } })
      return code
    })

    await logAction({ userId: getCurrentSession()?.userId, action: 'VARIANT_BARCODE_GENERATED', entityType: 'ProductVariant', entityId: variantId, newValue: { barcode } })
    return { success: true, data: { barcode } }
  } catch (err) {
    if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function bulkGenerateMissingVariantBarcodes(productId: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const missing = await db.productVariant.findMany({ where: { productId, barcode: null, isActive: true }, select: { id: true } })

    let generated = 0
    const BATCH_SIZE = 200
    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE)
      await db.$transaction(async (tx) => {
        const counter = { value: await maxPlainItemCode(tx) }
        for (const { id } of batch) {
          // Re-check inside the transaction — a variant could have been given a
          // barcode by a concurrent action between the initial query and now.
          const current = await tx.productVariant.findUnique({ where: { id }, select: { barcode: true } })
          if (current?.barcode) continue

          let code: string
          try {
            code = await generateUniquePlainBarcode(tx, counter)
          } catch {
            continue // skip this one, don't fail the whole batch — surfaced via the count being lower than expected
          }

          await tx.productVariant.update({ where: { id }, data: { barcode: code, barcodeSource: 'GENERATED' } })
          generated++
        }
      })
    }

    await logAction({ userId: getCurrentSession()?.userId, action: 'VARIANT_BARCODES_BULK_GENERATED', entityType: 'Product', entityId: productId, newValue: { count: generated } })
    return { success: true, data: { generated, totalMissing: missing.length } }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scanning / lookup
// ─────────────────────────────────────────────────────────────────────────────

export async function getProductByScannedBarcode(raw: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const decoded = decodeBarcode(raw)

    if (decoded.type === 'EXTERNAL') {
      const product = await db.product.findFirst({
        where: { barcode: raw, isActive: true },
        include: { category: { select: { id: true, name: true } }, inventory: { select: { quantity: true } } }
      })
      return { success: true, data: product ? { kind: 'PLAIN', product } : null }
    }

    if (decoded.type === 'PLAIN') {
      const product = await db.product.findFirst({
        where: { barcode: raw, isActive: true },
        include: { category: { select: { id: true, name: true } }, inventory: { select: { quantity: true } } }
      })
      return { success: true, data: product ? { kind: 'PLAIN', product } : null }
    }

    // WEIGHT_EMBEDDED
    // A weight of 0 means the label was printed for a sub-1-gram input that
    // rounded away to nothing during encoding (see generateWeightEmbeddedLabel's
    // floor) — there is nothing to sell here. Treat it the same as "not found"
    // rather than letting it fall through to calculateLooseLineTotal's zero-
    // quantity rejection, which would otherwise surface as an opaque SYS-001.
    if (decoded.weightGrams <= 0) return { success: true, data: null }

    const product = await db.product.findFirst({
      where: { looseItemCode: decoded.looseItemCode, isActive: true, sellByWeight: true },
      include: { category: { select: { id: true, name: true } }, inventory: { select: { quantity: true } } }
    })
    if (!product) return { success: true, data: null }

    const printLog = await db.labelPrintLog.findFirst({ where: { barcode: raw }, orderBy: { printedAt: 'desc' } })
    const weightUnit = printLog?.weightUnitAtPrint ?? product.weightUnit ?? 'kg'
    const pricePerWeightUnitAtPrint = printLog?.pricePerWeightUnitAtPrint ?? product.pricePerWeightUnit ?? 0
    const gramsPerUnit = GRAMS_PER_UNIT[weightUnit] ?? 1000

    const quantityInSellUnit = decoded.weightGrams / gramsPerUnit
    // Pre-tax convenience value (quantity × price only) — deliberately NOT
    // named lineTotal, which elsewhere in this app (InvoiceItem.lineTotal)
    // means the tax-inclusive amount actually charged. Tax is applied
    // downstream in billing.service.ts's normal invoice-item pipeline, same as
    // every other cart line; a caller wanting the final charged amount should
    // go through that pipeline, not treat this field as it.
    const preTaxAmount = calculateLooseLineTotal(quantityInSellUnit, pricePerWeightUnitAtPrint, await getDecimalPlaces())

    // Stale-price check: does the label's printed price still match the product's current config?
    const currentPricePerWeightUnit = product.pricePerWeightUnit ?? 0
    const priceIsStale = printLog !== null && Math.abs(currentPricePerWeightUnit - pricePerWeightUnitAtPrint) > 0.001

    return {
      success: true,
      data: {
        kind: 'WEIGHT_EMBEDDED',
        product,
        weightGrams: decoded.weightGrams,
        weightUnit,
        quantityInSellUnit,
        pricePerWeightUnitAtPrint,
        preTaxAmount,
        priceIsStale,
        currentPricePerWeightUnit
      }
    }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Weight-embedded label printing
// ─────────────────────────────────────────────────────────────────────────────

export async function generateWeightEmbeddedLabel(productId: string, weightGrams: number, userId?: string): Promise<ApiResponse> {
  try {
    // The barcode's weight field is a whole-gram integer (Math.round below) — a
    // weight under 0.5g rounds away to "00000", producing a checksum-valid but
    // physically meaningless label that later fails confusingly at scan time.
    // Reject before rounding, not after, so the cashier gets a clear message now.
    if (!Number.isFinite(weightGrams) || Math.round(weightGrams) < 1 || weightGrams > 99_999) {
      return { success: false, error: { code: 'BCD-006', message: 'Weight must be at least 1 gram and no more than 99.999 kg.' } }
    }

    const db = getPrisma()
    const barcode = await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } })
      if (!product) throw new ServiceError('PRD-001', 'Product not found.')
      if (!product.sellByWeight) throw new ServiceError('BCD-007', 'This product is not configured for loose/weight-based selling.')
      if (product.pricePerWeightUnit === null || product.pricePerWeightUnit === undefined) {
        throw new ServiceError('BCD-008', 'This product has no price-per-unit set. Set a price before printing a weight label.')
      }

      let looseCode = product.looseItemCode
      if (looseCode === null) {
        looseCode = await nextLooseItemCode(tx)
        await tx.product.update({ where: { id: productId }, data: { looseItemCode: looseCode } })
      }

      const weightDigits = String(Math.round(weightGrams)).padStart(5, '0')
      const itemDigits = String(looseCode).padStart(5, '0')
      const code = buildEAN13(WEIGHT_PREFIX, itemDigits + weightDigits)

      // Reprinting for the exact same product+weight produces an identical
      // barcode to any prior label for that combination — there are no spare
      // digits in this format to distinguish print runs, so software cannot
      // tell an old physical copy from a new one once scanned. That's an
      // inherent limit of this barcode format, not fixable here. What IS
      // fixable cheaply: warn the person printing *right now*, while they can
      // still walk over and pull the old sticker, if a prior label for this
      // exact product+weight was printed at a different price — silence here
      // is how a stale label ends up back in a customer's hands.
      const priorLabel = await tx.labelPrintLog.findFirst({
        where: { barcode: code },
        orderBy: { printedAt: 'desc' }
      })
      const reprintPriceChanged = priorLabel !== null && Math.abs(priorLabel.pricePerWeightUnitAtPrint - product.pricePerWeightUnit!) > 0.001

      await tx.labelPrintLog.create({
        data: {
          productId,
          barcode: code,
          weightGrams: Math.round(weightGrams),
          pricePerWeightUnitAtPrint: product.pricePerWeightUnit!,
          weightUnitAtPrint: product.weightUnit ?? 'kg',
          printedBy: userId ?? getCurrentSession()?.userId ?? null
        }
      })

      return { code, weightUnit: product.weightUnit ?? 'kg', pricePerWeightUnit: product.pricePerWeightUnit!, reprintPriceChanged }
    })

    // Compute the printable price HERE, not in the caller — this is the one
    // place that already owns GRAMS_PER_UNIT and the unit-conversion rule.
    // A prior version had the frontend re-derive this with a hardcoded /1000,
    // which is correct for kg/L but silently 1000x-undercharges the printed
    // label for any product priced per gram or per millilitre (the register
    // charges correctly via this same GRAMS_PER_UNIT table at scan time — only
    // the printed sticker was wrong). Centralizing it here means there is
    // exactly one implementation of this conversion, not two that can drift.
    const gramsPerUnit = GRAMS_PER_UNIT[barcode.weightUnit] ?? 1000
    const quantityInSellUnit = Math.round(weightGrams) / gramsPerUnit
    const preTaxAmount = calculateLooseLineTotal(quantityInSellUnit, barcode.pricePerWeightUnit, await getDecimalPlaces())

    await logAction({ userId: getCurrentSession()?.userId, action: 'WEIGHT_LABEL_PRINTED', entityType: 'Product', entityId: productId, newValue: { barcode: barcode.code, weightGrams, reprintPriceChanged: barcode.reprintPriceChanged } })
    return {
      success: true,
      data: {
        barcode: barcode.code,
        weightUnit: barcode.weightUnit,
        quantityInSellUnit,
        pricePerWeightUnit: barcode.pricePerWeightUnit,
        preTaxAmount,
        // If a prior label for this exact product+weight was printed at a
        // different price, an old physical copy may still be on the shelf —
        // the reprint gets an identical barcode (see comment above), so the
        // only defense is telling the person printing right now to go remove it.
        reprintPriceChanged: barcode.reprintPriceChanged
      }
    }
  } catch (err) {
    if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rounding
// ─────────────────────────────────────────────────────────────────────────────

async function getDecimalPlaces(): Promise<number> {
  const db = getPrisma()
  const setting = await db.setting.findUnique({ where: { settingKey: 'decimal_places' } })
  const parsed = parseInt(setting?.settingValue ?? '2', 10)
  return isNaN(parsed) ? 2 : parsed
}

// Pure function: quantity (already in the product's sellUnit, e.g. kg) × price-per-unit,
// rounded to the currency's configured decimal places. Deliberately separate from the
// invoice-total-level cash rounding in billing.service.ts (Math.round to whole units) —
// that operates on the final total, this operates on one line's weight×price math, and
// the two must not be conflated.
export function calculateLooseLineTotal(quantityInSellUnit: number, pricePerSellUnit: number, decimalPlaces: number): number {
  if (quantityInSellUnit <= 0) {
    throw new ServiceError('BCD-009', 'Quantity must be greater than zero.')
  }
  if (pricePerSellUnit < 0) {
    throw new ServiceError('BCD-010', 'Price must not be negative.')
  }
  const raw = quantityInSellUnit * pricePerSellUnit
  const factor = Math.pow(10, decimalPlaces)
  return Math.round(raw * factor) / factor
}

export { getDecimalPlaces }
