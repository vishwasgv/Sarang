import { describe, it, expect } from 'vitest'
import { purchaseJournalLines, debitNoteJournalLines } from '../purchase-tax-journal.util'
import { sumMoney } from '../../../shared/utils/money'

const accounts = { expenseId: 'exp', apId: 'ap', taxPayableId: 'tp', itcId: 'itc' }
const totals = (lines: Array<{ debitAmount: number; creditAmount: number }>) => ({
  dr: sumMoney(lines.map((l) => l.debitAmount), 3),
  cr: sumMoney(lines.map((l) => l.creditAmount), 3)
})
const by = (lines: Array<{ accountId: string; debitAmount: number; creditAmount: number }>, id: string) => lines.find((l) => l.accountId === id)

describe('purchase journal with input tax credit', () => {
  it('claimable tax splits out of the cost into Input Tax Credit; AP still owes the full total', () => {
    const lines = purchaseJournalLines({ total: 1180, tax: 180, isReverseCharge: false, claimable: true, accounts })
    expect(by(lines, 'exp')!.debitAmount).toBe(1000)
    expect(by(lines, 'itc')!.debitAmount).toBe(180)
    expect(by(lines, 'ap')!.creditAmount).toBe(1180)
    expect(totals(lines).dr).toBe(totals(lines).cr)
  })

  it('composition scheme keeps the tax inside the cost', () => {
    const lines = purchaseJournalLines({ total: 1180, tax: 180, isReverseCharge: false, claimable: false, accounts: { ...accounts, itcId: undefined } })
    expect(lines).toHaveLength(2)
    expect(by(lines, 'exp')!.debitAmount).toBe(1180)
  })

  it('no tax: two lines, no ITC', () => {
    const lines = purchaseJournalLines({ total: 500, tax: 0, isReverseCharge: false, claimable: true, accounts })
    expect(lines).toHaveLength(2)
  })

  it('reverse charge: expense is the net, tax goes to both Input Tax Credit and Tax Payable, AP owes the net only', () => {
    const lines = purchaseJournalLines({ total: 1000, tax: 180, isReverseCharge: true, claimable: true, accounts })
    expect(by(lines, 'exp')!.debitAmount).toBe(1000)
    expect(by(lines, 'itc')!.debitAmount).toBe(180)
    expect(by(lines, 'ap')!.creditAmount).toBe(1000)
    expect(by(lines, 'tp')!.creditAmount).toBe(180)
    expect(totals(lines).dr).toBe(totals(lines).cr)
  })

  it('reverse charge with no claim: tax is a cost and a payable', () => {
    const lines = purchaseJournalLines({ total: 1000, tax: 180, isReverseCharge: true, claimable: false, accounts: { ...accounts, itcId: undefined } })
    expect(by(lines, 'exp')!.debitAmount).toBe(1180)
    expect(totals(lines).dr).toBe(totals(lines).cr)
  })

  it('always balances for random amounts in 0, 2 and 3 decimal currencies', () => {
    for (let i = 0; i < 2000; i++) {
      const decimals = [0, 2, 3][i % 3]
      const net = Math.round(Math.random() * 1e6) / 10 ** (decimals === 0 ? 0 : 1)
      const tax = Number((net * 0.18).toFixed(decimals))
      const total = Number((net + tax).toFixed(decimals))
      for (const rcm of [false, true]) {
        const lines = purchaseJournalLines({ total: rcm ? net : total, tax, isReverseCharge: rcm, claimable: true, accounts })
        expect(totals(lines).dr).toBe(totals(lines).cr)
      }
    }
  })
})

describe('debit note journal', () => {
  it('reverses cost and input tax credit separately', () => {
    const lines = debitNoteJournalLines({ amount: 118, tax: 18, claimable: true, accounts })
    expect(by(lines, 'ap')!.debitAmount).toBe(118)
    expect(by(lines, 'exp')!.creditAmount).toBe(100)
    expect(by(lines, 'itc')!.creditAmount).toBe(18)
    expect(totals(lines).dr).toBe(totals(lines).cr)
  })
  it('without a claim the whole amount comes out of cost', () => {
    const lines = debitNoteJournalLines({ amount: 118, tax: 18, claimable: false, accounts: { ...accounts, itcId: undefined } })
    expect(lines).toHaveLength(2)
    expect(by(lines, 'exp')!.creditAmount).toBe(118)
  })
})
