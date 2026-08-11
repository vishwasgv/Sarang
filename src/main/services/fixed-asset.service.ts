import { getPrisma } from '../database/db'
import { parseLocalDateStart } from '../utils/date.util'
import { logAction } from './audit.service'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { journalEntryService } from './journal-entry.service'
import { roundCurrency } from './currency.service'
import type { CreateFixedAssetPayload, RunDepreciationPayload, DisposeFixedAssetPayload } from '../validation/fixed-asset.validation'

// Depreciation math, deliberately simplified (Section 4.1 item 12):
// STRAIGHT_LINE — (cost − salvage) / usefulLifeMonths per month, prorated by
// the number of days in the given period against a 30-day reference month.
// WDV — a 2/usefulLifeMonths declining-balance rate applied to current book
// value (a common double-declining-balance simplification, since this
// schema doesn't carry a separate statutory WDV rate table). Both are
// capped so accumulated depreciation can never push book value below
// salvageValue, regardless of period length or rounding.
function computePeriodDepreciation(
  asset: { purchaseCost: number; salvageValue: number; usefulLifeMonths: number; depreciationMethod: string; accumulatedDepreciation: number },
  periodStart: Date, periodEnd: Date
): number {
  const daysInPeriod = Math.max(0, (periodEnd.getTime() - periodStart.getTime()) / 86400000)
  const monthsInPeriod = daysInPeriod / 30
  const bookValue = asset.purchaseCost - asset.accumulatedDepreciation
  const depreciableRemaining = Math.max(0, bookValue - asset.salvageValue)
  if (depreciableRemaining <= 0 || monthsInPeriod <= 0) return 0

  let amount: number
  if (asset.depreciationMethod === 'WDV') {
    const monthlyRate = 2 / asset.usefulLifeMonths
    amount = bookValue * monthlyRate * monthsInPeriod
  } else {
    const monthlyAmount = (asset.purchaseCost - asset.salvageValue) / asset.usefulLifeMonths
    amount = monthlyAmount * monthsInPeriod
  }
  return roundCurrency(Math.min(amount, depreciableRemaining))
}

export const fixedAssetService = {
  // No GL posting at creation — registering an asset that was already paid
  // for via a Bill or Expense elsewhere; posting a second Debit-Fixed-
  // Assets entry here would double-count the purchase in the ledger.
  async createAsset(payload: CreateFixedAssetPayload, userId?: string) {
    const db = getPrisma()
    try {
      const existing = await db.fixedAsset.findUnique({ where: { assetCode: payload.assetCode } })
      if (existing) return { success: false, error: { code: 'FA-001', message: 'An asset with this code already exists.' } }
      if (payload.salvageValue > payload.purchaseCost) {
        return { success: false, error: { code: 'FA-002', message: 'Salvage value cannot exceed purchase cost.' } }
      }

      const asset = await db.fixedAsset.create({
        data: {
          assetCode: payload.assetCode,
          assetName: payload.assetName,
          category: payload.category ?? null,
          purchaseDate: parseLocalDateStart(payload.purchaseDate),
          purchaseCost: payload.purchaseCost,
          usefulLifeMonths: payload.usefulLifeMonths,
          depreciationMethod: payload.depreciationMethod,
          salvageValue: payload.salvageValue,
          accumulatedDepreciation: 0,
          status: 'ACTIVE',
          notes: payload.notes ?? null
        }
      })

      await logAction({ userId, action: 'FIXED_ASSET_CREATED', entityType: 'FixedAsset', entityId: asset.id, newValue: { assetCode: asset.assetCode, purchaseCost: asset.purchaseCost } })
      return { success: true, data: asset }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to create fixed asset.' } }
    }
  },

  async listAssets(filters?: { status?: string; category?: string }) {
    try {
      const db = getPrisma()
      const where: Record<string, unknown> = {}
      if (filters?.status) where.status = filters.status
      if (filters?.category) where.category = filters.category
      const assets = await db.fixedAsset.findMany({ where, orderBy: { assetCode: 'asc' } })
      return { success: true, data: assets }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to list fixed assets.' } }
    }
  },

  async getAsset(id: string) {
    try {
      const db = getPrisma()
      const asset = await db.fixedAsset.findUnique({ where: { id }, include: { depreciationRuns: { orderBy: { periodEnd: 'desc' } } } })
      if (!asset) return { success: false, error: { code: 'FA-003', message: 'Fixed asset not found.' } }
      return { success: true, data: asset }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to fetch fixed asset.' } }
    }
  },

  async runDepreciation(payload: RunDepreciationPayload, userId?: string) {
    const db = getPrisma()
    try {
      const asset = await db.fixedAsset.findUnique({ where: { id: payload.fixedAssetId } })
      if (!asset) return { success: false, error: { code: 'FA-003', message: 'Fixed asset not found.' } }
      if (asset.status === 'DISPOSED') return { success: false, error: { code: 'FA-004', message: 'Cannot depreciate a disposed asset.' } }

      const periodStart = parseLocalDateStart(payload.periodStart)
      const periodEnd = parseLocalDateStart(payload.periodEnd)
      const amount = computePeriodDepreciation(asset, periodStart, periodEnd)
      if (amount <= 0) return { success: false, error: { code: 'FA-005', message: 'No depreciable value remains for this asset and period.' } }

      const result = await db.$transaction(async (tx) => {
        // The @@unique([fixedAssetId, periodEnd]) constraint is the real,
        // DB-level idempotent-rerun guard the spec asks for — a second run
        // for the same period fails atomically here, not silently double-posts.
        const depRow = await tx.fixedAssetDepreciation.create({
          data: { fixedAssetId: asset.id, periodStart, periodEnd, amount }
        })

        const [depreciationAccount, fixedAssetAccount] = await Promise.all([
          chartOfAccountsService.getSystemAccountByCode('6100', tx),
          chartOfAccountsService.getSystemAccountByCode('1500', tx)
        ])
        const je = await journalEntryService.postSystemEntry(tx, {
          sourceType: 'ASSET_DEPRECIATION', sourceId: depRow.id, entryDate: periodEnd, narration: `Depreciation — ${asset.assetName} (${payload.periodStart} to ${payload.periodEnd})`,
          lines: [
            { accountId: depreciationAccount.id, bankAccountId: null, debitAmount: amount, creditAmount: 0 },
            { accountId: fixedAssetAccount.id, bankAccountId: null, debitAmount: 0, creditAmount: amount }
          ]
        })

        await tx.fixedAssetDepreciation.update({ where: { id: depRow.id }, data: { journalEntryId: je.id } })
        const updatedAsset = await tx.fixedAsset.update({
          where: { id: asset.id },
          data: { accumulatedDepreciation: roundCurrency(asset.accumulatedDepreciation + amount) }
        })
        return { depreciation: { ...depRow, journalEntryId: je.id }, asset: updatedAsset }
      })

      await logAction({ userId, action: 'FIXED_ASSET_DEPRECIATION_RUN', entityType: 'FixedAsset', entityId: asset.id, newValue: { amount, periodStart: payload.periodStart, periodEnd: payload.periodEnd } })
      return { success: true, data: result }
    } catch (err) {
      // Prisma's own unique-constraint error for the (fixedAssetId, periodEnd)
      // pair — surfaced as a clear, expected message, not a raw DB error leak.
      if (err instanceof Error && err.message.includes('Unique constraint')) {
        return { success: false, error: { code: 'FA-006', message: 'Depreciation for this period has already been run for this asset.' } }
      }
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to run depreciation.' } }
    }
  },

  // Disposal posts a simplified gain/loss entry: Debit Cash for whatever was
  // received, Credit Fixed Assets for the remaining book value, and the
  // difference (gain or loss) plugs against Depreciation Expense — this
  // schema doesn't maintain a separate contra-asset "Accumulated
  // Depreciation" account or a dedicated Gain/Loss account, so both are
  // folded into the two accounts this phase's 13-account seed already has,
  // a deliberate simplification flagged here rather than silently assumed.
  async disposeAsset(payload: DisposeFixedAssetPayload, userId?: string) {
    const db = getPrisma()
    try {
      const asset = await db.fixedAsset.findUnique({ where: { id: payload.id } })
      if (!asset) return { success: false, error: { code: 'FA-003', message: 'Fixed asset not found.' } }
      if (asset.status === 'DISPOSED') return { success: false, error: { code: 'FA-007', message: 'This asset has already been disposed.' } }

      const bookValue = roundCurrency(asset.purchaseCost - asset.accumulatedDepreciation)
      const gainOrLoss = roundCurrency(payload.disposalAmount - bookValue)
      const disposalDate = parseLocalDateStart(payload.disposalDate)

      const updated = await db.$transaction(async (tx) => {
        const result = await tx.fixedAsset.update({
          where: { id: payload.id },
          data: { status: 'DISPOSED', disposalDate, disposalAmount: payload.disposalAmount }
        })

        if (payload.disposalAmount > 0 || bookValue > 0) {
          const [cashAccount, fixedAssetAccount, depreciationAccount] = await Promise.all([
            chartOfAccountsService.getSystemAccountByCode('1000', tx),
            chartOfAccountsService.getSystemAccountByCode('1500', tx),
            chartOfAccountsService.getSystemAccountByCode('6100', tx)
          ])
          const lines = [
            { accountId: cashAccount.id, bankAccountId: null, debitAmount: payload.disposalAmount, creditAmount: 0 },
            { accountId: fixedAssetAccount.id, bankAccountId: null, debitAmount: 0, creditAmount: bookValue }
          ]
          if (gainOrLoss > 0) lines.push({ accountId: depreciationAccount.id, bankAccountId: null, debitAmount: 0, creditAmount: gainOrLoss })
          else if (gainOrLoss < 0) lines.push({ accountId: depreciationAccount.id, bankAccountId: null, debitAmount: -gainOrLoss, creditAmount: 0 })

          await journalEntryService.postSystemEntry(tx, {
            sourceType: 'ASSET_DISPOSAL', sourceId: asset.id, entryDate: disposalDate, narration: `Disposal — ${asset.assetName}`,
            lines: lines.filter((l) => l.debitAmount > 0 || l.creditAmount > 0)
          })
        }

        return result
      })

      await logAction({ userId, action: 'FIXED_ASSET_DISPOSED', entityType: 'FixedAsset', entityId: payload.id, newValue: { disposalAmount: payload.disposalAmount, gainOrLoss } })
      return { success: true, data: { asset: updated, gainOrLoss } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to dispose fixed asset.' } }
    }
  }
}
