import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { parseLocalDateStart, parseLocalDateEnd } from '../utils/date.util'

// Phase 67 §9.1 — Footwear item 3: trial-pair counter workflow. Sarang's
// stock model already decrements ProductVariant.stockQty ONLY at actual
// sale time (decrementVariantStockTx) — a pair being tried on never left
// inventory, so there is nothing to "restock" and no reservation/hold
// mechanism is needed. The real gap this closes is that a shop had no way
// to know HOW MANY pairs get tried on per eventual sale, or what fraction
// of trial sessions convert at all. TrialSession is therefore a lightweight
// append-only log, not a workflow with in-progress state — recorded once,
// at the point the customer either buys or walks away.
export interface RecordTrialSessionPayload {
  productId: string
  triedVariantIds: string[]
  purchasedVariantId?: string | null
  customerId?: string | null
}

export interface TrialSessionRecord {
  id: string
  productId: string
  productName: string
  triedVariantIds: string[]
  purchasedVariantId: string | null
  customerId: string | null
  createdAt: string
}

export async function recordTrialSession(
  payload: RecordTrialSessionPayload,
  userId?: string
): Promise<{ success: boolean; data?: TrialSessionRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()

    const triedIds = Array.from(new Set((payload.triedVariantIds ?? []).filter(Boolean)))
    if (triedIds.length < 2) {
      return { success: false, error: { code: 'TRIAL-001', message: 'At least two variants must be tried on to record a trial session.' } }
    }
    if (payload.purchasedVariantId && !triedIds.includes(payload.purchasedVariantId)) {
      return { success: false, error: { code: 'TRIAL-002', message: 'Purchased variant must be one of the tried variants.' } }
    }

    const product = await db.product.findUnique({ where: { id: payload.productId } })
    if (!product) return { success: false, error: { code: 'TRIAL-003', message: 'Product not found.' } }

    const variantCount = await db.productVariant.count({ where: { id: { in: triedIds }, productId: payload.productId } })
    if (variantCount !== triedIds.length) {
      return { success: false, error: { code: 'TRIAL-004', message: 'One or more tried variants do not belong to this product.' } }
    }

    const row = await db.trialSession.create({
      data: {
        productId: payload.productId,
        triedVariantIds: JSON.stringify(triedIds),
        purchasedVariantId: payload.purchasedVariantId || null,
        customerId: payload.customerId || null,
        createdById: userId || null
      }
    })

    await logAction({
      userId,
      action: 'TRIAL_SESSION_RECORDED',
      entityType: 'TrialSession',
      entityId: row.id,
      newValue: { productId: payload.productId, triedCount: triedIds.length, converted: Boolean(payload.purchasedVariantId) }
    })

    return {
      success: true,
      data: {
        id: row.id,
        productId: row.productId,
        productName: product.productName,
        triedVariantIds: triedIds,
        purchasedVariantId: row.purchasedVariantId,
        customerId: row.customerId,
        createdAt: row.createdAt.toISOString()
      }
    }
  } catch (err) {
    return { success: false, error: { code: 'TRIAL-005', message: err instanceof Error ? err.message : 'Failed to record trial session.' } }
  }
}

export interface TrialConversionSummary {
  totalSessions: number
  convertedSessions: number
  conversionRatePercent: number
  avgPairsTriedPerSession: number
  avgPairsTriedPerConversion: number
}

export async function getTrialConversionSummary(
  dateFrom?: string,
  dateTo?: string
): Promise<{ success: boolean; data?: TrialConversionSummary; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const where: { createdAt?: { gte?: Date; lte?: Date } } = {}
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = parseLocalDateStart(dateFrom)
      if (dateTo) where.createdAt.lte = parseLocalDateEnd(dateTo)
    }

    const sessions = await db.trialSession.findMany({ where, select: { triedVariantIds: true, purchasedVariantId: true } })

    const totalSessions = sessions.length
    const converted = sessions.filter((s) => Boolean(s.purchasedVariantId))
    const convertedSessions = converted.length
    const totalTried = sessions.reduce((sum, s) => sum + safeParsedCount(s.triedVariantIds), 0)
    const totalTriedConverted = converted.reduce((sum, s) => sum + safeParsedCount(s.triedVariantIds), 0)

    return {
      success: true,
      data: {
        totalSessions,
        convertedSessions,
        conversionRatePercent: totalSessions > 0 ? Math.round((convertedSessions / totalSessions) * 10000) / 100 : 0,
        avgPairsTriedPerSession: totalSessions > 0 ? Math.round((totalTried / totalSessions) * 100) / 100 : 0,
        avgPairsTriedPerConversion: convertedSessions > 0 ? Math.round((totalTriedConverted / convertedSessions) * 100) / 100 : 0
      }
    }
  } catch (err) {
    return { success: false, error: { code: 'TRIAL-006', message: err instanceof Error ? err.message : 'Failed to compute trial conversion summary.' } }
  }
}

function safeParsedCount(json: string): number {
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr.length : 0
  } catch {
    return 0
  }
}
