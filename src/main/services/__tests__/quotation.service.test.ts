import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../industry-template.service', () => ({ isModuleEnabled: vi.fn().mockResolvedValue(false) }))

import { getPrisma } from '../../database/db'
import { quotationService } from '../quotation.service'

const EXISTING_NUMBER = 'QT-00003'

function makeDb(lastQuotationNumber: string | null = EXISTING_NUMBER) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const txClient = {
    quotation: {
      findFirst: vi.fn().mockResolvedValue(lastQuotationNumber ? { quotationNumber: lastQuotationNumber } : null),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'qt-new', items: data.items?.create ?? [], customer: null }))
    },
    setting: {
      findUnique: vi.fn(async () => settingRow),
      update: vi.fn(async ({ data }: { data: { settingValue: string } }) => { settingRow = settingRow ? { ...settingRow, settingValue: data.settingValue } : null; return settingRow }),
      create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => { settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }; return settingRow })
    }
  }
  return {
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(txClient)),
    __txClient: txClient
  }
}

beforeEach(() => vi.clearAllMocks())

describe('quotationService.create', () => {
  it('generates the next number inside the same transaction as the insert (no pre-transaction read)', async () => {
    const db = makeDb('QT-00003')
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await quotationService.create({ customerName: 'Walk-in', items: [{ productName: 'Widget', quantity: 2, unitPrice: 100 }] }, 'user-1')

    expect(res.success).toBe(true)
    expect((res as { data: { quotationNumber: string } }).data.quotationNumber).toBe('QT-00004')
    expect(db.__txClient.setting.create).toHaveBeenCalledWith({
      data: { settingKey: 'quotation_sequence', settingValue: '4', settingType: 'NUMBER' }
    })
    // Number generation and the insert both went through the tx client, not a
    // pre-transaction read on the outer db — the whole point of the fix.
    expect(db.__txClient.quotation.findFirst).toHaveBeenCalledTimes(1)
    expect(db.__txClient.quotation.create).toHaveBeenCalledTimes(1)
  })

  it('starts at QT-00001 when there is no legacy data', async () => {
    const db = makeDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await quotationService.create({ items: [{ productName: 'Widget', quantity: 1, unitPrice: 50 }] }, 'user-1')

    expect((res as { data: { quotationNumber: string } }).data.quotationNumber).toBe('QT-00001')
  })

  it('computes subtotal, discount, tax and total correctly across multiple items', async () => {
    const db = makeDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await quotationService.create({
      items: [
        { productName: 'A', quantity: 2, unitPrice: 100, discount: 10, taxRate: 18 }, // base 200, disc 20, taxable 180, tax 32.4
        { productName: 'B', quantity: 1, unitPrice: 50 } // base 50, disc 0, taxable 50, tax 0
      ]
    }, 'user-1')

    const data = (res as { data: { subtotal: number; discountAmount: number; taxAmount: number; totalAmount: number } }).data
    expect(data.subtotal).toBe(250)
    expect(data.discountAmount).toBe(20)
    expect(data.taxAmount).toBeCloseTo(32.4)
    expect(data.totalAmount).toBeCloseTo(262.4)
  })
})
