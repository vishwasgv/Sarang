import { getPrisma } from '../database/db'
import { hashPassword } from './auth.service'
import { seedDefaultData } from '../database/seed'
import { logAction } from './audit.service'
import { SERVICE_TEMPLATE_TYPES, getLanguageLockFor } from './industry-template.service'
import { seedDefaultServicesForTemplate } from './service-catalog.service'
import { logger } from '../utils/logger'
import type { ApiResponse, SetupPayload } from '../ipc/channels'

export async function isSetupComplete(): Promise<ApiResponse<boolean>> {
  try {
    const db = getPrisma()
    const profile = await db.businessProfile.findFirst()
    const adminUser = await db.user.findFirst()
    return { success: true, data: !!(profile && adminUser) }
  } catch {
    return { success: true, data: false }
  }
}

export async function completeSetup(payload: SetupPayload): Promise<ApiResponse> {
  try {
    const db = getPrisma()

    // Ensure default roles and permissions exist
    await seedDefaultData()

    // Get Admin role
    const adminRole = await db.role.findFirst({ where: { roleName: 'Admin' } })
    if (!adminRole) {
      return { success: false, error: { code: 'SYS-001', message: 'Setup failed. Could not find admin role.' } }
    }

    // Check if username already exists
    const existingUser = await db.user.findUnique({ where: { username: payload.adminUsername } })
    if (existingUser) {
      return { success: false, error: { code: 'USER-001', message: 'This username is already in use. Choose a different username.' } }
    }

    const passwordHash = await hashPassword(payload.adminPassword)

    // Use transaction for atomicity
    await db.$transaction(async (tx) => {
      // Delete any existing profile (fresh setup)
      await tx.businessProfile.deleteMany()

      const isServiceTemplate = SERVICE_TEMPLATE_TYPES.has(payload.businessType)
      await tx.businessProfile.create({
        data: {
          businessName: payload.businessName,
          businessType: payload.businessType,
          businessCategory: isServiceTemplate ? 'SERVICE' : 'PRODUCT',
          serviceTemplateType: isServiceTemplate ? payload.businessType : (payload.serviceTemplateType ?? null),
          languageLock: getLanguageLockFor(payload.businessType),
          ownerName: payload.ownerName,
          country: payload.country,
          currencyCode: payload.currencyCode,
          currencySymbol: payload.currencySymbol,
          taxModel: payload.taxModel,
          phone: payload.phone,
          email: payload.email,
          taxNumber: payload.taxNumber,
          upiId: payload.upiId,
          logoPath: payload.logoPath
        }
      })

      const admin = await tx.user.create({
        data: {
          fullName: payload.adminFullName,
          username: payload.adminUsername,
          passwordHash,
          roleId: adminRole.id,
          isActive: true
        }
      })

      await tx.auditLog.create({
        data: {
          userId: admin.id,
          action: 'SETUP_COMPLETE',
          entityType: 'BusinessProfile',
          newValue: JSON.stringify({ businessName: payload.businessName, businessType: payload.businessType })
        }
      })

      // Seed default tax configurations and expense categories
      await seedBusinessDefaults(tx, payload.country, payload.taxModel)
    })

    // Seed default service catalog entries for this template (outside transaction — not critical)
    if (SERVICE_TEMPLATE_TYPES.has(payload.businessType)) {
      await seedDefaultServicesForTemplate(payload.businessType)
    }

    return { success: true }
  } catch (err) {
    logger.error('[Setup] completeSetup error:', err instanceof Error ? (err.stack ?? err.message) : String(err))
    return { success: false, error: { code: 'SYS-001', message: 'Setup could not be completed. Please try again.' } }
  }
}

async function seedBusinessDefaults(tx: Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0], country: string, taxModel: string) {
  // Idempotent creates — app startup's seedDefaultData() (database/seed.ts)
  // already runs before this wizard can ever be shown and seeds its own
  // default expense categories ('Rent', 'Miscellaneous', etc. overlap here)
  // and GST tax configs. Plain .create() would hit a unique constraint
  // violation on every single fresh install.
  async function createTaxConfigIfMissing(t: { taxName: string; taxType: string; rate: number; country: string; isDefault?: boolean }) {
    const existing = await tx.taxConfiguration.findFirst({ where: { taxName: t.taxName, taxType: t.taxType } })
    if (!existing) await tx.taxConfiguration.create({ data: t })
  }

  // Default tax configurations
  if (taxModel === 'GST') {
    const gstRates = [
      { taxName: 'GST 0%', taxType: 'GST', rate: 0, country },
      { taxName: 'GST 5%', taxType: 'GST', rate: 5, country },
      { taxName: 'GST 12%', taxType: 'GST', rate: 12, country },
      { taxName: 'GST 18%', taxType: 'GST', rate: 18, country, isDefault: true },
      { taxName: 'GST 28%', taxType: 'GST', rate: 28, country }
    ]
    for (const t of gstRates) {
      await createTaxConfigIfMissing(t)
    }
  } else if (taxModel === 'VAT') {
    await createTaxConfigIfMissing({ taxName: 'VAT 20%', taxType: 'VAT', rate: 20, country, isDefault: true })
  } else if (taxModel === 'SALES_TAX') {
    await createTaxConfigIfMissing({ taxName: 'Sales Tax', taxType: 'SALES_TAX', rate: 8, country, isDefault: true })
  } else {
    await createTaxConfigIfMissing({ taxName: 'No Tax', taxType: 'NONE', rate: 0, country, isDefault: true })
  }

  // Default expense categories
  const expenseCategories = ['Rent', 'Salary', 'Electricity', 'Fuel', 'Maintenance', 'Supplies', 'Marketing', 'Miscellaneous']
  for (const cat of expenseCategories) {
    const existing = await tx.expenseCategory.findUnique({ where: { categoryName: cat } })
    if (!existing) await tx.expenseCategory.create({ data: { categoryName: cat } })
  }

  // Default settings
  const defaults = [
    { settingKey: 'allow_negative_inventory', settingValue: 'false', settingType: 'BOOLEAN' },
    // Default ON — a shop owner who never opens Settings previously ended up
    // with zero backups until they manually triggered one. Auto-backup is
    // local-disk only (no cloud, matching the app's zero-cost/offline rules),
    // but "on by default" is a real safety improvement even so, and pairs
    // with the new backup_destination_dir setting below for owners who want
    // to point it at a USB drive or other removable media.
    { settingKey: 'auto_backup_enabled', settingValue: 'true', settingType: 'BOOLEAN' },
    { settingKey: 'auto_backup_frequency', settingValue: 'DAILY', settingType: 'STRING' },
    { settingKey: 'invoice_prefix', settingValue: 'INV', settingType: 'STRING' },
    { settingKey: 'invoice_next_number', settingValue: '1', settingType: 'NUMBER' },
    { settingKey: 'date_format', settingValue: 'DD/MM/YYYY', settingType: 'STRING' },
    { settingKey: 'time_format', settingValue: '12H', settingType: 'STRING' },
    { settingKey: 'number_format', settingValue: 'IN', settingType: 'STRING' },
    { settingKey: 'decimal_places', settingValue: '2', settingType: 'NUMBER' },
    { settingKey: 'thermal_print_size', settingValue: '80mm', settingType: 'STRING' },
    { settingKey: 'password_min_length', settingValue: '10', settingType: 'NUMBER' },
    { settingKey: 'session_timeout_minutes', settingValue: '30', settingType: 'NUMBER' },
    { settingKey: 'auto_backup_interval_days', settingValue: '7', settingType: 'NUMBER' },
    { settingKey: 'backup_retention_count', settingValue: '10', settingType: 'NUMBER' },
    { settingKey: 'backup_reminder_days', settingValue: '7', settingType: 'NUMBER' },
    { settingKey: 'currency_symbol_position', settingValue: 'prefix', settingType: 'STRING' },
    // Default is INR-sized; businesses on other currencies can adjust it in Settings
    // since "100,000" means very different things across currencies.
    { settingKey: 'large_outstanding_threshold', settingValue: '100000', settingType: 'NUMBER' }
  ]
  for (const s of defaults) {
    await tx.setting.upsert({ where: { settingKey: s.settingKey }, create: s, update: {} })
  }
}
