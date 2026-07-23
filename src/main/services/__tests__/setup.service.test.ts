import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../../database/seed', () => ({ seedDefaultData: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../auth.service', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed'),
  generateRecoveryCode: vi.fn().mockReturnValue('RECOVERY-CODE-123'),
}))
vi.mock('../industry-template.service', () => ({
  SERVICE_TEMPLATE_TYPES: new Set(['VET_CLINIC']),
  getLanguageLockFor: vi.fn().mockReturnValue('multi'),
}))
vi.mock('../service-catalog.service', () => ({ seedDefaultServicesForTemplate: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { completeSetup } from '../setup.service'
import { seedDefaultServicesForTemplate } from '../service-catalog.service'

function makeSetupPayload(overrides: Record<string, unknown> = {}) {
  return {
    businessName: 'Test Vet Clinic', businessType: 'VET_CLINIC',
    ownerName: 'Owner', country: 'IN', currencyCode: 'INR', currencySymbol: '₹',
    taxModel: 'GST', phone: '9999999999', email: 'a@b.com', taxNumber: null, upiId: null, logoPath: null,
    adminFullName: 'Admin User', adminUsername: 'admin', adminPassword: 'password123',
    ...overrides,
  }
}

// Real Prisma-shaped mock DB. `committed` tracks whether $transaction's
// callback ever resolved without throwing — a lightweight stand-in for real
// transactional rollback, letting these tests assert that a failure deep
// inside the transaction (e.g. seedDefaultServicesForTemplate throwing)
// means NOTHING from that attempt should be treated as durably saved.
function makeMockDb() {
  let committed = false
  const txClient: Record<string, any> = {
    businessProfile: { deleteMany: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({ id: 'biz-1' }) },
    user: { create: vi.fn().mockResolvedValue({ id: 'user-1' }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    taxConfiguration: { findFirst: vi.fn().mockResolvedValue({ id: 'tax-1' }), create: vi.fn().mockResolvedValue({}) },
    expenseCategory: { findUnique: vi.fn().mockResolvedValue({ id: 'exp-1' }), create: vi.fn().mockResolvedValue({}) },
    setting: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      upsert: vi.fn().mockResolvedValue({}),
    },
  }
  const db: Record<string, any> = {
    role: { findFirst: vi.fn().mockResolvedValue({ id: 'role-admin' }) },
    user: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => {
      const result = await cb(txClient) // an unhandled throw here propagates out, matching real rollback-on-error semantics
      committed = true
      return result
    }),
  }
  return { db, txClient, isCommitted: () => committed }
}

beforeEach(() => vi.clearAllMocks())

describe('setup.service.completeSetup', () => {
  it('completes successfully and seeds the service catalog for a service-template business type', async () => {
    const { db } = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await completeSetup(makeSetupPayload() as never)

    expect(res.success).toBe(true)
    expect(seedDefaultServicesForTemplate).toHaveBeenCalledWith('VET_CLINIC', expect.anything())
  })

  it('does not seed a service catalog for a non-service-template business type', async () => {
    const { db } = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await completeSetup(makeSetupPayload({ businessType: 'RETAIL' }) as never)

    expect(res.success).toBe(true)
    expect(seedDefaultServicesForTemplate).not.toHaveBeenCalled()
  })

  // Regression for a real defect found 2026-07-22: seedDefaultServicesForTemplate
  // used to run AFTER the setup transaction had already committed, on the
  // reasoning that it was "not critical." If it failed, the business
  // profile + admin user already existed, so isSetupComplete() would report
  // true and the wizard could never be re-entered — permanently missing its
  // default service catalog with no in-app recovery path. Now it runs
  // INSIDE the same transaction, so a failure here must fail the whole
  // setup atomically instead of leaving a partial, unrecoverable state.
  it('fails the WHOLE setup atomically if seeding the service catalog fails, instead of leaving a partial unrecoverable state', async () => {
    const { db, isCommitted } = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(seedDefaultServicesForTemplate).mockRejectedValueOnce(new Error('disk full'))

    const res = await completeSetup(makeSetupPayload() as never)

    expect(res.success).toBe(false)
    // The transaction callback threw, so it must never have been treated
    // as committed — a real rollback, not a partially-applied setup.
    expect(isCommitted()).toBe(false)
  })

  it('passes the transaction client, not a fresh top-level connection, to seedDefaultServicesForTemplate', async () => {
    const { db, txClient } = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await completeSetup(makeSetupPayload() as never)

    const callArgs = vi.mocked(seedDefaultServicesForTemplate).mock.calls[0]
    expect(callArgs[1]).toBe(txClient)
  })

  it('rejects a duplicate admin username before touching anything else', async () => {
    const { db } = makeMockDb()
    db.user.findUnique = vi.fn().mockResolvedValue({ id: 'existing-user' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await completeSetup(makeSetupPayload() as never)

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('USER-001')
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})
