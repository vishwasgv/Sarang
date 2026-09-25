// Credit and debit notes: "add tax" or "skip tax" per note. The final amount must be clean and identical on the form,
// in the saved note, on the printed/PDF note, in the ledger, in the journal and in the tax reports.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../customer-ledger.service', () => ({ customerLedgerService: { addEntry: vi.fn() } }))
vi.mock('../supplier-ledger.service', () => ({ supplierLedgerService: { addEntry: vi.fn() } }))
vi.mock('../../utils/branding', () => ({ aszurexFooterHtml: vi.fn().mockResolvedValue('footer'), aszurexBrandSuffixHtml: vi.fn().mockResolvedValue('') }))

import { getPrisma } from '../../database/db'
import { creditNoteService } from '../credit-note.service'
import { debitNoteService } from '../debit-note.service'
import { customerLedgerService } from '../customer-ledger.service'
import { supplierLedgerService } from '../supplier-ledger.service'
import { printService } from '../print.service'
import { reportService } from '../report.service'
import { computeNoteTotals, getCurrencyDecimals, roundMoney, sumMoney } from '../../../shared/utils/money'
import { formatAmount } from '../currency.service'
import { gstPresentationLines } from '../../../shared/utils/gst-presentation'

function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 } }
const CURRENCIES = ['INR', 'USD', 'KWD', 'JPY']
const RATES = [0, 0.25, 2.5, 5, 12, 18, 28, 40]
const MODES = ['CGST_SGST', 'IGST', 'GST'] as const
const RULE_SETTINGS = [null, 'NONE', '1', '0.05'] // the invoice rounding rule must not touch a note

interface Journal { id: string; sourceType: string; sourceId: string; lines: Array<{ accountId: string; debitAmount: number; creditAmount: number }>; isReversed: boolean }

function clean(x: number, d: number): boolean {
  const scaled = x * 10 ** d
  return Number.isFinite(x) && !Object.is(x, -0) && Number(x.toFixed(d)) === x && Math.abs(scaled - Math.round(scaled)) < 1e-9 * Math.max(1, Math.abs(scaled) / 1e6)
}

function makeWorld(opts: { currency: string; linked?: { balance: number; total: number; items?: Array<{ taxRate: number; lineTotal: number }>; inclusive?: boolean } }) {
  const journals: Journal[] = []
  const notes = new Map<string, Record<string, any>>()
  const invoiceUpdates: Array<Record<string, any>> = []
  let invoice = opts.linked ? { id: 'inv-1', balanceAmount: opts.linked.balance, totalAmount: opts.linked.total, paidAmount: opts.linked.total - opts.linked.balance, paymentStatus: 'UNPAID' } : null
  let seq: { settingKey: string; settingValue: string } | null = null
  const coa = { findUnique: vi.fn(async ({ where }: any) => ({ id: `coa-${where.accountCode}`, accountCode: where.accountCode, accountName: where.accountCode, accountType: 'ASSET', isActive: true })) }
  const journalEntry = {
    create: vi.fn(async ({ data }: any) => { const j = { id: `je-${journals.length + 1}`, sourceType: data.sourceType, sourceId: data.sourceId, lines: data.lines.create, isReversed: false }; journals.push(j); return j }),
    findFirst: vi.fn(async ({ where }: any) => { const j = journals.find(x => x.sourceType === where.sourceType && x.sourceId === where.sourceId && x.isReversed === false); return j ? { ...j, entryNumber: j.id } : null }),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn(async ({ where, data }: any) => { const j = journals.find(x => x.id === where.id)!; Object.assign(j, data); return j })
  }
  const stateOf = (id: string) => notes.get(id)!
  const tx: Record<string, any> = {
    setting: {
      findUnique: vi.fn(async () => seq), update: vi.fn(),
      create: vi.fn(async ({ data }: any) => { seq = { settingKey: data.settingKey, settingValue: data.settingValue }; return seq }),
      updateMany: vi.fn(async ({ data }: any) => { if (seq) seq = { ...seq, settingValue: data.settingValue }; return { count: 1 } })
    },
    chartOfAccounts: coa, journalEntry,
    creditNote: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(async ({ data }: any) => { const row = { id: `cn-${notes.size + 1}`, ...data, items: (data.items?.create ?? []).map((it: any, k: number) => ({ id: `cni-${notes.size + 1}-${k}`, ...it })), customer: null, invoice: null, appliedToInvoiceAmount: null }; notes.set(row.id, row); return row }),
      findUnique: vi.fn(async ({ where }: any) => notes.get(where.id) ?? null),
      update: vi.fn(async ({ where, data }: any) => { const row = notes.get(where.id)!; Object.assign(row, data); return { ...row } }),
      delete: vi.fn(async ({ where }: any) => { notes.delete(where.id); return {} })
    },
    creditNoteItem: { update: vi.fn(async ({ where, data }: any) => { for (const n of notes.values()) { const it = n.items.find((i: any) => i.id === where.id); if (it) Object.assign(it, data) } return {} }) },
    debitNote: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(async ({ data }: any) => { const row = { id: `dn-${notes.size + 1}`, ...data, items: (data.items?.create ?? []).map((it: any, k: number) => ({ id: `dni-${notes.size + 1}-${k}`, ...it })), supplier: null, purchaseOrder: null }; notes.set(row.id, row); return row }),
      findUnique: vi.fn(async ({ where }: any) => notes.get(where.id) ?? null),
      update: vi.fn(async ({ where, data }: any) => { const row = notes.get(where.id)!; Object.assign(row, data); return { ...row } }),
      delete: vi.fn(async ({ where }: any) => { notes.delete(where.id); return {} })
    },
    debitNoteItem: { update: vi.fn(async ({ where, data }: any) => { for (const n of notes.values()) { const it = n.items.find((i: any) => i.id === where.id); if (it) Object.assign(it, data) } return {} }) },
    invoice: {
      findUniqueOrThrow: vi.fn(async () => invoice),
      update: vi.fn(async ({ data }: any) => { invoiceUpdates.push(data); invoice = { ...invoice!, ...data }; return invoice })
    }
  }
  const db: Record<string, any> = {
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: opts.currency, state: 'Maharashtra', taxNumber: null, lockDate: null, taxModel: 'GST' }) },
    invoice: { findUnique: vi.fn(async () => opts.linked ? { id: 'inv-1', pricesIncludeTax: opts.linked.inclusive === true, gstType: 'CGST_SGST', items: opts.linked.items ?? [] } : null) },
    purchaseOrder: { findUnique: vi.fn(async () => ({ id: 'po-1', pricesIncludeTax: false, gstType: 'CGST_SGST', items: [] })) },
    customer: { findUnique: vi.fn().mockResolvedValue({ state: null, taxNumber: null }) },
    supplier: { findUnique: vi.fn().mockResolvedValue({ state: null, taxNumber: null }) },
    taxConfiguration: { findFirst: vi.fn().mockResolvedValue({ rate: 18 }) },
    setting: tx.setting,
    creditNote: tx.creditNote, debitNote: tx.debitNote,
    $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx))
  }
  return { db, tx, journals, notes, invoiceUpdates, stateOf }
}

function ledgerNet(mock: { mock: { calls: unknown[][] } }, side: 'credit' | 'debit'): number {
  return sumMoney(mock.mock.calls.map(c => { const e = c[0] as { creditAmount: number; debitAmount: number }; return side === 'credit' ? e.creditAmount - e.debitAmount : e.debitAmount - e.creditAmount }), 3)
}

// Net effect of every journal entry (originals, reversals and re-postings) on the receivable, the tax payable and the
// revenue: what the books finally say about the note.
function liveJournalNet(journals: Journal[]): { debit: number; credit: number; tax: number; revenue: number } {
  const lines = journals.flatMap(j => j.lines)
  const net = (code: string) => sumMoney(lines.filter(l => l.accountId === code).map(l => l.debitAmount - l.creditAmount), 3)
  const balanced = journals.every(j => sumMoney(j.lines.map(l => l.debitAmount), 3) === sumMoney(j.lines.map(l => l.creditAmount), 3))
  const ar = -net('coa-1100')
  return { debit: balanced ? ar : -1, credit: ar, tax: net('coa-2100'), revenue: net('coa-4000') }
}

beforeEach(() => vi.clearAllMocks())

function randomNote(r: () => number, d: number) {
  const inclusive = r() < 0.5
  const taxApplied = r() < 0.6
  const mode = MODES[Math.floor(r() * 3)]
  if (r() < 0.5) {
    return { amount: Math.max(1, Math.round(r() * 9999999)) / 10 ** d, taxApplied, taxRate: RATES[Math.floor(r() * RATES.length)], pricesIncludeTax: inclusive, gstType: mode }
  }
  return {
    items: Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({ serviceDescription: 'Line', quantity: [1, 2, 3, 0.5][Math.floor(r() * 4)], unitPrice: Math.max(1, Math.round(r() * 999999)) / 10 ** d, taxRate: RATES[Math.floor(r() * RATES.length)] })),
    taxApplied, pricesIncludeTax: inclusive, gstType: mode
  }
}

describe('credit note: one figure everywhere, tax on or off', () => {
  it('4 the form total, the saved note, the ledger, the journal, the print and the reports agree to the minor unit (800 random notes, INR/USD/KWD/JPY)', async () => {
    const r = rng(2026)
    for (let n = 0; n < 800; n++) {
      const currency = CURRENCIES[n % 4]
      const d = getCurrencyDecimals(currency)
      const input = randomNote(r, d)
      const world = makeWorld({ currency })
      vi.mocked(getPrisma).mockReturnValue(world.db as never)
      vi.mocked(customerLedgerService.addEntry).mockClear()
      const ctx = JSON.stringify({ n, currency, input })

      // the form: exactly the shared calculation the screen runs
      const form = computeNoteTotals({ items: (input as any).items, amount: (input as any).amount, taxApplied: input.taxApplied, taxRate: (input as any).taxRate, pricesIncludeTax: input.pricesIncludeTax, decimals: d })

      const res = await creditNoteService.create({ customerId: 'c1', reason: 'r', ...input } as never, 'u')
      expect(res.success, ctx + JSON.stringify((res as any).error)).toBe(true)
      const note = world.stateOf('cn-1')

      // saved note == form
      expect([note.amount, note.taxAmount, note.taxApplied], ctx).toEqual([form.totalAmount, form.taxAmount, input.taxApplied])
      for (const x of [note.amount, note.taxAmount, ...(note.items as any[]).flatMap(i => [i.taxAmount, i.lineTotal])]) expect(clean(x, d), ctx + ' ' + x).toBe(true)
      expect(roundMoney(note.amount - note.taxAmount, d) >= 0, ctx).toBe(true)
      if (!input.taxApplied) {
        expect(note.taxAmount, ctx).toBe(0)
        expect((note.items as any[]).every(i => i.taxAmount === 0), ctx).toBe(true)
        expect(note.amount, ctx).toBe(roundMoney(note.amount - note.taxAmount, d))
      }

      // customer ledger moves by the note total
      expect(ledgerNet(vi.mocked(customerLedgerService.addEntry) as never, 'credit'), ctx).toBe(note.amount)

      // journal: balanced, revenue and tax lines match, no tax line when tax was skipped
      expect(world.journals.length, ctx).toBe(1)
      const lines = world.journals[0].lines
      expect(sumMoney(lines.map(l => l.debitAmount), 3), ctx).toBe(sumMoney(lines.map(l => l.creditAmount), 3))
      expect(lines.find(l => l.accountId === 'coa-1100')!.creditAmount, ctx).toBe(note.amount)
      const taxLine = lines.find(l => l.accountId === 'coa-2100')
      if (note.taxAmount > 0) expect(taxLine!.debitAmount, ctx).toBe(note.taxAmount)
      else expect(taxLine, ctx).toBeUndefined()
      const revenue = lines.find(l => l.accountId === 'coa-4000')
      expect(revenue?.debitAmount ?? 0, ctx).toBe(roundMoney(note.amount - note.taxAmount, d))

      // print (A4 and receipt) shows the same total, tax lines only when tax was applied
      const profile = { currencyCode: currency, currencySymbol: '#', taxModel: 'GST', businessName: 'B' }
      vi.mocked(getPrisma).mockReturnValue({ ...world.db, setting: { findMany: vi.fn().mockResolvedValue([]) } } as never)
      const printable = { ...note, createdAt: new Date(), customer: { customerName: 'C' }, invoice: null }
      const totalText = formatAmount(note.amount, '#', 'IN', d)
      for (const html of [await printService.generateCreditNoteHtml(printable as never, profile as never), await printService.generateCreditNoteReceiptHtml(printable as never, profile as never, '80mm'), await printService.generateCreditNoteReceiptHtml(printable as never, profile as never, '58mm')]) {
        expect(html, ctx).toContain(totalText)
        const hasTaxRows = /(CGST|SGST|IGST|>GST<|Taxable value)/.test(html.replace(/GSTIN/g, ''))
        expect(hasTaxRows, ctx + ' tax rows ' + note.taxAmount).toBe(note.taxAmount > 0)
        if (note.taxAmount > 0) {
          const rateTaxes = (note.items as any[]).length > 0 ? (note.items as any[]).map(i => ({ taxRate: i.taxRate, taxAmount: i.taxAmount })) : [{ taxRate: note.taxRate ?? 0, taxAmount: note.taxAmount }]
          const shown = gstPresentationLines(note.gstType, note.taxAmount, d, rateTaxes)
          expect(sumMoney(shown.map(l => l.amount), d), ctx).toBe(note.taxAmount)
          for (const l of shown) {
            expect(html, ctx + l.label).toContain(`>${l.label}<`)
            expect(html, ctx + l.label).toContain(formatAmount(l.amount, '#', 'IN', d))
          }
        }
        expect(/-0(?![0-9.])|NaN|undefined/.test(html.replace(/-0[0-9]/g, '')), ctx + ' junk').toBe(false)
      }
    }
  }, 120_000)

  it('the invoice rounding rule never changes a note: total = taxable + tax whatever rule the business has', async () => {
    for (const rule of RULE_SETTINGS) {
      for (const cur of ['INR', 'USD']) {
        const world = makeWorld({ currency: cur })
        world.db.setting.findUnique = vi.fn(async ({ where }: any) => (where.settingKey === 'invoice_rounding_rule' && rule ? { settingKey: where.settingKey, settingValue: rule } : null))
        vi.mocked(getPrisma).mockReturnValue(world.db as never)
        await creditNoteService.create({ reason: 'r', amount: 1234.56, taxApplied: true, taxRate: 18 } as never, 'u')
        const n = world.stateOf('cn-1')
        expect([n.taxAmount, n.amount]).toEqual([222.22, 1456.78])
      }
    }
  })

  it('3 toggling tax on and off, switching pricing mode and editing leave no drift: books and ledger end where a fresh note would (600 random edit sequences)', async () => {
    const r = rng(303)
    for (let n = 0; n < 600; n++) {
      const currency = CURRENCIES[n % 4]
      const d = getCurrencyDecimals(currency)
      const base = randomNote(r, d)
      const world = makeWorld({ currency })
      vi.mocked(getPrisma).mockReturnValue(world.db as never)
      vi.mocked(customerLedgerService.addEntry).mockClear()
      await creditNoteService.create({ customerId: 'c1', reason: 'r', ...base } as never, 'u')
      let applied = base.taxApplied
      let incl = base.pricesIncludeTax
      const steps = 1 + Math.floor(r() * 6)
      for (let k = 0; k < steps; k++) {
        const pick = r()
        if (pick < 0.5) applied = !applied
        else incl = !incl
        const res = await creditNoteService.update('cn-1', { taxApplied: applied, pricesIncludeTax: incl, ...(applied && !(base as any).items ? { taxRate: (base as any).taxRate } : {}) } as never, 'u')
        expect(res.success, JSON.stringify({ n, res })).toBe(true)
      }
      // a fresh note with the same final settings, on the note's own entered amount
      const fresh = makeWorld({ currency })
      vi.mocked(getPrisma).mockReturnValue(fresh.db as never)
      vi.mocked(customerLedgerService.addEntry).mockClear()
      const enteredBase = base as any
      await creditNoteService.create({ customerId: 'c1', reason: 'r', ...enteredBase, taxApplied: applied, pricesIncludeTax: incl } as never, 'u')
      const a = world.stateOf('cn-1')
      const b = fresh.stateOf('cn-1')
      const ctx = JSON.stringify({ n, currency, base, applied, incl })
      // the entered amount is preserved through every toggle, so the final figures equal a fresh note's
      expect([a.amount, a.taxAmount], ctx).toEqual([b.amount, b.taxAmount])
      // whatever happened, the live journal is balanced and equals the current note, the ledger net equals the note
      const live = liveJournalNet(world.journals)
      expect(live.debit, ctx).toBe(live.credit)
      expect(live.credit, ctx).toBe(a.amount)
      expect(live.tax, ctx).toBe(a.taxAmount)
      expect(live.revenue, ctx).toBe(roundMoney(a.amount - a.taxAmount, d))
      expect(clean(a.amount, d) && clean(a.taxAmount, d), ctx).toBe(true)
    }
  }, 120_000)

  it('5 edge cases: 0.01, rate 0.25, 100 percent of the linked invoice, larger than the invoice, partial notes adding up to it', async () => {
    // 0.01 with tax
    let w = makeWorld({ currency: 'INR' })
    vi.mocked(getPrisma).mockReturnValue(w.db as never)
    await creditNoteService.create({ reason: 'r', amount: 0.01, taxApplied: true, taxRate: 18 } as never, 'u')
    expect([w.stateOf('cn-1').amount, w.stateOf('cn-1').taxAmount]).toEqual([0.01, 0])
    // rate 0.25
    w = makeWorld({ currency: 'INR' })
    vi.mocked(getPrisma).mockReturnValue(w.db as never)
    await creditNoteService.create({ reason: 'r', amount: 1000, taxApplied: true, taxRate: 0.25 } as never, 'u')
    expect([w.stateOf('cn-1').amount, w.stateOf('cn-1').taxAmount]).toEqual([1002.5, 2.5])
    // 100 percent of a linked invoice of 1180 (1000 + 18%): the note zeroes the balance and equals the invoice
    w = makeWorld({ currency: 'INR', linked: { balance: 1180, total: 1180, items: [{ taxRate: 18, lineTotal: 1180 }] } })
    vi.mocked(getPrisma).mockReturnValue(w.db as never)
    await creditNoteService.create({ invoiceId: 'inv-1', reason: 'r', amount: 1000, taxApplied: true } as never, 'u') // rate falls back to the invoice's own 18
    expect(w.stateOf('cn-1').amount).toBe(1180)
    expect(w.invoiceUpdates[0]).toMatchObject({ balanceAmount: 0, paymentStatus: 'PAID' })
    // larger than the linked invoice: existing rule, the excess becomes a general customer credit and only the balance is applied
    w = makeWorld({ currency: 'INR', linked: { balance: 1180, total: 1180, items: [{ taxRate: 18, lineTotal: 1180 }] } })
    vi.mocked(getPrisma).mockReturnValue(w.db as never)
    await creditNoteService.create({ invoiceId: 'inv-1', reason: 'r', amount: 2000, taxApplied: true } as never, 'u')
    expect(w.stateOf('cn-1').amount).toBe(2360)
    expect(w.invoiceUpdates[0].balanceAmount).toBe(0)
    // partial notes that add up to the document: 40 percent and 60 percent
    w = makeWorld({ currency: 'INR', linked: { balance: 1180, total: 1180, items: [{ taxRate: 18, lineTotal: 1180 }] } })
    vi.mocked(getPrisma).mockReturnValue(w.db as never)
    await creditNoteService.create({ invoiceId: 'inv-1', reason: 'r', amount: 400, taxApplied: true } as never, 'u')
    await creditNoteService.create({ invoiceId: 'inv-1', reason: 'r', amount: 600, taxApplied: true } as never, 'u')
    const total = sumMoney([w.stateOf('cn-1').amount, w.stateOf('cn-2').amount], 2)
    expect(total).toBe(1180)
    expect(w.invoiceUpdates.at(-1)).toMatchObject({ balanceAmount: 0, paymentStatus: 'PAID' })
    // no tax on a taxed linked invoice is allowed (the form warns; the service does not block)
    w = makeWorld({ currency: 'INR', linked: { balance: 1180, total: 1180, items: [{ taxRate: 18, lineTotal: 1180 }] } })
    vi.mocked(getPrisma).mockReturnValue(w.db as never)
    const noTax = await creditNoteService.create({ invoiceId: 'inv-1', reason: 'r', amount: 1000, taxApplied: false } as never, 'u')
    expect(noTax.success).toBe(true)
    expect([w.stateOf('cn-1').amount, w.stateOf('cn-1').taxAmount]).toEqual([1000, 0])
  })

  it('a legacy note (made before the choice existed, no tax fields) keeps behaving as before when edited', async () => {
    const w = makeWorld({ currency: 'INR' })
    w.notes.set('cn-old', { id: 'cn-old', creditNoteNumber: 'CN-00001', customerId: 'c1', invoiceId: null, reason: 'x', amount: 500, items: [], pricesIncludeTax: false, appliedToInvoiceAmount: null })
    vi.mocked(getPrisma).mockReturnValue(w.db as never)
    const res = await creditNoteService.update('cn-old', { amount: 700 } as never, 'u')
    expect(res.success).toBe(true)
    expect(w.stateOf('cn-old').amount).toBe(700)
    expect(w.journals).toHaveLength(0) // a note that never had a posting does not get an invented one
  })

  it('an itemised note does not accept a typed-over amount, but tax can be switched on its lines', async () => {
    const w = makeWorld({ currency: 'INR' })
    vi.mocked(getPrisma).mockReturnValue(w.db as never)
    await creditNoteService.create({ reason: 'r', items: [{ serviceDescription: 'A', quantity: 2, unitPrice: 500, taxRate: 18 }] } as never, 'u')
    expect(w.stateOf('cn-1').amount).toBe(1180)
    const bad = await creditNoteService.update('cn-1', { amount: 999 } as never, 'u')
    expect(bad.success).toBe(false)
    expect((bad as { error: { code: string } }).error.code).toBe('CN-005')
    const off = await creditNoteService.update('cn-1', { taxApplied: false } as never, 'u')
    expect(off.success).toBe(true)
    expect([w.stateOf('cn-1').amount, w.stateOf('cn-1').taxAmount]).toEqual([1000, 0])
    expect(w.stateOf('cn-1').items[0]).toMatchObject({ taxAmount: 0, lineTotal: 1000, taxRate: 18 })
    const on = await creditNoteService.update('cn-1', { taxApplied: true } as never, 'u')
    expect(on.success).toBe(true)
    expect([w.stateOf('cn-1').amount, w.stateOf('cn-1').taxAmount]).toEqual([1180, 180])
    const live = liveJournalNet(w.journals)
    expect(live.debit).toBe(live.credit)
    expect(live.credit).toBe(1180)
  })
})

describe('debit note: one figure everywhere, tax on or off', () => {
  it('the form total, the saved note, the supplier ledger, the journal and the print agree (600 random notes)', async () => {
    const r = rng(2027)
    for (let n = 0; n < 600; n++) {
      const currency = CURRENCIES[n % 4]
      const d = getCurrencyDecimals(currency)
      const input = randomNote(r, d)
      const world = makeWorld({ currency })
      vi.mocked(getPrisma).mockReturnValue(world.db as never)
      vi.mocked(supplierLedgerService.addEntry).mockClear()
      const ctx = JSON.stringify({ n, currency, input })
      const form = computeNoteTotals({ items: (input as any).items, amount: (input as any).amount, taxApplied: input.taxApplied, taxRate: (input as any).taxRate, pricesIncludeTax: input.pricesIncludeTax, decimals: d })
      const res = await debitNoteService.create({ supplierId: 's1', reason: 'r', ...input } as never, 'u')
      expect(res.success, ctx + JSON.stringify((res as any).error)).toBe(true)
      const note = world.stateOf('dn-1')
      expect([note.amount, note.taxAmount], ctx).toEqual([form.totalAmount, form.taxAmount])
      for (const x of [note.amount, note.taxAmount]) expect(clean(x, d), ctx).toBe(true)
      if (!input.taxApplied) expect(note.taxAmount, ctx).toBe(0)
      expect(ledgerNet(vi.mocked(supplierLedgerService.addEntry) as never, 'debit'), ctx).toBe(note.amount)
      const lines = world.journals[0].lines
      expect(sumMoney(lines.map(l => l.debitAmount), 3), ctx).toBe(sumMoney(lines.map(l => l.creditAmount), 3))
      expect(lines.find(l => l.accountId === 'coa-2000')!.debitAmount, ctx).toBe(note.amount)
      expect(lines.find(l => l.accountId === 'coa-6000')!.creditAmount, ctx).toBe(note.amount)

      const profile = { currencyCode: currency, currencySymbol: '#', taxModel: 'GST', businessName: 'B' }
      vi.mocked(getPrisma).mockReturnValue({ ...world.db, setting: { findMany: vi.fn().mockResolvedValue([]) } } as never)
      const printable = { ...note, createdAt: new Date(), supplier: { supplierName: 'S' }, purchaseOrder: null }
      const totalText = formatAmount(note.amount, '#', 'IN', d)
      for (const html of [await printService.generateDebitNoteHtml(printable as never, profile as never), await printService.generateDebitNoteReceiptHtml(printable as never, profile as never, '80mm')]) {
        expect(html, ctx).toContain(totalText)
        expect(/(CGST|SGST|IGST|>GST<|Taxable value)/.test(html.replace(/GSTIN/g, '')), ctx).toBe(note.taxAmount > 0)
      }
    }
  }, 120_000)
})

describe('reports include a credit note only when tax was applied, and equal the note to the minor unit', () => {
  function reportDb(currency: string, notes: Array<Record<string, any>>) {
    const db: Record<string, any> = {
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ taxModel: 'GST', state: 'Maharashtra', currencyCode: currency, taxNumber: null }) },
      invoiceItem: { findMany: vi.fn().mockResolvedValue([]) },
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
      bill: { findMany: vi.fn().mockResolvedValue([]) },
      expense: { findMany: vi.fn().mockResolvedValue([]) },
      taxConfiguration: { findMany: vi.fn().mockResolvedValue([]) },
      creditNote: {
        findMany: vi.fn(async ({ where }: any) => notes.filter(n => (where.taxApplied === undefined || n.taxApplied === where.taxApplied) && (!where.taxAmount || n.taxAmount > where.taxAmount.gt))
          .map(n => ({ ...n, customer: n.customer ?? null }))
        )
      }
    }
    return db
  }
  const RANGE = { dateFrom: '2026-01-01', dateTo: '2026-12-31' }

  it('random notes: Tax report, GSTR-1 (register + net totals) and GSTR-3B carry exactly the applied tax (500 notes)', async () => {
    const r = rng(77)
    for (let n = 0; n < 500; n++) {
      const currency = CURRENCIES[n % 4]
      const d = getCurrencyDecimals(currency)
      const input = randomNote(r, d)
      const totals = computeNoteTotals({ items: (input as any).items, amount: (input as any).amount, taxApplied: input.taxApplied, taxRate: (input as any).taxRate, pricesIncludeTax: input.pricesIncludeTax, decimals: d })
      const registered = r() < 0.5
      const other = r() < 0.5
      const note = {
        id: 'n1', creditNoteNumber: 'CN-1', createdAt: new Date('2026-06-15T10:00:00'), amount: totals.totalAmount, taxApplied: input.taxApplied, taxAmount: totals.taxAmount,
        taxRate: totals.taxRate, pricesIncludeTax: input.pricesIncludeTax, gstType: input.gstType,
        customer: { customerName: 'C', taxNumber: registered ? '27AAPFU0939F1ZV' : null, state: other ? 'Gujarat' : 'Maharashtra' },
        items: ((input as any).items ?? []).map((i: any, k: number) => ({ id: `i${k}`, serviceDescription: i.serviceDescription, quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate, taxAmount: totals.lines[k].tax, lineTotal: totals.lines[k].total }))
      }
      vi.mocked(getPrisma).mockReturnValue(reportDb(currency, [note]) as never)
      const ctx = JSON.stringify({ n, currency, input, registered, other })
      const tax = await reportService.generateTaxReport(RANGE)
      const g1 = await reportService.generateGSTR1(RANGE)
      const g3 = await reportService.generateGSTR3BPreview(RANGE)
      const expectedTax = totals.taxAmount
      if (!input.taxApplied || expectedTax === 0) {
        expect(tax.summary.totalTaxCollected, ctx).toBe(0)
        expect(g1.cdnr, ctx).toEqual([])
        expect([g1.summary.totalIgst, g1.summary.totalCgst, g1.summary.totalSgst], ctx).toEqual([0, 0, 0])
        expect(g3.table31.taxAmount, ctx).toEqual({ igst: 0, cgst: 0, sgst: 0 })
        continue
      }
      // negative: a credit note reduces the tax collected. The "GST" presentation follows the place of supply.
      expect(tax.summary.totalTaxCollected, ctx).toBe(-expectedTax)
      const g1Tax = roundMoney(g1.summary.totalIgst + g1.summary.totalCgst + g1.summary.totalSgst, d)
      expect(g1Tax, ctx).toBe(-expectedTax)
      const g3Tax = roundMoney(g3.table31.taxAmount.igst + g3.table31.taxAmount.cgst + g3.table31.taxAmount.sgst, d)
      expect(g3Tax, ctx).toBe(-expectedTax)
      if (registered) {
        expect(sumMoney(g1.cdnr.map(x => x.igstAmount + x.cgstAmount + x.sgstAmount), d), ctx).toBe(-expectedTax)
        expect(g1.cdnr.every(x => x.noteValue === -totals.totalAmount), ctx).toBe(true)
        expect(g1.summary.totalCdnrValue, ctx).toBe(-totals.totalAmount)
      } else {
        expect(g1.cdnr, ctx).toEqual([])
      }
      const mode = input.gstType === 'GST' ? (other ? 'IGST' : 'CGST_SGST') : input.gstType
      if (mode === 'IGST') expect(g3.table31.taxAmount.cgst + g3.table31.taxAmount.sgst, ctx).toBe(0)
      else expect(g3.table31.taxAmount.igst, ctx).toBe(0)
    }
  }, 120_000)
})
