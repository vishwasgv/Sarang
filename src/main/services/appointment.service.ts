import { getPrisma } from '../database/db'
import { billingService } from './billing.service'
import { generateSequenceNumber } from './sequence.service'
import { parseLocalDateStart, parseLocalDateEnd } from '../utils/date.util'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]
type Db = ReturnType<typeof getPrisma>

function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Was a plain findFirst(orderBy desc)+increment — races under concurrent
// bookings (a read doesn't take SQLite's write lock) and collides as soon
// as any Appointment is ever hard-deleted (the "last" row no longer
// reflects the highest number ever issued). generateSequenceNumber's
// atomic Setting-backed claim closes both.
async function nextAppointmentNumber(tx: TxClient): Promise<string> {
  return generateSequenceNumber(
    tx, 'appointment_number_sequence', 'APT', 4,
    async () => {
      const last = await tx.appointment.findFirst({ orderBy: { appointmentNumber: 'desc' }, select: { appointmentNumber: true } })
      return last ? parseInt(last.appointmentNumber.replace('APT-', ''), 10) : 0
    }
  )
}

// Shared by create and update — must run inside the same transaction as the
// write it's guarding, otherwise two near-simultaneous calls (a double-click,
// two windows) can both read a conflict-free snapshot before either commits,
// producing a genuine double-booking despite this check existing.
async function findProviderConflict(
  tx: TxClient,
  providerId: string,
  scheduledDate: Date,
  scheduledTime: string,
  durationMinutes: number,
  excludeAppointmentId?: string
): Promise<{ appointmentNumber: string; scheduledTime: string } | null> {
  const existing = await tx.appointment.findMany({
    where: {
      providerId,
      scheduledDate: { gte: scheduledDate, lt: new Date(scheduledDate.getTime() + 86400000) },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
    select: { scheduledTime: true, durationMinutes: true, appointmentNumber: true },
  })
  const newStart = toMins(scheduledTime)
  const newEnd = newStart + durationMinutes
  return existing.find((e) => {
    const eStart = toMins(e.scheduledTime)
    return newStart < eStart + e.durationMinutes && eStart < newEnd
  }) ?? null
}

// Fresh-audit fix (2026-07-12): findProviderConflict above only ever
// checked appointment-vs-appointment overlap — it never validated against
// ProviderSchedule working hours/breaks or ClinicHoliday, so a directly-
// created or programmatically-created appointment (any path other than the
// UI's own slot-picker) could land on a provider's day off, outside their
// working hours, or during their lunch break with no server-side rejection.
// provider-schedule.service.ts's getProviderAvailability already computes
// this exact same holiday/working-day/hours/break logic for the slot picker
// (and the picker-driven UI already disables its own submit button in every
// one of these cases — see AppointmentsScreen.tsx's `disabled=
// {availabilityMsg !== null || ...}` — so this closes a non-UI-path gap,
// it does not change any booking flow reachable through the normal UI
// today). Runs inside the SAME transaction as the write it guards, for the
// identical race-safety reason findProviderConflict already documents.
async function validateProviderScheduleWindow(
  tx: TxClient,
  providerId: string,
  scheduledDate: Date,
  scheduledTime: string,
  durationMinutes: number
): Promise<string | null> {
  const dayOfWeek = scheduledDate.getDay()
  const dayEnd = new Date(scheduledDate.getTime() + 86400000)

  const [schedule, holiday] = await Promise.all([
    tx.providerSchedule.findUnique({ where: { providerId_dayOfWeek: { providerId, dayOfWeek } } }),
    tx.clinicHoliday.findFirst({
      where: { date: { gte: scheduledDate, lt: dayEnd }, OR: [{ isGlobal: true }, { providerId }] },
    }),
  ])

  if (holiday) return `Provider is unavailable on this date (${holiday.name}).`
  // No schedule row at all for this provider/day — deliberately NOT a hard
  // block. Many businesses never configure ProviderSchedule at all (it's an
  // opt-in feature), and treating "unconfigured" the same as "explicitly
  // marked not working" would break every booking for those providers. An
  // EXPLICIT schedule row with isWorking=false (the actual "day off" case
  // the audit finding described) IS blocked below.
  if (!schedule) return null
  if (!schedule.isWorking) return `Provider is not scheduled to work on this day.`

  const newStart = toMins(scheduledTime)
  const newEnd = newStart + durationMinutes
  const workStart = toMins(schedule.startTime)
  const workEnd = toMins(schedule.endTime)
  if (newStart < workStart || newEnd > workEnd) {
    return `Outside provider's working hours (${schedule.startTime}–${schedule.endTime}).`
  }
  if (schedule.breakStart && schedule.breakEnd) {
    const breakStart = toMins(schedule.breakStart)
    const breakEnd = toMins(schedule.breakEnd)
    if (newStart < breakEnd && breakStart < newEnd) {
      return `Overlaps provider's break (${schedule.breakStart}–${schedule.breakEnd}).`
    }
  }
  return null
}

export async function listAppointments(filters?: {
  providerId?: string
  customerId?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}) {
  try {
    const db = getPrisma()
    const page = filters?.page ?? 1
    const limit = filters?.limit ?? 50
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (filters?.providerId) where.providerId = filters.providerId
    if (filters?.customerId) where.customerId = filters.customerId
    if (filters?.status) where.status = filters.status
    if (filters?.dateFrom || filters?.dateTo) {
      // BUG FOUND 2026-07-22: both bounds used to be new Date(dateString),
      // parsed as UTC midnight instead of local midnight — same bug class
      // fixed across many other files this session. dateTo also lacked the
      // end-of-day adjustment every correctly-fixed "to" bound elsewhere
      // uses, so it excluded same-day appointments with a real time-of-day.
      // Real bug found 2026-07-23: the dateTo fix above still parsed the
      // string as UTC midnight FIRST before setHours() locked in
      // end-of-day — setHours() only rewrites H/M/S/ms, never the
      // Year/Month/Date a UTC parse already got wrong in any negative-UTC-
      // offset timezone. parseLocalDateEnd constructs local end-of-day
      // directly from the string's Y/M/D instead.
      where.scheduledDate = {
        ...(filters.dateFrom ? { gte: parseLocalDateStart(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: parseLocalDateEnd(filters.dateTo) } : {}),
      }
    }

    const [total, items] = await Promise.all([
      db.appointment.count({ where }),
      db.appointment.findMany({
        where,
        include: {
          customer: { select: { id: true, customerName: true, phone: true } },
          provider: { select: { id: true, fullName: true, specialization: true, providerColor: true } },
          serviceCatalog: { select: { id: true, serviceName: true, durationMinutes: true, basePrice: true } },
        },
        orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
        skip,
        take: limit,
      }),
    ])

    return { success: true, data: { items, total, page, limit } }
  } catch (err) {
    return { success: false, error: { code: 'APT-001', message: err instanceof Error ? err.message : 'Could not list appointments.' } }
  }
}

export async function getAppointmentsByDate(date: string) {
  try {
    const db = getPrisma()
    const day = new Date(date)
    const nextDay = new Date(day)
    nextDay.setDate(nextDay.getDate() + 1)

    const items = await db.appointment.findMany({
      where: {
        scheduledDate: { gte: day, lt: nextDay },
        status: { not: 'CANCELLED' },
      },
      include: {
        customer: { select: { id: true, customerName: true, phone: true } },
        provider: { select: { id: true, fullName: true, providerColor: true, specialization: true } },
        serviceCatalog: { select: { id: true, serviceName: true, durationMinutes: true } },
        visitNote: { select: { id: true, isFinalized: true } },              // Phase 24 — show note badge
        sessionLog: { select: { id: true } },                                  // Phase 26 — session pack deduction indicator
      },
      orderBy: [{ scheduledTime: 'asc' }],
    })

    return { success: true, data: items }
  } catch (err) {
    return { success: false, error: { code: 'APT-002', message: err instanceof Error ? err.message : 'Could not fetch appointments for date.' } }
  }
}

export async function getAppointment(id: string) {
  try {
    const db = getPrisma()
    const item = await db.appointment.findUnique({
      where: { id },
      include: {
        customer: true,
        provider: { select: { id: true, fullName: true, specialization: true, providerColor: true, phone: true } },
        serviceCatalog: true,
        // Phase 58 §2 — Vet Clinic: lets VisitNoteScreen.tsx prefill from the
        // PATIENT (the pet), not the owner, when this appointment is a vet visit.
        pet: { select: { id: true, petName: true, species: true, breed: true, dateOfBirth: true, gender: true } },
      },
    })
    if (!item) return { success: false, error: { code: 'APT-003', message: 'Appointment not found.' } }
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'APT-003', message: err instanceof Error ? err.message : 'Could not fetch appointment.' } }
  }
}

export async function createAppointment(payload: {
  customerId?: string
  customerName?: string
  providerId?: string
  serviceCatalogId?: string
  serviceTitle: string
  scheduledDate: string
  scheduledTime: string
  durationMinutes?: number
  notes?: string
  totalAmount?: number
  depositPaid?: number
  chairAssignment?: string
  createdBy?: string
  services?: string
  referredFromVisitNoteId?: string
  // Phase 58 §2 — Vet Clinic: which pet this visit is for. Appointment.petId
  // has existed in the schema since Phase 23 but this create payload never
  // accepted it — a vet appointment could be booked but never actually
  // linked to a patient.
  petId?: string
}) {
  try {
    const db = getPrisma()

    const result = await db.$transaction(async (tx): Promise<
      | { ok: true; item: Awaited<ReturnType<typeof tx.appointment.create>> }
      | { ok: false; conflict: { appointmentNumber: string; scheduledTime: string } }
      | { ok: false; scheduleViolation: string }
    > => {
      if (payload.providerId) {
        const aptDate = new Date(payload.scheduledDate)
        const conflict = await findProviderConflict(
          tx, payload.providerId, aptDate, payload.scheduledTime, payload.durationMinutes ?? 30
        )
        if (conflict) {
          return { ok: false, conflict }
        }
        const scheduleViolation = await validateProviderScheduleWindow(
          tx, payload.providerId, aptDate, payload.scheduledTime, payload.durationMinutes ?? 30
        )
        if (scheduleViolation) {
          return { ok: false, scheduleViolation }
        }
      }

      const appointmentNumber = await nextAppointmentNumber(tx)

      const item = await tx.appointment.create({
        data: {
          appointmentNumber,
          customerId: payload.customerId ?? null,
          customerName: payload.customerName ?? null,
          providerId: payload.providerId ?? null,
          serviceCatalogId: payload.serviceCatalogId ?? null,
          serviceTitle: payload.serviceTitle,
          scheduledDate: new Date(payload.scheduledDate),
          scheduledTime: payload.scheduledTime,
          durationMinutes: payload.durationMinutes ?? 30,
          notes: payload.notes ?? null,
          totalAmount: payload.totalAmount ?? 0,
          depositPaid: payload.depositPaid ?? 0,
          chairAssignment: payload.chairAssignment ?? null,
          createdBy: payload.createdBy ?? 'system',
          services: payload.services ?? null,
          referredFromVisitNoteId: payload.referredFromVisitNoteId ?? null,
          petId: payload.petId ?? null,
        },
      })

      await tx.auditLog.create({
        data: { action: 'CREATE', entityType: 'Appointment', entityId: item.id, newValue: JSON.stringify({ appointmentNumber, serviceTitle: payload.serviceTitle }) },
      }).catch(() => {})

      return { ok: true, item }
    })

    if (!result.ok) {
      if ('scheduleViolation' in result) {
        return { success: false, error: { code: 'APT-SCHEDULE', message: result.scheduleViolation } }
      }
      return {
        success: false,
        error: { code: 'APT-CONFLICT', message: `Time conflict: ${result.conflict.appointmentNumber} already occupies ${result.conflict.scheduledTime} for this provider.` },
      }
    }

    return { success: true, data: result.item }
  } catch (err) {
    return { success: false, error: { code: 'APT-004', message: err instanceof Error ? err.message : 'Could not create appointment.' } }
  }
}

export async function updateAppointment(payload: {
  id: string
  customerId?: string | null
  customerName?: string | null
  providerId?: string | null
  serviceCatalogId?: string | null
  serviceTitle?: string
  scheduledDate?: string
  scheduledTime?: string
  durationMinutes?: number
  notes?: string | null
  privateNotes?: string | null
  totalAmount?: number
  depositPaid?: number
  chairAssignment?: string | null
  petId?: string | null
}) {
  try {
    const db = getPrisma()
    const { id, scheduledDate, ...rest } = payload

    const result = await db.$transaction(async (tx): Promise<
      | { status: 'ok'; item: Awaited<ReturnType<typeof tx.appointment.update>> }
      | { status: 'notFound' }
      | { status: 'conflict'; conflict: { appointmentNumber: string; scheduledTime: string } }
      | { status: 'scheduleViolation'; reason: string }
    > => {
      const existing = await tx.appointment.findUnique({ where: { id } })
      if (!existing) return { status: 'notFound' }

      // Re-check the same duration-aware overlap createAppointment enforces —
      // rescheduling to a conflicting slot must be rejected exactly like
      // creating one would be. Uses the *effective* provider/date/time/duration
      // (existing value unless this update changes it), and excludes this
      // appointment's own row from the conflict scan.
      const effectiveProviderId = payload.providerId !== undefined ? payload.providerId : existing.providerId
      const effectiveDate = scheduledDate ? new Date(scheduledDate) : existing.scheduledDate
      const effectiveTime = payload.scheduledTime ?? existing.scheduledTime
      const effectiveDuration = payload.durationMinutes ?? existing.durationMinutes

      if (effectiveProviderId) {
        const conflict = await findProviderConflict(tx, effectiveProviderId, effectiveDate, effectiveTime, effectiveDuration, id)
        if (conflict) return { status: 'conflict', conflict }
        const scheduleViolation = await validateProviderScheduleWindow(tx, effectiveProviderId, effectiveDate, effectiveTime, effectiveDuration)
        if (scheduleViolation) return { status: 'scheduleViolation', reason: scheduleViolation }
      }

      const item = await tx.appointment.update({
        where: { id },
        data: {
          ...rest,
          ...(scheduledDate ? { scheduledDate: new Date(scheduledDate) } : {}),
        },
      })
      await tx.auditLog.create({
        data: { action: 'UPDATE', entityType: 'Appointment', entityId: id },
      }).catch(() => {})
      return { status: 'ok', item }
    })

    if (result.status === 'notFound') {
      return { success: false, error: { code: 'APT-005', message: 'Appointment not found.' } }
    }
    if (result.status === 'conflict') {
      return {
        success: false,
        error: { code: 'APT-CONFLICT', message: `Time conflict: ${result.conflict.appointmentNumber} already occupies ${result.conflict.scheduledTime} for this provider.` },
      }
    }
    if (result.status === 'scheduleViolation') {
      return { success: false, error: { code: 'APT-SCHEDULE', message: result.reason } }
    }
    return { success: true, data: result.item }
  } catch (err) {
    return { success: false, error: { code: 'APT-005', message: err instanceof Error ? err.message : 'Could not update appointment.' } }
  }
}

export async function updateAppointmentStatus(payload: {
  id: string
  status: 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
  cancellationReason?: string
}) {
  try {
    const db = getPrisma()
    const item = await db.appointment.update({
      where: { id: payload.id },
      data: {
        status: payload.status,
        ...(payload.cancellationReason ? { cancellationReason: payload.cancellationReason } : {}),
      },
    })
    await db.auditLog.create({
      data: { action: `STATUS_${payload.status}`, entityType: 'Appointment', entityId: payload.id },
    }).catch(() => {})
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'APT-006', message: err instanceof Error ? err.message : 'Could not update appointment status.' } }
  }
}

export async function deleteAppointment(id: string) {
  try {
    const db = getPrisma()
    const existing = await db.appointment.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'APT-007', message: 'Appointment not found.' } }
    if (['COMPLETED', 'IN_PROGRESS'].includes(existing.status)) {
      return { success: false, error: { code: 'APT-007', message: 'Cannot delete a completed or in-progress appointment.' } }
    }
    await db.appointment.delete({ where: { id } })
    await db.auditLog.create({
      data: { action: 'DELETE', entityType: 'Appointment', entityId: id },
    }).catch(() => {})
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'APT-007', message: err instanceof Error ? err.message : 'Could not delete appointment.' } }
  }
}

// Phase 41 — appointment invoicing. Sentinel written to Appointment.invoiceId
// while a generation is in flight — see time-entry.service.ts's
// INVOICE_CLAIM_SENTINEL for the full atomic-claim rationale.
const APPT_CLAIM_SENTINEL = 'PENDING_INVOICE_GENERATION'

type InvoiceLineItem = { productId: string; quantity: number; unitPrice: number; taxRate: number }

// Tax treatment is read from ServiceCatalog.taxRate/sacCode — set by the
// business owner per-service (a GP clinic sets 0% for a GST-exempt
// consultation, a salon sets 18% for a haircut) — never hardcoded per
// vertical, since this one Appointment entity spans all 24 service
// templates with very different real tax treatment.
async function findOrCreateServiceCatalogProduct(
  db: Db,
  sc: { serviceName: string; sacCode: string | null; taxRate: number }
) {
  let product = await db.product.findFirst({ where: { hsnCode: sc.sacCode, productName: sc.serviceName, isActive: true } })
  if (!product) {
    product = await db.product.create({
      data: { productName: sc.serviceName, productType: 'SERVICE', hsnCode: sc.sacCode, sellingPrice: 0, taxRate: sc.taxRate, unit: 'NOS', isActive: true },
    })
  }
  return product
}

type AppointmentForInvoice = {
  id: string
  appointmentNumber: string
  serviceTitle: string
  services: string | null
  totalAmount: number
  serviceCatalog: { id: string; serviceName: string; sacCode: string | null; taxRate: number } | null
}

// Builds one line item per booked service. Salon multi-service appointments
// (services JSON: [{id,name,price,duration}], id = ServiceCatalog.id) get
// one line per selected service, each using THAT service's own tax
// treatment — not a single lumped line. Single-service appointments require
// a linked serviceCatalogId so a real tax rate is always available; a
// free-text appointment with no catalog link is rejected here (manual
// invoicing via the generic Billing screen still works, unchanged).
async function buildAppointmentInvoiceItems(
  db: Db,
  appt: AppointmentForInvoice
): Promise<{ success: true; items: InvoiceLineItem[] } | { success: false; error: { code: string; message: string } }> {
  if (appt.services) {
    let parsed: Array<{ id: string; name: string; price: number }> = []
    try { parsed = JSON.parse(appt.services) } catch { parsed = [] }
    if (parsed.length === 0) {
      return { success: false, error: { code: 'APT-016', message: 'This appointment has no billable services recorded.' } }
    }
    const items: InvoiceLineItem[] = []
    for (const svc of parsed) {
      const sc = await db.serviceCatalog.findUnique({ where: { id: svc.id } })
      if (!sc) {
        return { success: false, error: { code: 'APT-017', message: `One of the booked services ("${svc.name}") no longer exists in the service catalog — edit the appointment before invoicing.` } }
      }
      const product = await findOrCreateServiceCatalogProduct(db, sc)
      items.push({ productId: product.id, quantity: 1, unitPrice: svc.price, taxRate: sc.taxRate })
    }
    return { success: true, items }
  }

  if (!appt.serviceCatalog) {
    return { success: false, error: { code: 'APT-018', message: 'Link this appointment to a service catalog entry before generating an invoice.' } }
  }
  const product = await findOrCreateServiceCatalogProduct(db, appt.serviceCatalog)
  return { success: true, items: [{ productId: product.id, quantity: 1, unitPrice: appt.totalAmount, taxRate: appt.serviceCatalog.taxRate }] }
}

// Phase 58 §2 — Beauty Salon: unify a retail product upsell (e.g. the
// shampoo the stylist recommended) into the SAME invoice as the appointment
// service, instead of a disconnected second Billing-screen transaction.
// Price/tax are resolved fresh from the real Product record here — never
// trusted from the client — same "never trust the client for a derived
// fact" discipline this codebase applies everywhere else pricing is involved.
async function resolveRetailInvoiceItems(
  db: Db,
  retailItems: Array<{ productId: string; quantity: number }>
): Promise<{ success: true; items: InvoiceLineItem[] } | { success: false; error: { code: string; message: string } }> {
  const items: InvoiceLineItem[] = []
  for (const ri of retailItems) {
    if (!Number.isFinite(ri.quantity) || ri.quantity <= 0) {
      return { success: false, error: { code: 'APT-020', message: 'Retail item quantity must be greater than zero.' } }
    }
    const product = await db.product.findUnique({ where: { id: ri.productId } })
    if (!product || !product.isActive) {
      return { success: false, error: { code: 'APT-021', message: 'One of the added retail products is no longer available.' } }
    }
    items.push({ productId: product.id, quantity: ri.quantity, unitPrice: product.sellingPrice, taxRate: product.taxRate })
  }
  return { success: true, items }
}

export async function generateAppointmentInvoice(
  id: string,
  options?: {
    retailItems?: Array<{ productId: string; quantity: number }>
    paymentMethod?: 'CASH' | 'UPI' | 'CARD' | 'WALLET' | 'CREDIT' | 'SPLIT'
  }
) {
  const db = getPrisma()
  try {
    const claim = await db.appointment.updateMany({ where: { id, invoiceId: null }, data: { invoiceId: APPT_CLAIM_SENTINEL } })
    if (claim.count === 0) {
      const existing = await db.appointment.findUnique({ where: { id }, select: { id: true } })
      if (!existing) return { success: false, error: { code: 'APT-009', message: 'Appointment not found.' } }
      return { success: false, error: { code: 'APT-010', message: 'Invoice already generated for this appointment.' } }
    }

    try {
      const appt = await db.appointment.findUnique({
        where: { id },
        include: { serviceCatalog: true, sessionLog: true },
      })
      if (!appt) {
        await db.appointment.update({ where: { id }, data: { invoiceId: null } })
        return { success: false, error: { code: 'APT-009', message: 'Appointment not found.' } }
      }
      if (appt.status !== 'COMPLETED') {
        await db.appointment.update({ where: { id }, data: { invoiceId: null } })
        return { success: false, error: { code: 'APT-011', message: 'Only completed appointments can be invoiced.' } }
      }
      if (appt.sessionLog) {
        await db.appointment.update({ where: { id }, data: { invoiceId: null } })
        return { success: false, error: { code: 'APT-012', message: 'This visit was paid for via a session pack — invoice the pack purchase instead, not this appointment.' } }
      }
      if (!appt.customerId) {
        await db.appointment.update({ where: { id }, data: { invoiceId: null } })
        return { success: false, error: { code: 'APT-013', message: 'Link this appointment to a customer record before generating an invoice.' } }
      }

      const itemsResult = await buildAppointmentInvoiceItems(db, appt)
      if (!itemsResult.success) {
        await db.appointment.update({ where: { id }, data: { invoiceId: null } })
        return itemsResult
      }
      if (itemsResult.items.some((i) => i.unitPrice <= 0)) {
        await db.appointment.update({ where: { id }, data: { invoiceId: null } })
        return { success: false, error: { code: 'APT-014', message: 'Set an amount greater than zero before generating an invoice.' } }
      }

      let allItems = itemsResult.items
      if (options?.retailItems && options.retailItems.length > 0) {
        const retailResult = await resolveRetailInvoiceItems(db, options.retailItems)
        if (!retailResult.success) {
          await db.appointment.update({ where: { id }, data: { invoiceId: null } })
          return retailResult
        }
        allItems = [...allItems, ...retailResult.items]
      }

      const result = await billingService.createInvoice({
        customerId: appt.customerId,
        paymentMethod: options?.paymentMethod ?? 'CREDIT',
        gstType: 'CGST_SGST',
        items: allItems,
        notes: `Appointment ${appt.appointmentNumber} — ${appt.serviceTitle}`,
        referenceNumber: id.slice(0, 12),
      })
      if (!result.success) {
        await db.appointment.update({ where: { id }, data: { invoiceId: null } })
        return result
      }

      const invoice = result.data as { id: string }
      await db.appointment.update({ where: { id }, data: { invoiceId: invoice.id } })
      await db.auditLog.create({ data: { action: 'INVOICED', entityType: 'Appointment', entityId: id, newValue: JSON.stringify({ invoiceId: invoice.id }) } }).catch(() => {})

      return { success: true, data: { invoiceId: invoice.id } }
    } catch (err) {
      await db.appointment.update({ where: { id }, data: { invoiceId: null } }).catch(() => {})
      throw err
    }
  } catch (err) {
    return { success: false, error: { code: 'APT-015', message: err instanceof Error ? err.message : 'Could not generate appointment invoice.' } }
  }
}

// Batches several completed, unbilled appointments for the SAME customer
// into a single invoice — one line (or line-set, for salon multi-service)
// per appointment. Mirrors time-entry.service.ts's generateTimeEntryInvoice
// batch pattern, including the atomic claim across the whole batch.
export async function generateAppointmentBatchInvoice(appointmentIds: string[]) {
  const db = getPrisma()
  try {
    if (!appointmentIds.length) return { success: false, error: { code: 'APT-019', message: 'Select at least one appointment to invoice.' } }
    const uniqueIds = [...new Set(appointmentIds)]

    const appts = await db.appointment.findMany({
      where: { id: { in: uniqueIds } },
      include: { serviceCatalog: true, sessionLog: true },
    })
    if (appts.length !== uniqueIds.length) return { success: false, error: { code: 'APT-020', message: 'One or more appointments were not found.' } }
    if (appts.some((a) => a.invoiceId)) return { success: false, error: { code: 'APT-021', message: 'One or more selected appointments are already invoiced.' } }
    if (appts.some((a) => a.status !== 'COMPLETED')) return { success: false, error: { code: 'APT-022', message: 'Only completed appointments can be invoiced.' } }
    if (appts.some((a) => a.sessionLog)) return { success: false, error: { code: 'APT-023', message: 'One or more selected appointments were paid for via a session pack — invoice those pack purchases instead.' } }
    if (appts.some((a) => !a.customerId)) return { success: false, error: { code: 'APT-024', message: 'Every selected appointment must be linked to a customer record.' } }

    const customerIds = new Set(appts.map((a) => a.customerId))
    if (customerIds.size > 1) return { success: false, error: { code: 'APT-025', message: 'Selected appointments belong to different customers — invoice each customer separately.' } }
    const customerId = [...customerIds][0] as string

    const claim = await db.appointment.updateMany({
      where: { id: { in: uniqueIds }, invoiceId: null },
      data: { invoiceId: APPT_CLAIM_SENTINEL },
    })
    if (claim.count !== uniqueIds.length) {
      await db.appointment.updateMany({ where: { id: { in: uniqueIds }, invoiceId: APPT_CLAIM_SENTINEL }, data: { invoiceId: null } })
      return { success: false, error: { code: 'APT-021', message: 'One or more selected appointments are already invoiced.' } }
    }

    try {
      const allItems: InvoiceLineItem[] = []
      for (const appt of appts) {
        const itemsResult = await buildAppointmentInvoiceItems(db, appt)
        if (!itemsResult.success) {
          await db.appointment.updateMany({ where: { id: { in: uniqueIds } }, data: { invoiceId: null } })
          return itemsResult
        }
        allItems.push(...itemsResult.items)
      }
      if (allItems.some((i) => i.unitPrice <= 0)) {
        await db.appointment.updateMany({ where: { id: { in: uniqueIds } }, data: { invoiceId: null } })
        return { success: false, error: { code: 'APT-014', message: 'Set an amount greater than zero on every selected appointment before generating an invoice.' } }
      }

      const result = await billingService.createInvoice({
        customerId,
        paymentMethod: 'CREDIT',
        gstType: 'CGST_SGST',
        items: allItems,
        notes: `${appts.length} appointments`,
        referenceNumber: uniqueIds[0].slice(0, 12),
      })
      if (!result.success) {
        await db.appointment.updateMany({ where: { id: { in: uniqueIds } }, data: { invoiceId: null } })
        return result
      }

      const invoice = result.data as { id: string }
      await db.appointment.updateMany({ where: { id: { in: uniqueIds } }, data: { invoiceId: invoice.id } })
      await db.auditLog.create({ data: { action: 'INVOICED', entityType: 'Appointment', entityId: uniqueIds[0], newValue: JSON.stringify({ invoiceId: invoice.id, appointmentIds: uniqueIds }) } }).catch(() => {})

      return { success: true, data: { invoiceId: invoice.id } }
    } catch (err) {
      await db.appointment.updateMany({ where: { id: { in: uniqueIds } }, data: { invoiceId: null } }).catch(() => {})
      throw err
    }
  } catch (err) {
    return { success: false, error: { code: 'APT-026', message: err instanceof Error ? err.message : 'Could not generate batch appointment invoice.' } }
  }
}

export async function getAppointmentStats() {
  try {
    const db = getPrisma()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [todayTotal, todayCompleted, pending, revenue] = await Promise.all([
      db.appointment.count({ where: { scheduledDate: { gte: today, lt: tomorrow } } }),
      db.appointment.count({ where: { scheduledDate: { gte: today, lt: tomorrow }, status: 'COMPLETED' } }),
      db.appointment.count({ where: { status: { in: ['SCHEDULED', 'CONFIRMED'] } } }),
      db.appointment.aggregate({ where: { status: 'COMPLETED' }, _sum: { totalAmount: true } }),
    ])

    return {
      success: true,
      data: {
        todayTotal,
        todayCompleted,
        pending,
        totalRevenue: revenue._sum.totalAmount ?? 0,
      },
    }
  } catch (err) {
    return { success: false, error: { code: 'APT-008', message: err instanceof Error ? err.message : 'Could not fetch appointment stats.' } }
  }
}
