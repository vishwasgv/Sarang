import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { billingService } from './billing.service'
import { parseLocalDateStart } from '../utils/date.util'

// Fresh-audit build (2026-07-12) — Civil Engineer real depth. A site visit
// log (survey/inspection/progress-check findings) is genuine everyday
// civil-practice bookkeeping, gated on the site_visit_log module.

// SiteVisit.billableAmount is a Prisma Decimal field — Electron's IPC
// (structured clone) cannot serialize a Decimal instance and throws "An
// object could not be cloned" on every response that includes one.
function serializeSiteVisit<T extends { billableAmount: unknown }>(v: T): T {
  return { ...v, billableAmount: v.billableAmount == null ? null : Number(v.billableAmount) }
}

export async function listSiteVisits(projectId: string) {
  try {
    const db = getPrisma()
    const items = await db.siteVisit.findMany({
      where: { projectId },
      include: { recordedBy: { select: { id: true, fullName: true } } },
      orderBy: { visitDate: 'desc' },
    })
    return { success: true, data: items.map(serializeSiteVisit) }
  } catch (err) {
    return { success: false, error: { code: 'SV-001', message: err instanceof Error ? err.message : 'Could not list site visits.' } }
  }
}

export async function createSiteVisit(payload: {
  projectId: string
  visitDate: string
  visitType?: string
  findings?: string
  weatherConditions?: string
  // recordedById is an Employee id (SiteVisit.recordedBy → Employee, not
  // User) — there is no User→Employee mapping in this schema, so this can
  // only ever be set by an explicit employee picker, never auto-stamped
  // from the logged-in session's userId (that was a real FK-violation bug:
  // a User.id blindly assigned to an Employee FK). Same fix already
  // established in treatment-plan.service.ts for the identical mistake.
  recordedById?: string
  // Phase 58 §2 — GPS tagging, from the device's real Geolocation API
  // reading (with a manual-entry fallback in the UI).
  latitude?: number
  longitude?: number
  locationAccuracy?: number
  // Phase 68 §9.1 — Civil Engineer items 1/2: per-visit callout fee.
  billableAmount?: number
}) {
  try {
    if (!payload.visitDate) return { success: false, error: { code: 'SV-002', message: 'Visit date is required.' } }
    const db = getPrisma()
    const item = await db.siteVisit.create({
      data: {
        projectId: payload.projectId,
        // Real bug found live (2026-08-27 Phase 68 audit): a bare
        // `new Date('YYYY-MM-DD')` parses as UTC midnight — inconsistent
        // with this app's own parseLocalDateStart convention used
        // everywhere else for a date-only write.
        visitDate: parseLocalDateStart(payload.visitDate),
        visitType: payload.visitType ?? 'INSPECTION',
        findings: payload.findings ?? null,
        weatherConditions: payload.weatherConditions ?? null,
        recordedById: payload.recordedById ?? null,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        locationAccuracy: payload.locationAccuracy ?? null,
        billableAmount: payload.billableAmount ?? null,
      },
      include: { recordedBy: { select: { id: true, fullName: true } } },
    })
    await logAction({ action: 'SITE_VISIT_CREATED', entityType: 'SiteVisit', entityId: item.id, newValue: { visitType: item.visitType, visitDate: item.visitDate } })
    return { success: true, data: serializeSiteVisit(item) }
  } catch (err) {
    return { success: false, error: { code: 'SV-003', message: err instanceof Error ? err.message : 'Could not record site visit.' } }
  }
}

export async function updateSiteVisit(payload: {
  id: string
  visitDate?: string
  visitType?: string
  findings?: string | null
  weatherConditions?: string | null
  latitude?: number | null
  longitude?: number | null
  locationAccuracy?: number | null
  billableAmount?: number | null
}) {
  try {
    const db = getPrisma()
    const { id, visitDate, ...rest } = payload
    const item = await db.siteVisit.update({
      where: { id },
      data: {
        ...rest,
        ...(visitDate !== undefined ? { visitDate: parseLocalDateStart(visitDate) } : {}),
      },
      include: { recordedBy: { select: { id: true, fullName: true } } },
    })
    await logAction({ action: 'SITE_VISIT_UPDATED', entityType: 'SiteVisit', entityId: id })
    return { success: true, data: serializeSiteVisit(item) }
  } catch (err) {
    return { success: false, error: { code: 'SV-004', message: err instanceof Error ? err.message : 'Could not update site visit.' } }
  }
}

export async function deleteSiteVisit(id: string) {
  try {
    const db = getPrisma()
    await db.siteVisit.delete({ where: { id } })
    await logAction({ action: 'SITE_VISIT_DELETED', entityType: 'SiteVisit', entityId: id })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'SV-005', message: err instanceof Error ? err.message : 'Could not delete site visit.' } }
  }
}

// Phase 58 §2 — structured material-test-result fields (value + pass/fail),
// not buried in SiteVisit's free-text findings.

export async function listMaterialTestResults(siteVisitId: string) {
  try {
    const db = getPrisma()
    const items = await db.materialTestResult.findMany({ where: { siteVisitId }, orderBy: { createdAt: 'asc' } })
    return { success: true, data: items }
  } catch (err) {
    return { success: false, error: { code: 'MTR-001', message: err instanceof Error ? err.message : 'Could not list material test results.' } }
  }
}

// result is auto-computed ONLY when both testValue and requiredMinValue are
// provided (a real, well-defined >= threshold comparison) — never guessed
// otherwise; stays PENDING for manual entry (e.g. a test whose pass
// criteria isn't a simple minimum, like a target range).
function computeResult(testValue?: number, requiredMinValue?: number): string {
  if (testValue == null || requiredMinValue == null) return 'PENDING'
  return testValue >= requiredMinValue ? 'PASS' : 'FAIL'
}

export async function addMaterialTestResult(payload: {
  siteVisitId: string
  testType: string
  materialDescription?: string
  testValue?: number
  unit?: string
  requiredMinValue?: number
  testedDate?: string
  notes?: string
}) {
  try {
    if (!payload.testType.trim()) return { success: false, error: { code: 'MTR-002', message: 'Test type is required.' } }
    const db = getPrisma()
    const visit = await db.siteVisit.findUnique({ where: { id: payload.siteVisitId }, select: { id: true } })
    if (!visit) return { success: false, error: { code: 'MTR-003', message: 'Site visit not found.' } }

    const item = await db.materialTestResult.create({
      data: {
        siteVisitId: payload.siteVisitId,
        testType: payload.testType.trim(),
        materialDescription: payload.materialDescription?.trim() || null,
        testValue: payload.testValue ?? null,
        unit: payload.unit?.trim() || null,
        requiredMinValue: payload.requiredMinValue ?? null,
        result: computeResult(payload.testValue, payload.requiredMinValue),
        // Real bug found live (2026-08-27 Phase 68 audit): same UTC-midnight
        // bug as SiteVisit.visitDate above.
        testedDate: payload.testedDate ? parseLocalDateStart(payload.testedDate) : null,
        notes: payload.notes?.trim() || null,
      },
    })
    await logAction({ action: 'MATERIAL_TEST_RESULT_CREATED', entityType: 'MaterialTestResult', entityId: item.id, newValue: { testType: item.testType, result: item.result } })
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'MTR-004', message: err instanceof Error ? err.message : 'Could not add material test result.' } }
  }
}

export async function updateMaterialTestResult(payload: {
  id: string
  testType?: string
  materialDescription?: string | null
  testValue?: number | null
  unit?: string | null
  requiredMinValue?: number | null
  result?: string
  testedDate?: string | null
  notes?: string | null
}) {
  try {
    const db = getPrisma()
    const existing = await db.materialTestResult.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'MTR-003', message: 'Material test result not found.' } }

    const { id, testedDate, result, ...rest } = payload
    const nextTestValue = payload.testValue !== undefined ? payload.testValue : existing.testValue
    const nextMinValue = payload.requiredMinValue !== undefined ? payload.requiredMinValue : existing.requiredMinValue
    // An explicit result (e.g. a manual PASS/FAIL for a non-threshold test)
    // is honored as-is; otherwise it's recomputed from whatever value/
    // threshold combination is now in effect.
    const nextResult = result ?? computeResult(nextTestValue ?? undefined, nextMinValue ?? undefined)

    const item = await db.materialTestResult.update({
      where: { id },
      data: {
        ...rest,
        result: nextResult,
        ...(testedDate !== undefined ? { testedDate: testedDate ? parseLocalDateStart(testedDate) : null } : {}),
      },
    })
    await logAction({ action: 'MATERIAL_TEST_RESULT_UPDATED', entityType: 'MaterialTestResult', entityId: id })
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'MTR-005', message: err instanceof Error ? err.message : 'Could not update material test result.' } }
  }
}

export async function deleteMaterialTestResult(id: string) {
  try {
    const db = getPrisma()
    await db.materialTestResult.delete({ where: { id } })
    await logAction({ action: 'MATERIAL_TEST_RESULT_DELETED', entityType: 'MaterialTestResult', entityId: id })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'MTR-006', message: err instanceof Error ? err.message : 'Could not delete material test result.' } }
  }
}

// Phase 68 §9.1 — Civil Engineer item 1: site-visit-to-invoice linkage.
// Same atomic-claim-sentinel pattern as service-project-milestone.service.ts's
// generateMilestoneInvoice — a single UPDATE...WHERE invoiceId IS NULL is
// one SQL statement under SQLite's single-writer lock, so two
// near-simultaneous calls for the same visit can't both pass.
const INVOICE_CLAIM_SENTINEL = 'PENDING_INVOICE_GENERATION'

export async function generateSiteVisitInvoice(siteVisitId: string) {
  const db = getPrisma()
  try {
    const claim = await db.siteVisit.updateMany({
      where: { id: siteVisitId, invoiceId: null },
      data: { invoiceId: INVOICE_CLAIM_SENTINEL },
    })
    if (claim.count === 0) {
      const existing = await db.siteVisit.findUnique({ where: { id: siteVisitId }, select: { id: true } })
      if (!existing) return { success: false, error: { code: 'SV-006', message: 'Site visit not found.' } }
      return { success: false, error: { code: 'SV-007', message: 'Invoice already generated for this site visit.' } }
    }

    try {
      const visit = await db.siteVisit.findUnique({
        where: { id: siteVisitId },
        include: { project: { select: { id: true, clientId: true, projectName: true } } },
      })
      if (!visit || visit.billableAmount == null || Number(visit.billableAmount) <= 0) {
        await db.siteVisit.update({ where: { id: siteVisitId }, data: { invoiceId: null } })
        return { success: false, error: { code: 'SV-008', message: 'Set a billable amount greater than zero before generating an invoice.' } }
      }

      let product = await db.product.findFirst({ where: { hsnCode: '998311', isActive: true } })
      if (!product) {
        product = await db.product.create({
          data: { productName: 'Professional Consulting Services', productType: 'SERVICE', hsnCode: '998311', sellingPrice: 0, taxRate: 18, unit: 'NOS', isActive: true },
        })
      }

      const result = await billingService.createInvoice({
        customerId: visit.project.clientId,
        paymentMethod: 'CREDIT',
        gstType: 'CGST_SGST',
        items: [{
          productId: product.id,
          quantity: 1,
          unitPrice: Number(visit.billableAmount),
        }],
        notes: `Site Visit: ${visit.visitType} — ${visit.project.projectName}`,
        referenceNumber: siteVisitId.slice(0, 12),
      })
      if (!result.success) {
        await db.siteVisit.update({ where: { id: siteVisitId }, data: { invoiceId: null } })
        return result
      }

      const invoice = result.data as { id: string }
      await db.siteVisit.update({ where: { id: siteVisitId }, data: { invoiceId: invoice.id } })
      await logAction({ action: 'SITE_VISIT_INVOICED', entityType: 'SiteVisit', entityId: siteVisitId, newValue: { invoiceId: invoice.id } })

      return { success: true, data: { invoiceId: invoice.id } }
    } catch (err) {
      await db.siteVisit.update({ where: { id: siteVisitId }, data: { invoiceId: null } }).catch(() => {})
      throw err
    }
  } catch (err) {
    return { success: false, error: { code: 'SV-009', message: err instanceof Error ? err.message : 'Could not generate site visit invoice.' } }
  }
}
