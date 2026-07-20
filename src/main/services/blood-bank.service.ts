import { getPrisma } from '../database/db'
import { billingService } from './billing.service'
import { generateWhatsAppLink } from './notification-queue.service'
import { logAction } from './audit.service'
import { roundCurrency } from './currency.service'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]
type Db = ReturnType<typeof getPrisma>

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'
export type ComponentType = 'WHOLE_BLOOD' | 'PACKED_RBC' | 'PLATELETS' | 'PLASMA' | 'CRYOPRECIPITATE'
export type ScreeningStatus = 'PENDING' | 'PASSED' | 'FAILED'

// Real (not vertical-hardcoded) domain data — different blood components have
// materially different shelf lives, so a single global "expiring soon"
// threshold (the generic BatchManagementScreen's hardcoded 30 days) is wrong
// for blood: it would flag every single platelet unit as "expiring" for its
// entire ~5-day life, and miss the urgency of a whole-blood unit nearing day 42.
export const SHELF_LIFE_DAYS: Record<ComponentType, number> = {
  WHOLE_BLOOD: 35,
  PACKED_RBC: 42,
  PLATELETS: 5,
  PLASMA: 365,
  CRYOPRECIPITATE: 365,
}
export const EXPIRY_ALERT_DAYS: Record<ComponentType, number> = {
  WHOLE_BLOOD: 7,
  PACKED_RBC: 7,
  PLATELETS: 2,
  PLASMA: 30,
  CRYOPRECIPITATE: 30,
}

// Standard ABO/Rh compatibility for whole blood / packed RBC transfusion:
// recipientGroup -> set of donor groups they can safely receive from.
// Plasma compatibility is the REVERSE of RBC compatibility (AB is the
// universal plasma donor, O the universal plasma recipient) — a materially
// different rule per component type, not a detail that can be papered over
// with one shared matrix. Platelets/cryoprecipitate are conventionally issued
// with an ABO-preferred-but-not-strictly-typed practice in many blood banks,
// so no hard compatibility list is enforced for them here — this is advisory
// only regardless of component type (see the disclaimer in the issue flow),
// never a substitute for a real crossmatch.
const RBC_COMPATIBLE_DONORS: Record<BloodGroup, BloodGroup[]> = {
  'O-':  ['O-'],
  'O+':  ['O+', 'O-'],
  'A-':  ['A-', 'O-'],
  'A+':  ['A+', 'A-', 'O+', 'O-'],
  'B-':  ['B-', 'O-'],
  'B+':  ['B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
}
const PLASMA_COMPATIBLE_DONORS: Record<BloodGroup, BloodGroup[]> = {
  'AB+': ['AB+', 'AB-'],
  'AB-': ['AB-'],
  'A+':  ['A+', 'A-', 'AB+', 'AB-'],
  'A-':  ['A-', 'AB-'],
  'B+':  ['B+', 'B-', 'AB+', 'AB-'],
  'B-':  ['B-', 'AB-'],
  'O+':  ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'],
  'O-':  ['O-', 'A-', 'B-', 'AB-'],
}

export function checkCompatibility(recipientGroup: BloodGroup, donorGroup: BloodGroup, componentType: ComponentType): { compatible: boolean; note: string } {
  if (componentType === 'PLATELETS' || componentType === 'CRYOPRECIPITATE') {
    return { compatible: true, note: `${componentType} — ABO matching preferred but not strictly required; no hard rule enforced.` }
  }
  const matrix = componentType === 'PLASMA' ? PLASMA_COMPATIBLE_DONORS : RBC_COMPATIBLE_DONORS
  const compatible = matrix[recipientGroup]?.includes(donorGroup) ?? false
  return {
    compatible,
    note: compatible
      ? `${recipientGroup} recipient can receive ${componentType} from ${donorGroup} donor — compatible.`
      : `${recipientGroup} recipient and ${donorGroup} donor unit are INCOMPATIBLE for ${componentType} by standard ABO/Rh rules.`,
  }
}

// Thin IPC-facing wrapper around checkCompatibility for the Issue screen's
// pre-selection preview — the renderer must never re-derive the ABO/Rh
// matrices itself (single source of truth for a safety-relevant calculation).
export async function checkCompatibilityBatch(payload: {
  recipientBloodGroup: BloodGroup
  units: Array<{ donationRecordId: string; bloodGroup: BloodGroup; componentType: ComponentType }>
}) {
  try {
    const results = payload.units.map((u) => ({
      donationRecordId: u.donationRecordId,
      ...checkCompatibility(payload.recipientBloodGroup, u.bloodGroup, u.componentType),
    }))
    return { success: true, data: results }
  } catch (err) {
    return { success: false, error: { code: 'BB-034', message: err instanceof Error ? err.message : 'Could not check compatibility.' } }
  }
}

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86400000)
}

// Phase 58 §2 — cooldown varying by component type and donor sex, replacing
// the previous flat 90-day interval. A whole-blood/RBC donation depletes red
// cells, which take materially longer to replenish than a plasma/platelet
// apheresis donation (only that component is drawn, cells are returned to
// the donor) — hence the much shorter platelet/plasma intervals. Female
// donors get a longer whole-blood/RBC interval than male, reflecting
// commonly-cited guidance on higher iron-loss risk; this is a documented
// SIMPLIFICATION of real regulatory guidance (which varies by country/blood
// bank), not a medical claim — same caveat the original flat-90-days comment
// already carried, now just applied per-component/sex instead of once.
const COOLDOWN_DAYS: Record<ComponentType, number> = {
  WHOLE_BLOOD: 90,
  PACKED_RBC: 90,
  PLATELETS: 14,
  PLASMA: 28,
  CRYOPRECIPITATE: 28,
}
const FEMALE_WHOLE_BLOOD_COOLDOWN_DAYS = 120

function cooldownDaysFor(componentType: ComponentType | null, gender: string | null): number {
  const base = componentType ? (COOLDOWN_DAYS[componentType] ?? 90) : 90
  const isWholeBloodOrRbc = componentType === 'WHOLE_BLOOD' || componentType === 'PACKED_RBC' || !componentType
  if (isWholeBloodOrRbc && gender?.toUpperCase() === 'FEMALE') return FEMALE_WHOLE_BLOOD_COOLDOWN_DAYS
  return base
}

// Shared by listDonors/getDonor so every caller gets the same enriched shape
// — previously only listDonors computed this, so refreshing a donor's detail
// view via getDonor (e.g. right after marking them deferred) silently lost
// the field and the UI fell back to a wrong "Now" placeholder.
function computeNextEligibleDate(lastDonationDate: Date | null, componentType: string | null, gender: string | null): string | null {
  if (!lastDonationDate) return null
  const days = cooldownDaysFor((componentType as ComponentType) ?? null, gender)
  return new Date(lastDonationDate.getTime() + days * 86400000).toISOString()
}

async function nextNumber(tx: TxClient, model: 'donor' | 'donationRecord' | 'bloodIssue', field: string, prefix: string): Promise<string> {
  const now = new Date()
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const fullPrefix = `${prefix}-${yyyymm}-`
  const rows = await (tx as any)[model].findMany({ where: { [field]: { startsWith: fullPrefix } }, select: { [field]: true } })
  let seq = 1
  if (rows.length > 0) {
    const maxSeq = rows.reduce((max: number, r: Record<string, string>) => {
      const n = parseInt(r[field].slice(fullPrefix.length), 10)
      return isNaN(n) ? max : Math.max(max, n)
    }, 0)
    seq = maxSeq + 1
  }
  return `${fullPrefix}${String(seq).padStart(4, '0')}`
}

// Every donated+screened-passed unit becomes one ProductBatch row under this
// single shared placeholder Product — same find-or-create pattern already
// used twice (appointment.service.ts/lab-test-order.service.ts). Blood-group/
// component-type semantics live on DonationRecord, not on Product; Product
// here is purely the stock-ledger anchor ProductBatch's schema requires.
async function findOrCreateBloodUnitProduct(db: Db) {
  let product = await db.product.findFirst({ where: { productName: 'Blood Unit', isActive: true } })
  if (!product) {
    product = await db.product.create({
      data: { productName: 'Blood Unit', productType: 'STANDARD', sellingPrice: 0, unit: 'UNIT', isActive: true },
    })
  }
  return product
}

// ─── Donor registry ────────────────────────────────────────────────────────

export async function createDonor(payload: {
  fullName: string
  phone?: string
  email?: string
  dateOfBirth?: string
  gender?: string
  bloodGroup?: BloodGroup
  weightKg?: number
  address?: string
  notes?: string
}, userId?: string) {
  const db = getPrisma()
  try {
    if (!payload.fullName?.trim()) return { success: false, error: { code: 'BB-001', message: 'Donor name is required.' } }
    const donor = await db.$transaction(async (tx) => {
      const donorCode = await nextNumber(tx, 'donor', 'donorCode', 'DNR')
      return tx.donor.create({
        data: {
          donorCode,
          fullName: payload.fullName.trim(),
          phone: payload.phone,
          email: payload.email,
          dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
          gender: payload.gender,
          bloodGroup: payload.bloodGroup,
          weightKg: payload.weightKg,
          address: payload.address,
          notes: payload.notes,
        },
      })
    })
    await logAction(userId, 'DONOR_CREATED', 'Donor', donor.id, undefined, { donorCode: donor.donorCode, fullName: donor.fullName })
    return { success: true, data: donor }
  } catch (err) {
    return { success: false, error: { code: 'BB-002', message: err instanceof Error ? err.message : 'Could not register donor.' } }
  }
}

export async function listDonors(payload?: { bloodGroup?: BloodGroup; search?: string; isActive?: boolean; page?: number; limit?: number }) {
  const db = getPrisma()
  try {
    const page = payload?.page ?? 1
    const limit = payload?.limit ?? 50
    const skip = (page - 1) * limit
    const where: Record<string, unknown> = { isActive: payload?.isActive ?? true }
    if (payload?.bloodGroup) where.bloodGroup = payload.bloodGroup
    if (payload?.search) {
      where.OR = [{ fullName: { contains: payload.search } }, { donorCode: { contains: payload.search } }, { phone: { contains: payload.search } }]
    }
    const [donors, total] = await Promise.all([
      db.donor.findMany({ where, skip, take: limit, orderBy: { fullName: 'asc' } }),
      db.donor.count({ where }),
    ])
    const enriched = donors.map((d) => ({ ...d, nextEligibleDate: computeNextEligibleDate(d.lastDonationDate, d.lastDonationComponentType, d.gender) }))
    return { success: true, data: { donors: enriched, total } }
  } catch (err) {
    return { success: false, error: { code: 'BB-003', message: err instanceof Error ? err.message : 'Could not list donors.' } }
  }
}

export async function getDonor(id: string) {
  const db = getPrisma()
  try {
    const donor = await db.donor.findUnique({ where: { id }, include: { donations: { orderBy: { collectionDate: 'desc' } } } })
    if (!donor) return { success: false, error: { code: 'BB-004', message: 'Donor not found.' } }
    return { success: true, data: { ...donor, nextEligibleDate: computeNextEligibleDate(donor.lastDonationDate, donor.lastDonationComponentType, donor.gender) } }
  } catch (err) {
    return { success: false, error: { code: 'BB-005', message: err instanceof Error ? err.message : 'Could not load donor.' } }
  }
}

export async function updateDonor(payload: {
  id: string
  fullName?: string
  phone?: string | null
  email?: string | null
  bloodGroup?: BloodGroup | null
  weightKg?: number | null
  address?: string | null
  isDeferred?: boolean
  deferralReason?: string | null
  deferredUntil?: string | null
  notes?: string | null
}, userId?: string) {
  const db = getPrisma()
  try {
    const existing = await db.donor.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'BB-004', message: 'Donor not found.' } }
    const updated = await db.donor.update({
      where: { id: payload.id },
      data: {
        fullName: payload.fullName?.trim(),
        phone: payload.phone,
        email: payload.email,
        bloodGroup: payload.bloodGroup,
        weightKg: payload.weightKg,
        address: payload.address,
        isDeferred: payload.isDeferred,
        deferralReason: payload.deferralReason,
        deferredUntil: payload.deferredUntil ? new Date(payload.deferredUntil) : payload.deferredUntil,
        notes: payload.notes,
      },
    })
    await logAction(userId, 'DONOR_UPDATED', 'Donor', updated.id)
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'BB-006', message: err instanceof Error ? err.message : 'Could not update donor.' } }
  }
}

export async function deactivateDonor(id: string, userId?: string) {
  const db = getPrisma()
  try {
    const donor = await db.donor.findUnique({ where: { id } })
    if (!donor) return { success: false, error: { code: 'BB-004', message: 'Donor not found.' } }
    await db.donor.update({ where: { id }, data: { isActive: false } })
    await logAction(userId, 'DONOR_DEACTIVATED', 'Donor', id)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'BB-007', message: err instanceof Error ? err.message : 'Could not deactivate donor.' } }
  }
}

// Recall/reminder scheduling — reuses the existing generic WhatsApp reminder
// pipeline (already used for appointment reminders) rather than building a
// parallel notification system. NotificationQueue.customerId has no real FK
// constraint, so storing the donor's id there is a safe, low-friction reuse.
export async function sendDonorRecall(donorId: string) {
  const db = getPrisma()
  try {
    const donor = await db.donor.findUnique({ where: { id: donorId } })
    if (!donor) return { success: false, error: { code: 'BB-004', message: 'Donor not found.' } }
    if (!donor.phone) return { success: false, error: { code: 'BB-008', message: 'This donor has no phone number on file.' } }
    const message = `Dear ${donor.fullName}, you are now eligible to donate blood again — your last donation has recovered. Please consider donating soon to help save lives. Thank you! Powered by Sarang | www.aszurex.com`
    const res = await generateWhatsAppLink({ phone: donor.phone, message, notificationType: 'CUSTOM', customerId: donor.id, customerName: donor.fullName })
    return res
  } catch (err) {
    return { success: false, error: { code: 'BB-009', message: err instanceof Error ? err.message : 'Could not send recall reminder.' } }
  }
}

// ─── Donation camps ─────────────────────────────────────────────────────────

export async function createDonationCamp(payload: { campName: string; location?: string; campDate: string; organizer?: string; notes?: string }, userId?: string) {
  const db = getPrisma()
  try {
    if (!payload.campName?.trim()) return { success: false, error: { code: 'BB-010', message: 'Camp name is required.' } }
    const camp = await db.donationCamp.create({
      data: { campName: payload.campName.trim(), location: payload.location, campDate: new Date(payload.campDate), organizer: payload.organizer, notes: payload.notes },
    })
    await logAction(userId, 'DONATION_CAMP_CREATED', 'DonationCamp', camp.id)
    return { success: true, data: camp }
  } catch (err) {
    return { success: false, error: { code: 'BB-011', message: err instanceof Error ? err.message : 'Could not create donation camp.' } }
  }
}

export async function listDonationCamps() {
  const db = getPrisma()
  try {
    const camps = await db.donationCamp.findMany({ orderBy: { campDate: 'desc' }, include: { _count: { select: { donations: true } } } })
    return { success: true, data: camps }
  } catch (err) {
    return { success: false, error: { code: 'BB-012', message: err instanceof Error ? err.message : 'Could not list donation camps.' } }
  }
}

// ─── Donation recording ─────────────────────────────────────────────────────

export async function createDonationRecord(payload: {
  donorId: string
  campId?: string
  bloodGroup: BloodGroup
  componentType?: ComponentType
  volumeMl?: number
  notes?: string
}, userId?: string) {
  const db = getPrisma()
  try {
    const donor = await db.donor.findUnique({ where: { id: payload.donorId } })
    if (!donor) return { success: false, error: { code: 'BB-004', message: 'Donor not found.' } }
    // A missing deferredUntil means an indefinite/permanent deferral (e.g. a
    // confirmed infectious-marker-reactive donor) — only a deferral with a
    // real end date that has already passed should ever let a donation
    // through. The previous version of this check treated a null
    // deferredUntil as "not blocking," which defeated permanent deferral
    // entirely (found by independent review).
    if (donor.isDeferred && (!donor.deferredUntil || donor.deferredUntil > new Date())) {
      const until = donor.deferredUntil ? `until ${donor.deferredUntil.toISOString().slice(0, 10)}` : 'indefinitely'
      return { success: false, error: { code: 'BB-013', message: `This donor is deferred ${until}${donor.deferralReason ? `: ${donor.deferralReason}` : '.'}` } }
    }

    const record = await db.$transaction(async (tx) => {
      const donationNumber = await nextNumber(tx, 'donationRecord', 'donationNumber', 'DON')
      return tx.donationRecord.create({
        data: {
          donationNumber,
          donorId: payload.donorId,
          campId: payload.campId,
          bloodGroup: payload.bloodGroup,
          componentType: payload.componentType ?? 'WHOLE_BLOOD',
          volumeMl: payload.volumeMl ?? 450,
          notes: payload.notes,
          createdBy: userId ?? 'system',
        },
      })
    })
    await logAction(userId, 'DONATION_RECORDED', 'DonationRecord', record.id, undefined, { donationNumber: record.donationNumber })
    return { success: true, data: record }
  } catch (err) {
    return { success: false, error: { code: 'BB-014', message: err instanceof Error ? err.message : 'Could not record donation.' } }
  }
}

export async function listDonationRecords(payload?: { screeningStatus?: ScreeningStatus; donorId?: string; page?: number; limit?: number }) {
  const db = getPrisma()
  try {
    const page = payload?.page ?? 1
    const limit = payload?.limit ?? 50
    const skip = (page - 1) * limit
    const where: Record<string, unknown> = {}
    if (payload?.screeningStatus) where.screeningStatus = payload.screeningStatus
    if (payload?.donorId) where.donorId = payload.donorId
    const [records, total] = await Promise.all([
      db.donationRecord.findMany({
        where, skip, take: limit, orderBy: { collectionDate: 'desc' },
        include: { donor: { select: { fullName: true, donorCode: true } }, camp: { select: { campName: true } }, productBatch: true },
      }),
      db.donationRecord.count({ where }),
    ])
    return { success: true, data: { records, total } }
  } catch (err) {
    return { success: false, error: { code: 'BB-015', message: err instanceof Error ? err.message : 'Could not list donations.' } }
  }
}

// Screening determines whether a donated unit ever becomes usable stock — a
// PASSED result atomically creates the ProductBatch (the unit only enters the
// stock ledger once safe), and updates the donor's lastDonationDate so their
// next-eligible-date calculation reflects it. A FAILED result never touches
// inventory at all.
export async function updateScreeningStatus(payload: { id: string; screeningStatus: ScreeningStatus; screeningNotes?: string }, userId?: string) {
  const db = getPrisma()
  try {
    const record = await db.donationRecord.findUnique({ where: { id: payload.id }, include: { donor: true } })
    if (!record) return { success: false, error: { code: 'BB-016', message: 'Donation record not found.' } }
    if (record.screeningStatus !== 'PENDING') {
      return { success: false, error: { code: 'BB-017', message: `Screening has already been recorded as ${record.screeningStatus.toLowerCase()}.` } }
    }

    if (payload.screeningStatus === 'PASSED') {
      const expiryDate = new Date(record.collectionDate.getTime() + SHELF_LIFE_DAYS[record.componentType as ComponentType] * 86400000)
      const updated = await db.$transaction(async (tx) => {
        const product = await findOrCreateBloodUnitProduct(tx as unknown as Db)
        const batch = await tx.productBatch.create({
          data: {
            productId: product.id,
            batchNumber: record.donationNumber,
            expiryDate,
            mfgDate: record.collectionDate,
            quantityReceived: 1,
            quantityRemaining: 1,
            unitCost: 0,
          },
        })
        await tx.donor.update({ where: { id: record.donorId }, data: { lastDonationDate: record.collectionDate, lastDonationComponentType: record.componentType } })
        return tx.donationRecord.update({
          where: { id: payload.id },
          data: { screeningStatus: 'PASSED', screeningNotes: payload.screeningNotes, productBatchId: batch.id },
          include: { productBatch: true },
        })
      })
      await logAction(userId, 'DONATION_SCREENING_PASSED', 'DonationRecord', payload.id)
      return { success: true, data: updated }
    }

    const updated = await db.donationRecord.update({
      where: { id: payload.id },
      data: { screeningStatus: 'FAILED', screeningNotes: payload.screeningNotes },
    })
    await logAction(userId, 'DONATION_SCREENING_FAILED', 'DonationRecord', payload.id)
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'BB-018', message: err instanceof Error ? err.message : 'Could not record screening result.' } }
  }
}

// ─── Blood stock ─────────────────────────────────────────────────────────────

export async function getBloodStock() {
  const db = getPrisma()
  try {
    const records = await db.donationRecord.findMany({
      where: { screeningStatus: 'PASSED', isIssued: false, productBatch: { quantityRemaining: { gt: 0 } } },
      include: { productBatch: true },
      orderBy: { productBatch: { expiryDate: 'asc' } },
    })
    const now = new Date()
    const units = records
      .filter((r) => r.productBatch)
      .map((r) => {
        const componentType = r.componentType as ComponentType
        const expiryDate = r.productBatch!.expiryDate
        const daysToExpiry = daysUntil(expiryDate)
        return {
          donationRecordId: r.id,
          donationNumber: r.donationNumber,
          bloodGroup: r.bloodGroup,
          componentType,
          collectionDate: r.collectionDate.toISOString(),
          expiryDate: expiryDate.toISOString(),
          daysToExpiry,
          isExpired: expiryDate < now,
          isExpiringSoon: daysToExpiry >= 0 && daysToExpiry <= EXPIRY_ALERT_DAYS[componentType],
        }
      })

    const summary: Record<string, { available: number; expiringSoon: number }> = {}
    for (const u of units) {
      const key = `${u.bloodGroup}_${u.componentType}`
      if (!summary[key]) summary[key] = { available: 0, expiringSoon: 0 }
      if (!u.isExpired) summary[key].available += 1
      if (u.isExpiringSoon) summary[key].expiringSoon += 1
    }

    return { success: true, data: { units, summary } }
  } catch (err) {
    return { success: false, error: { code: 'BB-019', message: err instanceof Error ? err.message : 'Could not load blood stock.' } }
  }
}

// ─── Issue ───────────────────────────────────────────────────────────────────

export async function createBloodIssue(payload: {
  customerId?: string
  recipientName: string
  recipientBloodGroup?: BloodGroup
  purpose?: string
  donationRecordIds: string[]
  price?: number
  // Phase 58 §2 — the compatibility check now BLOCKS issuance by default
  // (previously advisory-only, `compatibilityNote` was recorded but nothing
  // ever stopped an incompatible unit from being issued). An explicit,
  // documented override is required for the rare legitimate emergency-
  // release case — never a silent bypass.
  overrideIncompatibility?: boolean
  overrideReason?: string
}, userId?: string) {
  const db = getPrisma()
  try {
    if (!payload.recipientName?.trim()) return { success: false, error: { code: 'BB-020', message: 'Recipient name is required.' } }
    if (!payload.donationRecordIds || payload.donationRecordIds.length === 0) {
      return { success: false, error: { code: 'BB-021', message: 'Select at least one blood unit to issue.' } }
    }

    const issue = await db.$transaction(async (tx) => {
      const donationRecords = await tx.donationRecord.findMany({
        where: { id: { in: payload.donationRecordIds } },
        include: { productBatch: true },
      })
      if (donationRecords.length !== payload.donationRecordIds.length) {
        throw { code: 'BB-021B', message: 'One or more selected units could not be found.' }
      }
      for (const r of donationRecords) {
        if (r.screeningStatus !== 'PASSED' || r.isIssued || !r.productBatch || r.productBatch.quantityRemaining <= 0) {
          throw { code: 'BB-021C', message: `Unit ${r.donationNumber} is not available to issue.` }
        }
      }

      const compatResults = payload.recipientBloodGroup
        ? donationRecords.map((r) => ({
            r,
            compat: checkCompatibility(payload.recipientBloodGroup!, r.bloodGroup as BloodGroup, r.componentType as ComponentType),
          }))
        : donationRecords.map((r) => ({ r, compat: null }))

      const incompatible = compatResults.filter((x) => x.compat && !x.compat.compatible)
      if (incompatible.length > 0 && !payload.overrideIncompatibility) {
        throw {
          code: 'BB-023',
          message: `Blocked: ${incompatible.length} incompatible unit(s) selected (${incompatible.map((x) => x.r.donationNumber).join(', ')}). This can only proceed with a documented emergency-release override.`,
        }
      }
      if (incompatible.length > 0 && !payload.overrideReason?.trim()) {
        throw { code: 'BB-024', message: 'A documented reason is required to override an incompatibility block.' }
      }

      const issueNumber = await nextNumber(tx, 'bloodIssue', 'issueNumber', 'BLD')
      const price = payload.price ?? 0
      const created = await tx.bloodIssue.create({
        data: {
          issueNumber,
          customerId: payload.customerId,
          recipientName: payload.recipientName.trim(),
          purpose: payload.purpose,
          totalAmount: roundCurrency(price * donationRecords.length),
          issuedById: userId,
          createdBy: userId ?? 'system',
          items: {
            create: compatResults.map(({ r, compat }) => {
              const overridden = compat && !compat.compatible
              return {
                donationRecordId: r.id,
                bloodGroup: r.bloodGroup,
                componentType: r.componentType,
                price,
                compatibilityNote: overridden ? `${compat!.note} Issued on emergency-release override.` : compat?.note,
                overrideReason: overridden ? payload.overrideReason!.trim() : null,
              }
            }),
          },
        },
        include: { items: true },
      })

      for (const r of donationRecords) {
        await tx.donationRecord.update({ where: { id: r.id }, data: { isIssued: true } })
        await tx.productBatch.update({ where: { id: r.productBatchId! }, data: { quantityRemaining: { decrement: 1 } } })
      }

      return created
    })

    await logAction(userId, 'BLOOD_ISSUE_CREATED', 'BloodIssue', issue.id, undefined, { issueNumber: issue.issueNumber })
    if (issue.items.some((i) => i.overrideReason)) {
      await logAction(userId, 'BLOOD_ISSUE_INCOMPATIBLE_OVERRIDE', 'BloodIssue', issue.id, undefined, { issueNumber: issue.issueNumber, overrideReason: payload.overrideReason })
    }
    return { success: true, data: issue }
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
      return { success: false, error: err as { code: string; message: string } }
    }
    return { success: false, error: { code: 'BB-022', message: err instanceof Error ? err.message : 'Could not issue blood units.' } }
  }
}

export async function listBloodIssues(payload?: { status?: string; page?: number; limit?: number }) {
  const db = getPrisma()
  try {
    const page = payload?.page ?? 1
    const limit = payload?.limit ?? 50
    const skip = (page - 1) * limit
    const where: Record<string, unknown> = {}
    if (payload?.status) where.status = payload.status
    const [issues, total] = await Promise.all([
      db.bloodIssue.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { items: true, customer: { select: { customerName: true } } } }),
      db.bloodIssue.count({ where }),
    ])
    return { success: true, data: { issues, total } }
  } catch (err) {
    return { success: false, error: { code: 'BB-023', message: err instanceof Error ? err.message : 'Could not list blood issues.' } }
  }
}

export async function getBloodIssue(id: string) {
  const db = getPrisma()
  try {
    const issue = await db.bloodIssue.findUnique({
      where: { id },
      include: { items: true, customer: true, issuedBy: { select: { fullName: true } } },
    })
    if (!issue) return { success: false, error: { code: 'BB-024', message: 'Blood issue not found.' } }
    return { success: true, data: issue }
  } catch (err) {
    return { success: false, error: { code: 'BB-025', message: err instanceof Error ? err.message : 'Could not load blood issue.' } }
  }
}

// Cancelling restores every consumed unit back to stock — the reverse of
// createBloodIssue's decrement, same atomic-reversal principle this project
// already applies elsewhere (e.g. credit-note.service.ts's ledger reversals).
export async function cancelBloodIssue(id: string, userId?: string) {
  const db = getPrisma()
  try {
    const issue = await db.bloodIssue.findUnique({ where: { id }, include: { items: true } })
    if (!issue) return { success: false, error: { code: 'BB-024', message: 'Blood issue not found.' } }
    if (issue.status === 'CANCELLED') return { success: false, error: { code: 'BB-026', message: 'This issue is already cancelled.' } }
    if (issue.invoiceId) return { success: false, error: { code: 'BB-027', message: 'This issue has already been invoiced — void or credit the invoice first.' } }

    await db.$transaction(async (tx) => {
      for (const item of issue.items) {
        const record = await tx.donationRecord.findUnique({ where: { id: item.donationRecordId } })
        if (record?.productBatchId) {
          await tx.productBatch.update({ where: { id: record.productBatchId }, data: { quantityRemaining: { increment: 1 } } })
        }
        await tx.donationRecord.update({ where: { id: item.donationRecordId }, data: { isIssued: false } })
      }
      await tx.bloodIssue.update({ where: { id }, data: { status: 'CANCELLED' } })
    })
    await logAction(userId, 'BLOOD_ISSUE_CANCELLED', 'BloodIssue', id)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'BB-028', message: err instanceof Error ? err.message : 'Could not cancel blood issue.' } }
  }
}

const BLOOD_CLAIM_SENTINEL = 'PENDING_INVOICE_GENERATION'

async function findOrCreateBloodIssueProduct(db: Db) {
  let product = await db.product.findFirst({ where: { productName: 'Blood Unit Issued', isActive: true } })
  if (!product) {
    product = await db.product.create({
      data: { productName: 'Blood Unit Issued', productType: 'SERVICE', sellingPrice: 0, taxRate: 0, unit: 'UNIT', isActive: true },
    })
  }
  return product
}

// Same atomic-claim-sentinel pattern as appointment.service.ts/lab-test-order.service.ts.
export async function generateBloodIssueInvoice(id: string) {
  const db = getPrisma()
  try {
    const claim = await db.bloodIssue.updateMany({ where: { id, invoiceId: null }, data: { invoiceId: BLOOD_CLAIM_SENTINEL } })
    if (claim.count === 0) {
      const existing = await db.bloodIssue.findUnique({ where: { id }, select: { id: true } })
      if (!existing) return { success: false, error: { code: 'BB-024', message: 'Blood issue not found.' } }
      return { success: false, error: { code: 'BB-029', message: 'Invoice already generated for this issue.' } }
    }

    try {
      const issue = await db.bloodIssue.findUnique({ where: { id }, include: { items: true } })
      if (!issue) {
        await db.bloodIssue.update({ where: { id }, data: { invoiceId: null } })
        return { success: false, error: { code: 'BB-024', message: 'Blood issue not found.' } }
      }
      if (issue.status === 'CANCELLED') {
        await db.bloodIssue.update({ where: { id }, data: { invoiceId: null } })
        return { success: false, error: { code: 'BB-030', message: 'Cannot invoice a cancelled issue.' } }
      }
      if (!issue.customerId) {
        await db.bloodIssue.update({ where: { id }, data: { invoiceId: null } })
        return { success: false, error: { code: 'BB-031', message: 'Link this issue to a customer record before generating an invoice.' } }
      }
      if (issue.items.some((i) => i.price <= 0)) {
        await db.bloodIssue.update({ where: { id }, data: { invoiceId: null } })
        return { success: false, error: { code: 'BB-032', message: 'Set a price greater than zero for every unit before generating an invoice.' } }
      }

      const product = await findOrCreateBloodIssueProduct(db)
      const items = issue.items.map((item) => ({ productId: product.id, quantity: 1, unitPrice: item.price, taxRate: 0 }))

      const result = await billingService.createInvoice({
        customerId: issue.customerId,
        paymentMethod: 'CREDIT',
        gstType: 'CGST_SGST',
        items,
        notes: `Blood Issue ${issue.issueNumber} — ${issue.recipientName}`,
        referenceNumber: id.slice(0, 12),
      })
      if (!result.success) {
        await db.bloodIssue.update({ where: { id }, data: { invoiceId: null } })
        return result
      }

      const invoice = result.data as { id: string }
      await db.bloodIssue.update({ where: { id }, data: { invoiceId: invoice.id } })
      await logAction(undefined, 'BLOOD_ISSUE_INVOICED', 'BloodIssue', id, undefined, { invoiceId: invoice.id })
      return { success: true, data: { invoiceId: invoice.id } }
    } catch (err) {
      await db.bloodIssue.update({ where: { id }, data: { invoiceId: null } }).catch(() => {})
      throw err
    }
  } catch (err) {
    return { success: false, error: { code: 'BB-033', message: err instanceof Error ? err.message : 'Could not generate invoice.' } }
  }
}
