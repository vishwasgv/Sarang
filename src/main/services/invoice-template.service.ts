import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import type { InvoiceTemplateConfig } from './print.service'
import type { CreateInvoiceTemplatePayload, UpdateInvoiceTemplatePayload } from '../validation/invoice-template.validation'

// The phase's own named "wow factor" item. 4 seeded starter configs — a
// handful of accent-color/footer/density combinations, not separate code
// paths (print.service.ts's generateInvoiceHtml stays one shared HTML
// skeleton, driven by whichever config resolves for a given invoice).
const STARTER_TEMPLATES: Array<{ name: string; config: InvoiceTemplateConfig }> = [
  { name: 'Classic', config: { accentColor: '#00AEEF', density: 'comfortable' } },
  { name: 'Modern', config: { accentColor: '#7C3AED', density: 'comfortable' } },
  { name: 'Minimal', config: { accentColor: '#0F172A', density: 'compact' } },
  { name: 'GST Detailed', config: { accentColor: '#059669', density: 'comfortable', footerText: 'Thank you for your business! — GST Invoice, computer-generated.' } },
]

// Lazy-seed, same convention as chartOfAccountsService's own 13 standard
// accounts — first real call on a fresh install creates the 4 starters,
// every later call is a no-op. "Classic" (the pre-Phase-63 look, byte-for-
// byte) is the one seeded isDefault:true, so an install that never touches
// this feature at all keeps rendering exactly as it did before this phase.
async function ensureSeeded(): Promise<void> {
  const db = getPrisma()
  const existing = await db.invoiceTemplate.findFirst({ where: { isSystem: true } })
  if (existing) return
  for (const [i, t] of STARTER_TEMPLATES.entries()) {
    await db.invoiceTemplate.create({
      data: { name: t.name, configJson: JSON.stringify(t.config), isSystem: true, isDefault: i === 0 }
    })
  }
}

export const invoiceTemplateService = {
  async listTemplates() {
    try {
      await ensureSeeded()
      const db = getPrisma()
      const templates = await db.invoiceTemplate.findMany({ orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }] })
      return { success: true, data: templates.map(t => ({ ...t, config: JSON.parse(t.configJson) })) }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to list invoice templates.' } }
    }
  },

  async createTemplate(payload: CreateInvoiceTemplatePayload, userId?: string) {
    try {
      const db = getPrisma()
      const template = await db.invoiceTemplate.create({
        data: { name: payload.name, configJson: JSON.stringify(payload.config), isSystem: false, isDefault: false }
      })
      await logAction({ userId, action: 'INVOICE_TEMPLATE_CREATED', entityType: 'InvoiceTemplate', entityId: template.id, newValue: { name: template.name } })
      return { success: true, data: { ...template, config: payload.config } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to create invoice template.' } }
    }
  },

  async updateTemplate(payload: UpdateInvoiceTemplatePayload, userId?: string) {
    try {
      const db = getPrisma()
      const existing = await db.invoiceTemplate.findUnique({ where: { id: payload.id } })
      if (!existing) return { success: false, error: { code: 'IT-001', message: 'Invoice template not found.' } }
      if (existing.isSystem) return { success: false, error: { code: 'IT-002', message: 'System starter templates cannot be edited — duplicate it into a new custom template instead.' } }

      const updated = await db.invoiceTemplate.update({
        where: { id: payload.id },
        data: {
          name: payload.name ?? existing.name,
          configJson: payload.config ? JSON.stringify(payload.config) : existing.configJson
        }
      })
      await logAction({ userId, action: 'INVOICE_TEMPLATE_UPDATED', entityType: 'InvoiceTemplate', entityId: payload.id, newValue: payload })
      return { success: true, data: { ...updated, config: JSON.parse(updated.configJson) } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to update invoice template.' } }
    }
  },

  async deleteTemplate(id: string, userId?: string) {
    try {
      const db = getPrisma()
      const existing = await db.invoiceTemplate.findUnique({ where: { id } })
      if (!existing) return { success: false, error: { code: 'IT-001', message: 'Invoice template not found.' } }
      if (existing.isSystem) return { success: false, error: { code: 'IT-002', message: 'System starter templates cannot be deleted.' } }
      await db.invoiceTemplate.delete({ where: { id } })
      await logAction({ userId, action: 'INVOICE_TEMPLATE_DELETED', entityType: 'InvoiceTemplate', entityId: id })
      return { success: true }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to delete invoice template.' } }
    }
  },

  // Sets the business's own default (BusinessProfile.defaultInvoiceTemplateId),
  // distinct from a template's own isSystem-seeded isDefault flag (the
  // ultimate fallback when a business has never chosen one at all).
  async setBusinessDefaultTemplate(templateId: string | null, userId?: string) {
    try {
      const db = getPrisma()
      if (templateId) {
        const template = await db.invoiceTemplate.findUnique({ where: { id: templateId } })
        if (!template) return { success: false, error: { code: 'IT-001', message: 'Invoice template not found.' } }
      }
      const profile = await db.businessProfile.findFirst()
      if (!profile) return { success: false, error: { code: 'BP-001', message: 'Business profile not found.' } }
      const updated = await db.businessProfile.update({ where: { id: profile.id }, data: { defaultInvoiceTemplateId: templateId } })
      await logAction({ userId, action: 'BUSINESS_DEFAULT_TEMPLATE_SET', entityType: 'BusinessProfile', entityId: profile.id, newValue: { templateId } })
      return { success: true, data: { defaultInvoiceTemplateId: updated.defaultInvoiceTemplateId } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to set default template.' } }
    }
  },

  // The one function every real print path calls — most-specific-wins:
  // (1) a per-invoice override, (2) the business's own chosen default,
  // (3) the isSystem template flagged isDefault (seeded "Classic", which
  // renders byte-identical to the pre-Phase-63 layout). Returns null only
  // if literally nothing resolves (e.g. ensureSeeded hasn't run yet in an
  // unusual code path) — generateInvoiceHtml already treats a null config
  // as "render with the original hardcoded defaults," so this degrades
  // safely either way.
  async resolveTemplateConfig(invoiceTemplateId: string | null | undefined, businessDefaultTemplateId: string | null | undefined): Promise<InvoiceTemplateConfig | null> {
    await ensureSeeded()
    const db = getPrisma()
    const targetId = invoiceTemplateId || businessDefaultTemplateId
    const template = targetId
      ? await db.invoiceTemplate.findUnique({ where: { id: targetId } })
      : await db.invoiceTemplate.findFirst({ where: { isDefault: true } })
    if (!template) return null
    try {
      return JSON.parse(template.configJson)
    } catch {
      return null
    }
  }
}
