import { getPrisma } from '../database/db'

export async function listServices(filters?: { isActive?: boolean; category?: string }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.isActive !== undefined) where.isActive = filters.isActive
    if (filters?.category) where.category = filters.category

    const items = await db.serviceCatalog.findMany({
      where,
      orderBy: [{ category: 'asc' }, { serviceName: 'asc' }],
    })
    return { success: true, data: items }
  } catch (err) {
    return { success: false, error: { code: 'SVC-001', message: err instanceof Error ? err.message : 'Could not list services.' } }
  }
}

export async function getService(id: string) {
  try {
    const db = getPrisma()
    const item = await db.serviceCatalog.findUnique({ where: { id } })
    if (!item) return { success: false, error: { code: 'SVC-002', message: 'Service not found.' } }
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'SVC-002', message: err instanceof Error ? err.message : 'Could not fetch service.' } }
  }
}

export async function createService(payload: {
  serviceName: string
  serviceCode?: string
  category?: string
  description?: string
  durationMinutes?: number
  basePrice?: number
  taxRate?: number
  sacCode?: string
  notes?: string
}) {
  try {
    const db = getPrisma()

    if (payload.serviceCode) {
      const existing = await db.serviceCatalog.findUnique({ where: { serviceCode: payload.serviceCode } })
      if (existing) return { success: false, error: { code: 'SVC-003', message: 'Service code already in use.' } }
    }

    const item = await db.serviceCatalog.create({
      data: {
        serviceName: payload.serviceName,
        serviceCode: payload.serviceCode ?? null,
        category: payload.category ?? null,
        description: payload.description ?? null,
        durationMinutes: payload.durationMinutes ?? 30,
        basePrice: payload.basePrice ?? 0,
        taxRate: payload.taxRate ?? 0,
        sacCode: payload.sacCode ?? null,
        notes: payload.notes ?? null,
      },
    })
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'ServiceCatalog', entityId: item.id, newValue: JSON.stringify({ serviceName: item.serviceName }) } }).catch(() => {})
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'SVC-003', message: err instanceof Error ? err.message : 'Could not create service.' } }
  }
}

export async function updateService(payload: {
  id: string
  serviceName?: string
  serviceCode?: string | null
  category?: string | null
  description?: string | null
  durationMinutes?: number
  basePrice?: number
  taxRate?: number
  sacCode?: string | null
  isActive?: boolean
  notes?: string | null
}) {
  try {
    const db = getPrisma()
    const { id, ...data } = payload
    const item = await db.serviceCatalog.update({ where: { id }, data })
    await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'ServiceCatalog', entityId: item.id } }).catch(() => {})
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'SVC-004', message: err instanceof Error ? err.message : 'Could not update service.' } }
  }
}

export async function deleteService(id: string) {
  try {
    const db = getPrisma()
    const usedCount = await db.appointment.count({ where: { serviceCatalogId: id } })
    if (usedCount > 0) {
      return { success: false, error: { code: 'SVC-005', message: `Cannot delete — this service is used in ${usedCount} appointment(s). Archive it instead.` } }
    }
    await db.serviceCatalog.delete({ where: { id } })
    await db.auditLog.create({ data: { action: 'DELETE', entityType: 'ServiceCatalog', entityId: id } }).catch(() => {})
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'SVC-005', message: err instanceof Error ? err.message : 'Could not delete service.' } }
  }
}

export async function listCategories(): Promise<{ success: boolean; data?: string[]; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const rows = await db.serviceCatalog.findMany({
      where: { category: { not: null }, isActive: true },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    })
    return { success: true, data: rows.map((r) => r.category as string) }
  } catch (err) {
    return { success: false, error: { code: 'SVC-006', message: err instanceof Error ? err.message : 'Could not list categories.' } }
  }
}

// BUG FOUND 2026-07-22: setup.service.ts used to call this AFTER its own
// setup transaction had already committed, deliberately excluded with a
// "not critical" comment. But if this call failed (or the app crashed)
// between that commit and this line, isSetupComplete() already returns
// true (profile + admin user exist), so the Setup Wizard could never be
// re-entered — the business would be left with NO default service catalog
// permanently, with no in-app recovery path short of adding every service
// by hand. Fixed by accepting an optional transaction client so
// setup.service.ts can run this INSIDE its own transaction — a failure
// here now correctly rolls back the whole setup, and the wizard can simply
// be re-run from scratch.
export async function seedDefaultServicesForTemplate(templateType: string, tx?: Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]): Promise<void> {
  const db = tx ?? getPrisma()
  const existing = await db.serviceCatalog.count()
  if (existing > 0) return // only seed on fresh setup

  const seedMap: Record<string, Array<{ serviceName: string; category: string; durationMinutes: number; basePrice: number; sacCode?: string }>> = {
    VET_CLINIC: [
      { serviceName: 'General Consultation', category: 'Consultation', durationMinutes: 30, basePrice: 500, sacCode: '999312' },
      { serviceName: 'Vaccination', category: 'Preventive Care', durationMinutes: 15, basePrice: 300, sacCode: '999312' },
      { serviceName: 'Deworming', category: 'Preventive Care', durationMinutes: 15, basePrice: 200, sacCode: '999312' },
      { serviceName: 'Grooming - Basic', category: 'Grooming', durationMinutes: 60, basePrice: 800, sacCode: '999312' },
      { serviceName: 'Grooming - Full', category: 'Grooming', durationMinutes: 90, basePrice: 1400, sacCode: '999312' },
      { serviceName: 'X-Ray', category: 'Diagnostics', durationMinutes: 20, basePrice: 700, sacCode: '999312' },
    ],
    GP_CLINIC: [
      { serviceName: 'General Consultation', category: 'Consultation', durationMinutes: 15, basePrice: 300, sacCode: '999311' },
      { serviceName: 'Follow-up Consultation', category: 'Consultation', durationMinutes: 10, basePrice: 150, sacCode: '999311' },
      { serviceName: 'Dressing / Wound Care', category: 'Procedure', durationMinutes: 20, basePrice: 200, sacCode: '999311' },
      { serviceName: 'Injection', category: 'Procedure', durationMinutes: 10, basePrice: 100, sacCode: '999311' },
    ],
    DENTAL_CLINIC: [
      { serviceName: 'Dental Consultation', category: 'Consultation', durationMinutes: 20, basePrice: 300, sacCode: '999311' },
      { serviceName: 'Scaling & Polishing', category: 'Preventive', durationMinutes: 45, basePrice: 800, sacCode: '999311' },
      { serviceName: 'Tooth Extraction (Simple)', category: 'Oral Surgery', durationMinutes: 30, basePrice: 500, sacCode: '999311' },
      { serviceName: 'Root Canal Treatment', category: 'Endodontics', durationMinutes: 60, basePrice: 3500, sacCode: '999311' },
      { serviceName: 'Composite Filling', category: 'Restorative', durationMinutes: 45, basePrice: 1200, sacCode: '999311' },
    ],
    PHYSIO_CLINIC: [
      { serviceName: 'Physiotherapy Assessment', category: 'Assessment', durationMinutes: 45, basePrice: 600, sacCode: '999311' },
      { serviceName: 'Manual Therapy (30 min)', category: 'Treatment', durationMinutes: 30, basePrice: 500, sacCode: '999311' },
      { serviceName: 'Electrotherapy Session', category: 'Treatment', durationMinutes: 30, basePrice: 400, sacCode: '999311' },
      { serviceName: 'Exercise Therapy', category: 'Rehabilitation', durationMinutes: 45, basePrice: 450, sacCode: '999311' },
    ],
    BEAUTY_SALON: [
      { serviceName: 'Haircut - Ladies', category: 'Hair', durationMinutes: 45, basePrice: 400, sacCode: '999721' },
      { serviceName: 'Haircut - Gents', category: 'Hair', durationMinutes: 30, basePrice: 200, sacCode: '999721' },
      { serviceName: 'Hair Colour', category: 'Hair', durationMinutes: 90, basePrice: 1200, sacCode: '999721' },
      { serviceName: 'Facial - Basic', category: 'Skin', durationMinutes: 60, basePrice: 700, sacCode: '999721' },
      { serviceName: 'Waxing - Full Arms', category: 'Hair Removal', durationMinutes: 30, basePrice: 300, sacCode: '999721' },
      { serviceName: 'Manicure', category: 'Nails', durationMinutes: 45, basePrice: 350, sacCode: '999721' },
      { serviceName: 'Pedicure', category: 'Nails', durationMinutes: 45, basePrice: 400, sacCode: '999721' },
    ],
    GYM_STUDIO: [
      { serviceName: 'Personal Training Session', category: 'Training', durationMinutes: 60, basePrice: 800, sacCode: '999721' },
      { serviceName: 'Group Fitness Class', category: 'Classes', durationMinutes: 60, basePrice: 300, sacCode: '999721' },
      { serviceName: 'Yoga Session', category: 'Classes', durationMinutes: 60, basePrice: 350, sacCode: '999721' },
      { serviceName: 'Nutrition Consultation', category: 'Wellness', durationMinutes: 45, basePrice: 500, sacCode: '999721' },
    ],
    CAR_SERVICE_CENTER: [
      { serviceName: 'Oil Change', category: 'Maintenance', durationMinutes: 45, basePrice: 600, sacCode: '998714' },
      { serviceName: 'Tyre Rotation', category: 'Maintenance', durationMinutes: 30, basePrice: 300, sacCode: '998714' },
      { serviceName: 'Full Service', category: 'Maintenance', durationMinutes: 180, basePrice: 2500, sacCode: '998714' },
      { serviceName: 'AC Service', category: 'Repair', durationMinutes: 120, basePrice: 1500, sacCode: '998714' },
      { serviceName: 'Brake Inspection', category: 'Safety', durationMinutes: 60, basePrice: 500, sacCode: '998714' },
    ],
    // Phase 54B — every major test a real diagnostic lab runs day to day;
    // previously DIAGNOSTIC_LAB had no seed entry at all, meaning a lab had
    // to type out even the most standard tests from scratch on first setup.
    DIAGNOSTIC_LAB: [
      { serviceName: 'Fasting Blood Sugar (FBS)', category: 'Biochemistry', durationMinutes: 10, basePrice: 100, sacCode: '999312' },
      { serviceName: 'Post Prandial Blood Sugar (PPBS)', category: 'Biochemistry', durationMinutes: 10, basePrice: 100, sacCode: '999312' },
      { serviceName: 'HbA1c', category: 'Biochemistry', durationMinutes: 10, basePrice: 500, sacCode: '999312' },
      { serviceName: 'Lipid Profile (Cholesterol)', category: 'Biochemistry', durationMinutes: 10, basePrice: 600, sacCode: '999312' },
      { serviceName: 'Complete Blood Count (CBC)', category: 'Hematology', durationMinutes: 10, basePrice: 350, sacCode: '999312' },
      { serviceName: 'Thyroid Profile (TSH, T3, T4)', category: 'Endocrinology', durationMinutes: 10, basePrice: 700, sacCode: '999312' },
      { serviceName: 'Liver Function Test (LFT)', category: 'Biochemistry', durationMinutes: 10, basePrice: 600, sacCode: '999312' },
      { serviceName: 'Kidney Function Test (KFT)', category: 'Biochemistry', durationMinutes: 10, basePrice: 600, sacCode: '999312' },
      { serviceName: 'Urine Routine & Microscopy', category: 'Pathology', durationMinutes: 10, basePrice: 150, sacCode: '999312' },
      { serviceName: 'Blood Pressure Check', category: 'Vitals', durationMinutes: 5, basePrice: 0, sacCode: '999312' },
    ],
  }

  const services = seedMap[templateType]
  if (!services) return

  for (const svc of services) {
    await db.serviceCatalog.create({ data: svc })
  }
}
