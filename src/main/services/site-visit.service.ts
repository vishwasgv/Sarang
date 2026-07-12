import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

// Fresh-audit build (2026-07-12) — Civil Engineer real depth. A site visit
// log (survey/inspection/progress-check findings) is genuine everyday
// civil-practice bookkeeping, gated on the site_visit_log module.

export async function listSiteVisits(projectId: string) {
  try {
    const db = getPrisma()
    const items = await db.siteVisit.findMany({
      where: { projectId },
      include: { recordedBy: { select: { id: true, fullName: true } } },
      orderBy: { visitDate: 'desc' },
    })
    return { success: true, data: items }
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
}) {
  try {
    if (!payload.visitDate) return { success: false, error: { code: 'SV-002', message: 'Visit date is required.' } }
    const db = getPrisma()
    const item = await db.siteVisit.create({
      data: {
        projectId: payload.projectId,
        visitDate: new Date(payload.visitDate),
        visitType: payload.visitType ?? 'INSPECTION',
        findings: payload.findings ?? null,
        weatherConditions: payload.weatherConditions ?? null,
        recordedById: payload.recordedById ?? null,
      },
      include: { recordedBy: { select: { id: true, fullName: true } } },
    })
    await logAction({ action: 'SITE_VISIT_CREATED', entityType: 'SiteVisit', entityId: item.id, newValue: { visitType: item.visitType, visitDate: item.visitDate } })
    return { success: true, data: item }
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
}) {
  try {
    const db = getPrisma()
    const { id, visitDate, ...rest } = payload
    const item = await db.siteVisit.update({
      where: { id },
      data: {
        ...rest,
        ...(visitDate !== undefined ? { visitDate: new Date(visitDate) } : {}),
      },
      include: { recordedBy: { select: { id: true, fullName: true } } },
    })
    await logAction({ action: 'SITE_VISIT_UPDATED', entityType: 'SiteVisit', entityId: id })
    return { success: true, data: item }
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
