import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { voucherClassService } from '../voucher-class.service'

function makeDb(accountCount = 2) {
  return {
    chartOfAccounts: { count: vi.fn().mockResolvedValue(accountCount) },
    voucherClass: {
      upsert: vi.fn().mockResolvedValue({ id: 'v1' }),
      findMany: vi.fn().mockResolvedValue([{ id: 'v1', name: 'Rent', narration: 'Monthly rent', linesJson: '[{"accountId":"a","side":"DEBIT"},{"accountId":"b","side":"CREDIT"}]' }, { id: 'v2', name: 'Broken', narration: null, linesJson: 'not json' }]),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 })
    }
  }
}

const lines = [{ accountId: 'a', side: 'DEBIT' as const }, { accountId: 'b', side: 'CREDIT' as const }]

describe('voucher classes (journal patterns)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves a pattern under its trimmed name, replacing one with the same name', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await voucherClassService.save({ name: '  Rent  ', lines })
    expect(r.success).toBe(true)
    expect(db.voucherClass.upsert.mock.calls[0][0].where).toEqual({ name: 'Rent' })
    expect(JSON.parse(db.voucherClass.upsert.mock.calls[0][0].create.linesJson)).toEqual(lines)
  })

  it('needs a name, both a debit and a credit, and real accounts', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)
    expect(await voucherClassService.save({ name: ' ', lines })).toMatchObject({ error: { code: 'VC-001' } })
    expect(await voucherClassService.save({ name: 'x', lines: [lines[0]] })).toMatchObject({ error: { code: 'VC-002' } })
    expect(await voucherClassService.save({ name: 'x', lines: [lines[0], { accountId: 'c', side: 'DEBIT' }] })).toMatchObject({ error: { code: 'VC-003' } })
    vi.mocked(getPrisma).mockReturnValue(makeDb(1) as never)
    expect(await voucherClassService.save({ name: 'x', lines })).toMatchObject({ error: { code: 'VC-004' } })
  })

  it('lists patterns with their lines; a damaged one comes back with no lines instead of failing', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)
    const r = await voucherClassService.list()
    expect(r.data[0]).toMatchObject({ name: 'Rent', lines })
    expect(r.data[1]).toMatchObject({ name: 'Broken', lines: [] })
  })
})
