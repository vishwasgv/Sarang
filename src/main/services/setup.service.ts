import { getPrisma } from '../database/db'
import { hashPassword, generateRecoveryCode, checkPasswordLength } from './auth.service'
import { seedDefaultData } from '../database/seed'
import { logAction } from './audit.service'
import { SERVICE_TEMPLATE_TYPES, getLanguageLockFor } from './industry-template.service'
import { seedDefaultServicesForTemplate } from './service-catalog.service'
import { logger } from '../utils/logger'
import { isValidLogoPath } from '../utils/logo-path'
import { getLicenseState } from './license.service'
import type { ApiResponse, SetupPayload } from '../ipc/channels'

/**
 * Real gap found+closed 2026-07-28: this used to report setup as "complete"
 * the moment a BusinessProfile + admin User existed, with zero regard for
 * whether a license had ever been activated. SetupWizard.tsx's onSubmit()
 * calls completeSetup() (creating both of those) a full screen BEFORE its
 * final step ever asks for a license key — the key-entry checkbox only gates
 * the "Launch Dashboard" *button*, a client-side convenience, not a real
 * block (this codebase's own established principle elsewhere — see
 * billing.service.ts's licensing check comment — is that a disabled button
 * alone doesn't stop anything real). Concretely: closing the app (a crash,
 * a forced reboot, an accidental Alt-F4) at any point after that submit but
 * before "Launch Dashboard" is clicked left a fully working, permanently
 * license-free install — isSetupComplete() would report true on the next
 * launch (profile + admin already exist) and SetupWizard would never be
 * shown again, with getLicenseState()'s NOT_ACTIVATED status never gated by
 * any invoicing check. Not a contrived exploit — an ordinary interrupted
 * first run, silently and permanently bypassing the entire licensing model.
 * Fixed by making "complete" require a real license too, and reporting
 * `needsLicenseOnly` separately so the caller can resume with a lightweight
 * license prompt (reusing the already-created business/admin) instead of
 * restarting the whole wizard and hitting a duplicate-username conflict.
 */
export async function isSetupComplete(): Promise<ApiResponse<{ complete: boolean; needsLicenseOnly: boolean }>> {
  try {
    const db = getPrisma()
    const [profile, adminUser, licenseState] = await Promise.all([
      db.businessProfile.findFirst(),
      db.user.findFirst(),
      getLicenseState()
    ])
    const businessReady = !!(profile && adminUser)
    const licenseReady = licenseState.status !== 'NOT_ACTIVATED'
    return { success: true, data: { complete: businessReady && licenseReady, needsLicenseOnly: businessReady && !licenseReady } }
  } catch {
    return { success: true, data: { complete: false, needsLicenseOnly: false } }
  }
}

export async function completeSetup(payload: SetupPayload): Promise<ApiResponse> {
  try {
    // logoPath must stay inside userData/logos — see utils/logo-path.ts. An
    // unrestricted value here would be interpolated unescaped into every
    // printed/exported document once setup completes.
    if (!isValidLogoPath(payload.logoPath)) {
      return { success: false, error: { code: 'VAL-002', message: 'Invalid logo file path.' } }
    }

    // REAL BUG found+fixed 2026-07-30: this Admin account — the single most
    // powerful credential on the whole install — was only held to
    // SetupPayload's own floor-level `min(6)` schema check. Every other
    // password-setting path (users:create, adminResetPassword, changePassword,
    // recovery-code reset) defers to the real, configurable policy via
    // checkPasswordLength(), so a fresh install let its Admin password be
    // weaker than the minimum enforced on every user created after it.
    const passwordError = await checkPasswordLength(payload.adminPassword)
    if (passwordError) return passwordError

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

    // Offline recovery code — the only password-reset path this app has
    // (no SMS/email/cloud exists). Generated once here, shown to the owner
    // exactly once by SetupWizard, and never persisted in plaintext.
    const recoveryCode = generateRecoveryCode()
    const recoveryCodeHash = await hashPassword(recoveryCode)

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

      await tx.setting.upsert({
        where: { settingKey: 'recovery_code_hash' },
        create: { settingKey: 'recovery_code_hash', settingValue: recoveryCodeHash, settingType: 'STRING' },
        update: { settingValue: recoveryCodeHash }
      })

      // BUG FOUND 2026-07-22: this used to run AFTER the transaction above
      // had already committed, deliberately excluded as "not critical." If
      // it failed (or the app crashed) between that commit and this call,
      // isSetupComplete() would already report true (profile + admin user
      // exist), permanently locking the business out of ever getting its
      // default service catalog with no in-app recovery path. Now inside
      // the same transaction — a failure here rolls back the whole setup,
      // and the wizard can simply be re-run from scratch.
      if (SERVICE_TEMPLATE_TYPES.has(payload.businessType)) {
        await seedDefaultServicesForTemplate(payload.businessType, tx)
      }
    }, { timeout: 30000 })

    return { success: true, data: { recoveryCode } }
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
    // 2026-09-02 — Password Policy: expiry/history, both 0 = disabled by default.
    { settingKey: 'password_expiry_days', settingValue: '0', settingType: 'NUMBER' },
    { settingKey: 'password_history_count', settingValue: '0', settingType: 'NUMBER' },
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
