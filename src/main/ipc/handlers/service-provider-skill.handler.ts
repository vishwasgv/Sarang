import { requirePermission } from '../permission-guard'
import { listProviderSkillsForEmployee, setProviderSkills, listQualifiedProviders } from '../../services/service-provider-skill.service'
import { SetProviderSkillsSchema, EmployeeIdSchema, ServiceCatalogIdSchema } from '../../validation/service-provider-skill.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('providerSkills:listForEmployee', async (payload) => {
    const deny = await requirePermission('hr.view'); if (deny) return deny
    const parsed = EmployeeIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return listProviderSkillsForEmployee(parsed.data.employeeId)
  })

  handle('providerSkills:set', async (payload) => {
    const deny = await requirePermission('hr.manage'); if (deny) return deny
    const parsed = SetProviderSkillsSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return setProviderSkills(parsed.data.employeeId, parsed.data.serviceCatalogIds)
  })

  handle('providerSkills:listQualified', async (payload) => {
    // Same gate the appointment booking flow itself uses (this codebase has
    // no dedicated 'appointments.*' permission — booking is gated on billing.*).
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = ServiceCatalogIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return listQualifiedProviders(parsed.data.serviceCatalogId)
  })
}
