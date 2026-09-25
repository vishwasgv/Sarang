import { getPrisma } from '../database/db'
import { resolveLineTaxCategory } from '../../shared/utils/gst-presentation'

export const TAX_CATEGORY_BACKFILL_KEY = 'tax_category_backfill_v1'

// Lines saved before tax categories existed carry the column default STANDARD on every line, so a zero-rate
// line of an exempt product reads as nil-rated in the by-category Tax report and GSTR-1. One-time, idempotent
// startup routine: a zero-rate line takes its product's category when that is EXEMPT, NIL_RATED, ZERO_RATED or
// OUT_OF_SCOPE and NIL_RATED otherwise (the same rule new documents use); a taxed line is never touched.
// Only the taxCategory column is written: no amount, rate or total ever changes.
export async function backfillLineTaxCategories(): Promise<{ invoiceLines: number; billLines: number }> {
  const db = getPrisma()
  const done = await db.setting.findUnique({ where: { settingKey: TAX_CATEGORY_BACKFILL_KEY } })
  if (done?.settingValue === 'done') return { invoiceLines: 0, billLines: 0 }

  const products = await db.product.findMany({ where: { taxCategory: { not: 'STANDARD' } }, select: { id: true, taxCategory: true } })
  const idsByCategory = new Map<string, string[]>()
  for (const p of products) {
    const resolved = resolveLineTaxCategory(p.taxCategory, 0)
    if (resolved === 'STANDARD') continue
    idsByCategory.set(resolved, [...(idsByCategory.get(resolved) ?? []), p.id])
  }

  let invoiceLines = 0
  let billLines = 0
  for (const [category, ids] of idsByCategory) {
    invoiceLines += (await db.invoiceItem.updateMany({ where: { taxCategory: 'STANDARD', taxRate: { lte: 0 }, productId: { in: ids } }, data: { taxCategory: category } })).count
    billLines += (await db.billItem.updateMany({ where: { taxCategory: 'STANDARD', taxRate: { lte: 0 }, productId: { in: ids } }, data: { taxCategory: category } })).count
  }
  // Every remaining zero-rate STANDARD line is nil-rated, exactly as resolveLineTaxCategory files it today.
  invoiceLines += (await db.invoiceItem.updateMany({ where: { taxCategory: 'STANDARD', taxRate: { lte: 0 } }, data: { taxCategory: 'NIL_RATED' } })).count
  billLines += (await db.billItem.updateMany({ where: { taxCategory: 'STANDARD', taxRate: { lte: 0 } }, data: { taxCategory: 'NIL_RATED' } })).count

  await db.setting.upsert({
    where: { settingKey: TAX_CATEGORY_BACKFILL_KEY },
    create: { settingKey: TAX_CATEGORY_BACKFILL_KEY, settingValue: 'done', settingType: 'STRING' },
    update: { settingValue: 'done' }
  })
  return { invoiceLines, billLines }
}
