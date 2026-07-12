import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { createAppointment, updateAppointment, generateAppointmentInvoice, generateAppointmentBatchInvoice } from '../appointment.service'

// Regression coverage for the Phase 22 re-audit finding: createAppointment's
// duration-aware conflict check existed but wasn't atomic with the write
// (a TOCTOU race), and updateAppointment had no conflict check at all — a
// reschedule could silently double-book a provider. Both are now fixed by
// running the check and the write inside the same db.$transaction().

function makeExistingAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'apt-existing', appointmentNumber: 'APT-0001', providerId: 'prov-1',
    scheduledDate: new Date('2026-07-10T00:00:00.000Z'), scheduledTime: '10:00', durationMinutes: 30,
    status: 'SCHEDULED',
    ...overrides
  }
}

function makeMockDb(
  existingAppointments: ReturnType<typeof makeExistingAppointment>[] = [],
  opts: { schedule?: Record<string, unknown> | null; holiday?: Record<string, unknown> | null } = {}
) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    // Defaults to "no schedule configured, no holiday" — validateProviderScheduleWindow
    // treats an absent schedule as a no-op (see appointment.service.ts's own
    // comment), so every pre-existing test in this file that doesn't care
    // about schedule/holiday behavior is unaffected by this fixture existing.
    providerSchedule: {
      findUnique: vi.fn().mockResolvedValue(opts.schedule ?? null),
    },
    clinicHoliday: {
      findFirst: vi.fn().mockResolvedValue(opts.holiday ?? null),
    },
    setting: {
      findUnique: vi.fn(async () => settingRow),
      updateMany: vi.fn(async ({ where, data }: { where: { settingValue: string }; data: { settingValue: string } }) => {
        if (!settingRow || settingRow.settingValue !== where.settingValue) return { count: 0 }
        settingRow = { ...settingRow, settingValue: data.settingValue }
        return { count: 1 }
      }),
      create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => {
        settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }
        return settingRow
      }),
    },
    appointment: {
      // Mirrors the one filter findProviderConflict actually relies on for
      // correctness — excluding the appointment's own row via id: { not }.
      // Without this, "excludes the appointment's own row" couldn't fail.
      findMany: vi.fn().mockImplementation(({ where }: { where: { id?: { not?: string } } }) => {
        const excludeId = where?.id?.not
        return Promise.resolve(
          excludeId ? existingAppointments.filter(a => a.id !== excludeId) : existingAppointments
        )
      }),
      findFirst: vi.fn().mockResolvedValue(
        existingAppointments.length > 0
          ? [...existingAppointments].sort((a, b) => b.appointmentNumber.localeCompare(a.appointmentNumber))[0]
          : null
      ),
      findUnique: vi.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) =>
        Promise.resolve(existingAppointments.find(a => a.id === id) ?? null)
      ),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'apt-new', ...data })
      ),
      update: vi.fn().mockImplementation(({ where: { id }, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ ...existingAppointments.find(a => a.id === id), ...data })
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
  return db
}

describe('appointment.service — provider conflict detection', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('createAppointment', () => {
    it('succeeds when the provider has no overlapping appointment', async () => {
      const db = makeMockDb([makeExistingAppointment({ scheduledTime: '14:00' })])
      vi.mocked(getPrisma).mockReturnValue(db as never)

      const res = await createAppointment({
        providerId: 'prov-1', serviceTitle: 'Checkup', scheduledDate: '2026-07-10', scheduledTime: '10:00', durationMinutes: 30
      })

      expect(res.success).toBe(true)
      expect(db.appointment.create).toHaveBeenCalled()
    })

    it('rejects an overlapping booking and does not create the row', async () => {
      const db = makeMockDb([makeExistingAppointment({ scheduledTime: '10:00', durationMinutes: 30 })])
      vi.mocked(getPrisma).mockReturnValue(db as never)

      const res = await createAppointment({
        providerId: 'prov-1', serviceTitle: 'Checkup', scheduledDate: '2026-07-10', scheduledTime: '10:15', durationMinutes: 30
      })

      expect(res.success).toBe(false)
      expect((res as { error: { code: string } }).error.code).toBe('APT-CONFLICT')
      expect(db.appointment.create).not.toHaveBeenCalled()
    })

    it('runs the conflict check and the write inside the same transaction (not two separate calls)', async () => {
      const db = makeMockDb([])
      vi.mocked(getPrisma).mockReturnValue(db as never)

      await createAppointment({
        providerId: 'prov-1', serviceTitle: 'Checkup', scheduledDate: '2026-07-10', scheduledTime: '10:00', durationMinutes: 30
      })

      expect(db.$transaction).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateAppointment', () => {
    it('rejects rescheduling into another appointment\'s slot', async () => {
      const db = makeMockDb([
        makeExistingAppointment({ id: 'apt-a', appointmentNumber: 'APT-0001', scheduledTime: '10:00', durationMinutes: 30 }),
        makeExistingAppointment({ id: 'apt-b', appointmentNumber: 'APT-0002', scheduledTime: '14:00', durationMinutes: 30 }),
      ])
      vi.mocked(getPrisma).mockReturnValue(db as never)

      const res = await updateAppointment({ id: 'apt-b', scheduledTime: '10:15' })

      expect(res.success).toBe(false)
      expect((res as { error: { code: string } }).error.code).toBe('APT-CONFLICT')
      expect(db.appointment.update).not.toHaveBeenCalled()
    })

    it('excludes the appointment\'s own existing row from the conflict scan', async () => {
      // Rescheduling apt-a to the same time it already occupies must not conflict with itself.
      const db = makeMockDb([
        makeExistingAppointment({ id: 'apt-a', appointmentNumber: 'APT-0001', scheduledTime: '10:00', durationMinutes: 30 }),
      ])
      vi.mocked(getPrisma).mockReturnValue(db as never)

      const res = await updateAppointment({ id: 'apt-a', notes: 'confirmed by phone' })

      expect(res.success).toBe(true)
      expect(db.appointment.update).toHaveBeenCalled()
    })

    it('succeeds when rescheduled to a free slot', async () => {
      const db = makeMockDb([
        makeExistingAppointment({ id: 'apt-a', appointmentNumber: 'APT-0001', scheduledTime: '10:00', durationMinutes: 30 }),
        makeExistingAppointment({ id: 'apt-b', appointmentNumber: 'APT-0002', scheduledTime: '14:00', durationMinutes: 30 }),
      ])
      vi.mocked(getPrisma).mockReturnValue(db as never)

      const res = await updateAppointment({ id: 'apt-b', scheduledTime: '16:00' })

      expect(res.success).toBe(true)
      expect(db.appointment.update).toHaveBeenCalled()
    })

    it('returns a not-found error for a missing appointment', async () => {
      const db = makeMockDb([])
      vi.mocked(getPrisma).mockReturnValue(db as never)

      const res = await updateAppointment({ id: 'does-not-exist', scheduledTime: '10:00' })

      expect(res.success).toBe(false)
      expect((res as { error: { code: string } }).error.code).toBe('APT-005')
    })
  })
})

// Fresh-audit fix (2026-07-12): findProviderConflict above only ever caught
// appointment-vs-appointment overlap — it never validated against
// ProviderSchedule working hours/breaks or ClinicHoliday, so a directly- or
// programmatically-created appointment could land on a provider's day off
// or during their lunch break with no server-side rejection at all (the
// UI's own slot-picker already disables booking in these cases, but nothing
// enforced it server-side for any other call path).
describe('appointment.service — provider schedule/holiday validation', () => {
  beforeEach(() => vi.clearAllMocks())

  const WORKING_SCHEDULE = { isWorking: true, startTime: '09:00', endTime: '17:00', breakStart: '13:00', breakEnd: '14:00' }

  it('rejects a booking on a global holiday', async () => {
    const db = makeMockDb([], { holiday: { name: 'Diwali' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createAppointment({
      providerId: 'prov-1', serviceTitle: 'Checkup', scheduledDate: '2026-07-10', scheduledTime: '10:00', durationMinutes: 30
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('APT-SCHEDULE')
    expect(db.appointment.create).not.toHaveBeenCalled()
  })

  it('rejects a booking on a provider\'s explicit day off (isWorking=false)', async () => {
    const db = makeMockDb([], { schedule: { isWorking: false, startTime: '09:00', endTime: '17:00' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createAppointment({
      providerId: 'prov-1', serviceTitle: 'Checkup', scheduledDate: '2026-07-10', scheduledTime: '10:00', durationMinutes: 30
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('APT-SCHEDULE')
  })

  it('rejects a booking outside working hours', async () => {
    const db = makeMockDb([], { schedule: WORKING_SCHEDULE })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createAppointment({
      providerId: 'prov-1', serviceTitle: 'Checkup', scheduledDate: '2026-07-10', scheduledTime: '18:00', durationMinutes: 30
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('APT-SCHEDULE')
  })

  it('rejects a booking overlapping the provider\'s break', async () => {
    const db = makeMockDb([], { schedule: WORKING_SCHEDULE })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createAppointment({
      providerId: 'prov-1', serviceTitle: 'Checkup', scheduledDate: '2026-07-10', scheduledTime: '13:30', durationMinutes: 30
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('APT-SCHEDULE')
  })

  it('allows a booking within working hours, outside the break', async () => {
    const db = makeMockDb([], { schedule: WORKING_SCHEDULE })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createAppointment({
      providerId: 'prov-1', serviceTitle: 'Checkup', scheduledDate: '2026-07-10', scheduledTime: '10:00', durationMinutes: 30
    })

    expect(res.success).toBe(true)
  })

  it('does NOT block when no schedule is configured at all — an unconfigured provider is a no-op, not a violation', async () => {
    const db = makeMockDb([], { schedule: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createAppointment({
      providerId: 'prov-1', serviceTitle: 'Checkup', scheduledDate: '2026-07-10', scheduledTime: '23:00', durationMinutes: 30
    })

    expect(res.success).toBe(true)
  })

  it('enforces the same schedule/holiday check on updateAppointment (reschedule), not just create', async () => {
    const db = makeMockDb(
      [makeExistingAppointment({ id: 'apt-a', appointmentNumber: 'APT-0001', scheduledTime: '10:00', durationMinutes: 30 })],
      { schedule: WORKING_SCHEDULE }
    )
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateAppointment({ id: 'apt-a', scheduledTime: '13:15' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('APT-SCHEDULE')
    expect(db.appointment.update).not.toHaveBeenCalled()
  })
})

// Phase 41 — generateAppointmentInvoice / generateAppointmentBatchInvoice

const GP_SERVICE = { id: 'svc-gp', serviceName: 'GP Consultation', sacCode: '999311', taxRate: 0 }
const HAIRCUT_SERVICE = { id: 'svc-hair', serviceName: 'Haircut', sacCode: '999723', taxRate: 18 }
const COLOR_SERVICE = { id: 'svc-color', serviceName: 'Hair Color', sacCode: '999723', taxRate: 18 }

function makeApptForInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'apt-1', appointmentNumber: 'APT-0001', serviceTitle: 'GP Consultation',
    customerId: 'cust-1', status: 'COMPLETED', totalAmount: 500,
    services: null, invoiceId: null,
    serviceCatalog: GP_SERVICE, sessionLog: null,
    ...overrides,
  }
}

function makeInvoiceMockDb(appts: Array<Record<string, unknown> | null>, serviceCatalogById: Record<string, unknown> = {}) {
  const byId = new Map(appts.filter((a): a is Record<string, unknown> => !!a).map((a) => [a.id as string, a]))
  return {
    appointment: {
      updateMany: vi.fn().mockImplementation(({ where, data }: { where: { id: unknown; invoiceId?: null }; data: Record<string, unknown> }) => {
        const ids: string[] = where.id && typeof where.id === 'object' && 'in' in (where.id as object)
          ? (where.id as { in: string[] }).in
          : [where.id as unknown as string]
        // Mirrors the real atomic claim: only matches rows satisfying the
        // full WHERE clause. The claim call adds `invoiceId: null`; the
        // finalize/release calls filter on id alone.
        const requireNullInvoice = 'invoiceId' in where && where.invoiceId === null
        const matched = ids.filter((id) => byId.has(id) && (!requireNullInvoice || !byId.get(id)!.invoiceId))
        for (const id of matched) Object.assign(byId.get(id)!, data)
        return Promise.resolve({ count: matched.length })
      }),
      findMany: vi.fn().mockImplementation(() => Promise.resolve([...byId.values()])),
      findUnique: vi.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) => Promise.resolve(byId.get(id) ?? null)),
      update: vi.fn().mockImplementation(({ where: { id }, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        if (byId.has(id)) Object.assign(byId.get(id)!, data)
        return Promise.resolve({})
      }),
    },
    serviceCatalog: {
      findUnique: vi.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) => Promise.resolve(serviceCatalogById[id] ?? null)),
    },
    product: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: `product-${data.productName}`, ...data })),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    __byId: byId,
  }
}

function byIdInvoiceId(db: { __byId: Map<string, Record<string, unknown>> }, id: string): unknown {
  return db.__byId.get(id)?.invoiceId ?? null
}

describe('appointment.service — generateAppointmentInvoice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing appointment', async () => {
    const db = makeInvoiceMockDb([])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateAppointmentInvoice('apt-missing')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('APT-009')
  })

  it('rejects an appointment that already has an invoice', async () => {
    const db = makeInvoiceMockDb([makeApptForInvoice({ invoiceId: 'invoice-existing' })])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateAppointmentInvoice('apt-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('APT-010')
  })

  it('rejects a non-completed appointment', async () => {
    const db = makeInvoiceMockDb([makeApptForInvoice({ status: 'SCHEDULED' })])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateAppointmentInvoice('apt-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('APT-011')
  })

  it('rejects a pack-redeemed appointment (has a sessionLog)', async () => {
    const db = makeInvoiceMockDb([makeApptForInvoice({ sessionLog: { id: 'log-1' } })])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateAppointmentInvoice('apt-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('APT-012')
  })

  it('rejects an appointment with no linked customer', async () => {
    const db = makeInvoiceMockDb([makeApptForInvoice({ customerId: null })])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateAppointmentInvoice('apt-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('APT-013')
  })

  it('rejects a single-service appointment with no linked service catalog entry', async () => {
    const db = makeInvoiceMockDb([makeApptForInvoice({ serviceCatalog: null })])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateAppointmentInvoice('apt-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('APT-018')
  })

  it('rejects a zero-amount appointment', async () => {
    const db = makeInvoiceMockDb([makeApptForInvoice({ totalAmount: 0 })])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateAppointmentInvoice('apt-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('APT-014')
  })

  it('generates an invoice using the linked ServiceCatalog tax rate (0% GST-exempt healthcare)', async () => {
    const db = makeInvoiceMockDb([makeApptForInvoice()])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)

    const res = await generateAppointmentInvoice('apt-1')

    expect(res.success).toBe(true)
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'cust-1',
      items: [expect.objectContaining({ unitPrice: 500, taxRate: 0 })],
    }))
    expect(db.appointment.update).toHaveBeenCalledWith({ where: { id: 'apt-1' }, data: { invoiceId: 'invoice-1' } })
  })

  it('builds one line item per service for a salon multi-service appointment, each with its own tax rate', async () => {
    const services = JSON.stringify([
      { id: 'svc-hair', name: 'Haircut', price: 300, duration: 30 },
      { id: 'svc-color', name: 'Hair Color', price: 1200, duration: 60 },
    ])
    const db = makeInvoiceMockDb(
      [makeApptForInvoice({ services, serviceCatalog: null, serviceCatalogId: null })],
      { 'svc-hair': HAIRCUT_SERVICE, 'svc-color': COLOR_SERVICE }
    )
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)

    const res = await generateAppointmentInvoice('apt-1')

    expect(res.success).toBe(true)
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      items: [
        expect.objectContaining({ unitPrice: 300, taxRate: 18 }),
        expect.objectContaining({ unitPrice: 1200, taxRate: 18 }),
      ],
    }))
  })

  it('rejects a salon appointment when a booked service no longer exists in the catalog', async () => {
    const services = JSON.stringify([{ id: 'svc-deleted', name: 'Deleted Service', price: 300, duration: 30 }])
    const db = makeInvoiceMockDb([makeApptForInvoice({ services, serviceCatalog: null })], {})
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateAppointmentInvoice('apt-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('APT-017')
  })

  it('propagates a billing failure without linking an invoice, and releases the claim', async () => {
    const db = makeInvoiceMockDb([makeApptForInvoice()])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'BILL-001', message: 'failed' } } as never)

    const res = await generateAppointmentInvoice('apt-1')

    expect(res.success).toBe(false)
    expect(db.appointment.update).toHaveBeenCalledWith({ where: { id: 'apt-1' }, data: { invoiceId: null } })
  })

  it('rejects and releases the claim when a concurrent call wins the race', async () => {
    const db = makeInvoiceMockDb([makeApptForInvoice()])
    db.appointment.updateMany = vi.fn().mockResolvedValueOnce({ count: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateAppointmentInvoice('apt-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('APT-010')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })
})

describe('appointment.service — generateAppointmentBatchInvoice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects an empty selection', async () => {
    const res = await generateAppointmentBatchInvoice([])
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('APT-019')
  })

  it('rejects when some appointments no longer exist', async () => {
    const db = makeInvoiceMockDb([makeApptForInvoice()])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateAppointmentBatchInvoice(['apt-1', 'apt-missing'])
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('APT-020')
  })

  it('rejects appointments belonging to different customers', async () => {
    const db = makeInvoiceMockDb([
      makeApptForInvoice({ id: 'apt-1', customerId: 'cust-1' }),
      makeApptForInvoice({ id: 'apt-2', customerId: 'cust-2' }),
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateAppointmentBatchInvoice(['apt-1', 'apt-2'])
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('APT-025')
  })

  it('combines multiple appointments into one invoice with one line item each', async () => {
    const db = makeInvoiceMockDb([
      makeApptForInvoice({ id: 'apt-1', totalAmount: 500 }),
      makeApptForInvoice({ id: 'apt-2', totalAmount: 700 }),
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)

    const res = await generateAppointmentBatchInvoice(['apt-1', 'apt-2'])

    expect(res.success).toBe(true)
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'cust-1',
      items: [expect.objectContaining({ unitPrice: 500 }), expect.objectContaining({ unitPrice: 700 })],
    }))
    expect(db.appointment.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['apt-1', 'apt-2'] } }, data: { invoiceId: 'invoice-1' } })
    expect(byIdInvoiceId(db, 'apt-1')).toBe('invoice-1')
    expect(byIdInvoiceId(db, 'apt-2')).toBe('invoice-1')
  })

  it('propagates a billing failure without linking any invoice', async () => {
    const db = makeInvoiceMockDb([makeApptForInvoice({ id: 'apt-1' }), makeApptForInvoice({ id: 'apt-2' })])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'BILL-001', message: 'failed' } } as never)

    const res = await generateAppointmentBatchInvoice(['apt-1', 'apt-2'])

    expect(res.success).toBe(false)
    expect(db.appointment.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ invoiceId: 'invoice-1' }) }))
    expect(byIdInvoiceId(db, 'apt-1')).toBeNull()
    expect(byIdInvoiceId(db, 'apt-2')).toBeNull()
  })
})
