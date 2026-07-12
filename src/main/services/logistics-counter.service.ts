import { getPrisma } from '../database/db'
import type { Prisma } from '@prisma/client'

type NumberPrefix = 'SHP' | 'GRN' | 'DC'

const MODEL_MAP: Record<NumberPrefix, { field: string; model: 'shipment' | 'goodsReceiptNote' | 'deliveryChallan' }> = {
  SHP: { field: 'shipmentNumber',  model: 'shipment' },
  GRN: { field: 'grnNumber',       model: 'goodsReceiptNote' },
  DC:  { field: 'challanNumber',   model: 'deliveryChallan' },
}

// Accepts an optional transaction client so number generation + record create are one atomic operation
export async function nextLogisticsNumber(
  prefix: NumberPrefix,
  tx?: Prisma.TransactionClient
): Promise<string> {
  const client: any = tx ?? getPrisma()
  const now = new Date()
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const { field, model } = MODEL_MAP[prefix]

  // Sequence suffix is compared numerically, not via orderBy on the string column —
  // string-sorting "...-10000" lands before "...-9999" lexicographically, which would
  // wedge the generator on the same number (and a unique-constraint failure) for the
  // rest of any month that crosses 9999 records.
  const rows = await client[model].findMany({
    where: { [field]: { startsWith: `${prefix}-${yyyymm}-` } },
    select: { [field]: true },
  })

  let seq = 1
  if (rows.length > 0) {
    const maxSeq = rows.reduce((max: number, r: Record<string, string>) => {
      const parts = r[field].split('-')
      const n = parseInt(parts[parts.length - 1], 10)
      return isNaN(n) ? max : Math.max(max, n)
    }, 0)
    seq = maxSeq + 1
  }

  return `${prefix}-${yyyymm}-${String(seq).padStart(4, '0')}`
}
