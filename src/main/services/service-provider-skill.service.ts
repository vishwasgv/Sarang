import { getPrisma } from '../database/db'

// Phase 58 §2 — Beauty Salon: stylist skill-matching, replacing any-staff-
// any-service. An employee's set of qualified services is edited as a whole
// list (replace-all on save), same UX as any other "assign a set of X to Y"
// checklist in this codebase — not incremental per-row add/remove calls.

export async function listProviderSkillsForEmployee(employeeId: string) {
  try {
    const db = getPrisma()
    const rows = await db.serviceProviderSkill.findMany({
      where: { employeeId },
      select: { serviceCatalogId: true },
    })
    return { success: true, data: rows.map((r) => r.serviceCatalogId) }
  } catch (err) {
    return { success: false, error: { code: 'SPS-001', message: err instanceof Error ? err.message : 'Could not load provider skills.' } }
  }
}

export async function setProviderSkills(employeeId: string, serviceCatalogIds: string[]) {
  try {
    const db = getPrisma()
    const employee = await db.employee.findUnique({ where: { id: employeeId }, select: { id: true } })
    if (!employee) return { success: false, error: { code: 'SPS-002', message: 'Employee not found.' } }

    await db.$transaction(async (tx) => {
      await tx.serviceProviderSkill.deleteMany({ where: { employeeId } })
      if (serviceCatalogIds.length > 0) {
        await tx.serviceProviderSkill.createMany({
          data: serviceCatalogIds.map((serviceCatalogId) => ({ employeeId, serviceCatalogId })),
        })
      }
    })

    return { success: true, data: { employeeId, serviceCatalogIds } }
  } catch (err) {
    return { success: false, error: { code: 'SPS-003', message: err instanceof Error ? err.message : 'Could not save provider skills.' } }
  }
}

// Booking-form-facing: who can perform this specific service. A service
// with ZERO configured rows returns an empty list — the CALLER (the
// booking form) is responsible for treating "no skills configured at all
// for this service" as "any provider can perform it", not this function
// silently guessing that intent itself.
export async function listQualifiedProviders(serviceCatalogId: string) {
  try {
    const db = getPrisma()
    const rows = await db.serviceProviderSkill.findMany({
      where: { serviceCatalogId },
      select: { employeeId: true },
    })
    return { success: true, data: rows.map((r) => r.employeeId) }
  } catch (err) {
    return { success: false, error: { code: 'SPS-004', message: err instanceof Error ? err.message : 'Could not load qualified providers.' } }
  }
}
