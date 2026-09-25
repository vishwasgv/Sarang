import { describe, it, expect, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { buildTrialBalanceHierarchy } from '../report.service'

const acc = (id: string, code: string, name: string, type: string, parentId: string | null = null) => ({ id, accountCode: code, accountName: name, accountType: type, parentId })

describe('trial balance hierarchy', () => {
  const accounts = [
    acc('cash', '1000', 'Cash', 'ASSET'),
    acc('bank', '1010', 'Banks', 'ASSET', null),
    acc('hdfc', '1011', 'HDFC', 'ASSET', 'bank'),
    acc('sbi', '1012', 'SBI', 'ASSET', 'bank'),
    acc('ap', '2000', 'Accounts Payable', 'LIABILITY'),
    acc('sales', '4000', 'Sales', 'INCOME'),
    acc('unused', '6100', 'Depreciation', 'EXPENSE')
  ]
  const net = new Map<string, number>([['cash', 500], ['hdfc', 300], ['sbi', -50], ['ap', -400], ['sales', -350]])

  it('groups by type, rolls children into their parent and skips accounts with nothing posted', () => {
    const h = buildTrialBalanceHierarchy(accounts, net)
    expect(h.map((x) => `${x.depth}:${x.isTypeHeader ? x.accountType : x.account}`)).toEqual([
      '0:ASSET', '1:1000 — Cash', '1:1010 — Banks', '2:1011 — HDFC', '2:1012 — SBI',
      '0:LIABILITY', '1:2000 — Accounts Payable', '0:INCOME', '1:4000 — Sales'
    ])
    const banks = h.find((x) => x.account.startsWith('1010'))!
    expect(banks).toMatchObject({ debit: 250, credit: 0, isGroup: true })
    expect(h.find((x) => x.account.startsWith('1012'))).toMatchObject({ debit: 0, credit: 50 })
    expect(h[0]).toMatchObject({ debit: 750, credit: 0 })
  })

  it('type headers add to the same totals as the plain rows: every debit equals every credit when the books balance', () => {
    const h = buildTrialBalanceHierarchy(accounts, net)
    const headers = h.filter((x) => x.isTypeHeader)
    const debit = headers.reduce((s, x) => s + x.debit, 0)
    const credit = headers.reduce((s, x) => s + x.credit, 0)
    expect(debit).toBe(750)
    expect(credit).toBe(750)
  })

  it('a parent that is posted to directly still shows its own balance plus its children', () => {
    const h = buildTrialBalanceHierarchy(accounts, new Map([...net, ['bank', 100]]))
    expect(h.find((x) => x.account.startsWith('1010'))).toMatchObject({ debit: 350 })
  })

  it('an empty ledger gives no lines', () => {
    expect(buildTrialBalanceHierarchy(accounts, new Map())).toEqual([])
  })
})
