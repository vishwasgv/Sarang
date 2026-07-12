import { describe, it, expect, vi } from 'vitest'
import { generateSequenceNumber, SequenceContendedError } from '../sequence.service'

function makeTx(settingRow: { settingKey: string; settingValue: string } | null) {
  let stored = settingRow
  return {
    setting: {
      findUnique: vi.fn(async () => stored),
      update: vi.fn(async ({ data }: { data: { settingValue: string } }) => {
        stored = stored ? { ...stored, settingValue: data.settingValue } : null
        return stored
      }),
      // Atomic-claim: only actually writes when the caller's `where.settingValue`
      // still matches what's stored — a concurrent caller that already moved
      // the tip makes this a no-op (count: 0), which generateSequenceNumber
      // treats as contended and throws.
      updateMany: vi.fn(async ({ where, data }: { where: { settingKey: string; settingValue: string }; data: { settingValue: string } }) => {
        if (!stored || stored.settingValue !== where.settingValue) return { count: 0 }
        stored = { ...stored, settingValue: data.settingValue }
        return { count: 1 }
      }),
      create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => {
        if (stored) throw new Error('Unique constraint failed on settingKey')
        stored = { settingKey: data.settingKey, settingValue: data.settingValue }
        return stored
      })
    }
  }
}

describe('generateSequenceNumber', () => {
  it('bootstraps from the highest existing document number on first use', async () => {
    const tx = makeTx(null)
    const bootstrap = vi.fn(async () => 7) // e.g. legacy rows already go up to QT-00007

    const result = await generateSequenceNumber(tx as never, 'quotation_sequence', 'QT', 5, bootstrap)

    expect(bootstrap).toHaveBeenCalledTimes(1)
    expect(result).toBe('QT-00008')
    expect(tx.setting.create).toHaveBeenCalledWith({
      data: { settingKey: 'quotation_sequence', settingValue: '8', settingType: 'NUMBER' }
    })
  })

  it('starts at 1 when there is no legacy data and no Setting row yet', async () => {
    const tx = makeTx(null)
    const bootstrap = vi.fn(async () => 0)

    const result = await generateSequenceNumber(tx as never, 'credit_note_sequence', 'CN', 5, bootstrap)

    expect(result).toBe('CN-00001')
  })

  it('increments an existing sequence without touching the bootstrap function', async () => {
    const tx = makeTx({ settingKey: 'debit_note_sequence', settingValue: '41' })
    const bootstrap = vi.fn(async () => 0)

    const result = await generateSequenceNumber(tx as never, 'debit_note_sequence', 'DN', 5, bootstrap)

    expect(bootstrap).not.toHaveBeenCalled()
    expect(result).toBe('DN-00042')
    expect(tx.setting.updateMany).toHaveBeenCalledWith({
      where: { settingKey: 'debit_note_sequence', settingValue: '41' },
      data: { settingValue: '42' }
    })
  })

  it('throws SequenceContendedError when a concurrent caller already moved the tip since this call read it', async () => {
    // Simulates the exact race this atomic claim exists to close: this
    // caller read prevValue '41' and computed nextNum 42, but by the time
    // its updateMany runs, another transaction already moved the tip to
    // something else — the conditional WHERE no longer matches, so the
    // claim is a no-op (count: 0) rather than a silent stale overwrite.
    const tx = makeTx({ settingKey: 'debit_note_sequence', settingValue: '41' })
    tx.setting.updateMany.mockResolvedValueOnce({ count: 0 })
    const bootstrap = vi.fn(async () => 0)

    await expect(
      generateSequenceNumber(tx as never, 'debit_note_sequence', 'DN', 5, bootstrap)
    ).rejects.toThrow(SequenceContendedError)
  })

  it('throws SequenceContendedError when a concurrent caller wins the first-ever create() (narrow bootstrap race)', async () => {
    // Deterministically forces the scenario the try/catch in generateSequenceNumber
    // exists for: this caller computed nextNum from the bootstrap function, but by
    // the time its create() runs, another transaction has already claimed the
    // Setting row (simulated here directly rather than via real concurrency, which
    // would make the test's outcome depend on microtask-scheduling order). Rolls
    // back and lets the caller's own $transaction retry from scratch rather than
    // silently claiming a number that might already be stale by the time the
    // fallback's own read-then-write ran.
    const tx = makeTx(null)
    tx.setting.create.mockRejectedValueOnce(new Error('Unique constraint failed on settingKey'))
    const bootstrap = vi.fn(async () => 3)

    await expect(
      generateSequenceNumber(tx as never, 'quotation_sequence', 'QT', 5, bootstrap)
    ).rejects.toThrow(SequenceContendedError)
  })
})
