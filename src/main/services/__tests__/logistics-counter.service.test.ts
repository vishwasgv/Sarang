import { describe, it, expect } from 'vitest'
import { nextLogisticsNumber } from '../logistics-counter.service'

function makeTx(existingNumbers: string[]) {
  return {
    shipment: {
      findMany: async () => existingNumbers.map(n => ({ shipmentNumber: n })),
    },
  } as never
}

describe('nextLogisticsNumber', () => {
  it('starts at 0001 when no records exist this month', async () => {
    const num = await nextLogisticsNumber('SHP', makeTx([]))
    expect(num).toMatch(/^SHP-\d{6}-0001$/)
  })

  it('increments from the highest existing sequence', async () => {
    const yyyymm = num_month()
    const num = await nextLogisticsNumber('SHP', makeTx([`SHP-${yyyymm}-0001`, `SHP-${yyyymm}-0007`, `SHP-${yyyymm}-0003`]))
    expect(num).toBe(`SHP-${yyyymm}-0008`)
  })

  it('compares sequence numbers numerically, not lexicographically, past 9999', async () => {
    // A naive string-sort would treat "...-9999" as greater than "...-10000",
    // wedging the generator on the same number for the rest of the month.
    const yyyymm = num_month()
    const num = await nextLogisticsNumber('SHP', makeTx([`SHP-${yyyymm}-9999`, `SHP-${yyyymm}-10000`]))
    expect(num).toBe(`SHP-${yyyymm}-10001`)
  })

  it('ignores malformed suffixes when computing the max', async () => {
    const yyyymm = num_month()
    const num = await nextLogisticsNumber('SHP', makeTx([`SHP-${yyyymm}-0005`, `SHP-${yyyymm}-NOTANUM`]))
    expect(num).toBe(`SHP-${yyyymm}-0006`)
  })
})

function num_month(): string {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
}
