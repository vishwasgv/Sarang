import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { seedDefaultTemplates, getLanguageLockFor } from '../industry-template.service'

// Regression coverage for the Phase 46 finding: seedDefaultTemplates's upsert
// used `update: {}` (a pure no-op) for any businessType row that already
// existed, so adding a new mandatory default module to TEMPLATE_DEFAULTS
// (e.g. BEAUTY_SALON's multi_service_booking, SPECIALIST_CLINIC's
// specialist_referral) never reached an install whose row was persisted
// before that module existed — the UI would silently regress to its
// pre-flag behavior for those installs only. Now it backfills missing
// default modules into existing rows without touching anything else.

function makeMockDb(rows: Record<string, { enabledModules: string }>) {
  const updateCalls: { where: { businessType: string }; data: { enabledModules: string } }[] = []
  const createCalls: { data: { businessType: string; enabledModules: string } }[] = []
  const db = {
    industryTemplateSetting: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { businessType: string } }) =>
        Promise.resolve(rows[where.businessType] ?? null)
      ),
      create: vi.fn().mockImplementation((args: { data: { businessType: string; enabledModules: string } }) => {
        createCalls.push(args)
        return Promise.resolve(args.data)
      }),
      update: vi.fn().mockImplementation((args: { where: { businessType: string }; data: { enabledModules: string } }) => {
        updateCalls.push(args)
        return Promise.resolve(args.data)
      }),
    },
  }
  return { db, updateCalls, createCalls }
}

describe('seedDefaultTemplates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('backfills a missing new default module into an existing row without touching the rest', async () => {
    // Simulates a BEAUTY_SALON row persisted before Phase 46 added
    // 'multi_service_booking' to its defaults — plus a manually-enabled
    // opt-in module (Phase 38 barcode toggle) that must survive untouched.
    const { db, updateCalls } = makeMockDb({
      BEAUTY_SALON: { enabledModules: JSON.stringify(['appointments', 'service_catalog', 'session_packs', 'staff_commission', 'barcode_generation']) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await seedDefaultTemplates()

    const salonUpdate = updateCalls.find((c) => c.where.businessType === 'BEAUTY_SALON')
    expect(salonUpdate).toBeDefined()
    const merged = JSON.parse(salonUpdate!.data.enabledModules) as string[]
    expect(merged).toContain('multi_service_booking')
    expect(merged).toContain('barcode_generation') // manual opt-in preserved
    expect(merged).toContain('session_packs') // pre-existing default preserved
  })

  it('backfills specialist_referral into an existing SPECIALIST_CLINIC row', async () => {
    const { db, updateCalls } = makeMockDb({
      SPECIALIST_CLINIC: { enabledModules: JSON.stringify(['appointments', 'service_catalog', 'visit_notes']) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await seedDefaultTemplates()

    const update = updateCalls.find((c) => c.where.businessType === 'SPECIALIST_CLINIC')
    expect(update).toBeDefined()
    expect(JSON.parse(update!.data.enabledModules)).toContain('specialist_referral')
  })

  // Phase 50 — Doctor Clinic Breadth Audit: SPECIALIST_CLINIC previously lacked
  // token_queue (only GP_CLINIC had it), narrowing "any specialty" coverage for
  // the common walk-in-queue workflow. Confirms an install whose row predates
  // this phase gets backfilled, same mechanism Phase 46 built for exactly this.
  it('backfills token_queue into an existing SPECIALIST_CLINIC row', async () => {
    const { db, updateCalls } = makeMockDb({
      SPECIALIST_CLINIC: { enabledModules: JSON.stringify(['appointments', 'service_catalog', 'visit_notes', 'specialist_referral']) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await seedDefaultTemplates()

    const update = updateCalls.find((c) => c.where.businessType === 'SPECIALIST_CLINIC')
    expect(update).toBeDefined()
    expect(JSON.parse(update!.data.enabledModules)).toContain('token_queue')
  })

  it('does not call update when an existing row already has every default module', async () => {
    // GENERAL's defaults are exactly LOGISTICS_MODULES — a row already
    // matching TEMPLATE_DEFAULTS must be left alone entirely (no spurious
    // writes on every app launch).
    const { db, updateCalls } = makeMockDb({
      GENERAL: {
        enabledModules: JSON.stringify([
          'logistics_fleet', 'logistics_carriers', 'logistics_shipments',
          'logistics_grn', 'logistics_challan', 'logistics_freight', 'logistics_analytics',
        ]),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await seedDefaultTemplates()

    expect(updateCalls.find((c) => c.where.businessType === 'GENERAL')).toBeUndefined()
  })

  it('creates a fresh row with full defaults for a businessType with no existing row', async () => {
    const { db, createCalls } = makeMockDb({})
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await seedDefaultTemplates()

    const salonCreate = createCalls.find((c) => c.data.businessType === 'BEAUTY_SALON')
    expect(salonCreate).toBeDefined()
    expect(JSON.parse(salonCreate!.data.enabledModules)).toContain('multi_service_booking')
  })

  // Phase 49 — Agricultural Inputs & Equipment. Reuses PHARMACY's batch/expiry
  // modules and ELECTRONICS's serial/warranty modules, but deliberately WITHOUT
  // imei_tracking (IMEI is phone-specific, doesn't apply to farm equipment) —
  // plus job_cards (REPAIR's generic model) for equipment servicing.
  it('creates AGRI_INPUTS with batch/expiry/serial/warranty/job_cards but not imei_tracking', async () => {
    const { db, createCalls } = makeMockDb({})
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await seedDefaultTemplates()

    const agriCreate = createCalls.find((c) => c.data.businessType === 'AGRI_INPUTS')
    expect(agriCreate).toBeDefined()
    const modules = JSON.parse(agriCreate!.data.enabledModules) as string[]
    expect(modules).toEqual(expect.arrayContaining(['batch_tracking', 'expiry_tracking', 'serial_tracking', 'warranty_tracking', 'job_cards']))
    expect(modules).not.toContain('imei_tracking')
  })
})

describe('getLanguageLockFor', () => {
  it('returns multi for AGRI_INPUTS (PRODUCT-category, not a service template)', () => {
    expect(getLanguageLockFor('AGRI_INPUTS')).toBe('multi')
  })
})
