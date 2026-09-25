import { getPrisma } from '../database/db'
import type { ApiResponse } from '../ipc/channels'

// Duplicate and format checks shared by createSupplier / updateSupplier.
// One real-world supplier must be exactly one record, otherwise its ledger,
// bills and payments split across two rows and "what do I owe X?" is wrong.

export interface SupplierCheckInput {
  supplierName?: string | null
  phone?: string | null
  email?: string | null
  taxNumber?: string | null
  panNumber?: string | null
  bankIfscCode?: string | null
  city?: string | null
  country?: string | null
}

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/

const norm = (v?: string | null): string => (v ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
const fail = (code: string, message: string): ApiResponse => ({ success: false, error: { code, message } })

/** Uppercases and trims identifier fields (GSTIN, PAN, IFSC) so they compare and print consistently. */
export function normaliseSupplierIdentifiers<T extends SupplierCheckInput>(payload: T): T {
  if (typeof payload.taxNumber === 'string') payload.taxNumber = payload.taxNumber.trim().toUpperCase()
  if (typeof payload.panNumber === 'string') payload.panNumber = payload.panNumber.trim().toUpperCase()
  if (typeof payload.bankIfscCode === 'string') payload.bankIfscCode = payload.bankIfscCode.trim().toUpperCase()
  return payload
}

/** Format checks for India-style identifiers. Skipped when the business does not use GST or the supplier is outside India. */
export async function validateSupplierFormats(input: SupplierCheckInput): Promise<ApiResponse | null> {
  const db = getPrisma()
  const profile = await db.businessProfile.findFirst({ select: { taxModel: true, country: true } })
  const country = norm(input.country) || norm(profile?.country)
  const indian = country === '' || country === 'india' || country === 'in'

  if (indian && profile?.taxModel === 'GST' && input.taxNumber && !GSTIN_RE.test(input.taxNumber.trim().toUpperCase())) {
    return fail('SUP-009', 'GSTIN must be 15 characters, like 29ABCDE1234F1Z5. Please check it.')
  }
  if (indian && input.panNumber && !PAN_RE.test(input.panNumber.trim().toUpperCase())) {
    return fail('SUP-010', 'PAN must be 10 characters, like ABCDE1234F. Please check it.')
  }
  if (indian && input.bankIfscCode && !IFSC_RE.test(input.bankIfscCode.trim().toUpperCase())) {
    return fail('SUP-011', 'IFSC must be 11 characters, like HDFC0001234. Please check it.')
  }
  return null
}

/** Rejects a supplier that would duplicate an existing one (active or archived). `excludeId` skips the record being edited. */
export async function checkSupplierUniqueness(input: SupplierCheckInput, excludeId?: string): Promise<ApiResponse | null> {
  const db = getPrisma()
  const all = await db.supplier.findMany({
    select: { id: true, supplierCode: true, supplierName: true, phone: true, email: true, taxNumber: true, city: true, isActive: true }
  })
  const others = all.filter((s) => s.id !== excludeId)
  const label = (s: (typeof all)[number]) => `${s.supplierCode ?? ''} ${s.supplierName}`.trim()
  const archivedHint = (s: (typeof all)[number]) => (s.isActive ? '' : ' It is archived; restore that supplier instead of adding a new one.')

  if (input.phone) {
    const hit = others.find((s) => s.phone && s.phone === input.phone)
    if (hit) return fail('SUP-002', hit.isActive
      ? 'A supplier with this phone number already exists.'
      : `An archived supplier (${label(hit)}) already uses this phone number. Restore that supplier instead of adding a new one.`)
  }
  if (input.taxNumber) {
    const t = norm(input.taxNumber)
    const hit = others.find((s) => s.taxNumber && norm(s.taxNumber) === t)
    if (hit) return fail('SUP-006', `Supplier ${label(hit)} already has this GSTIN / tax number.${archivedHint(hit)}`)
  }
  if (input.email) {
    const e = norm(input.email)
    const hit = others.find((s) => s.email && norm(s.email) === e)
    if (hit) return fail('SUP-007', `Supplier ${label(hit)} already uses this email address.${archivedHint(hit)}`)
  }
  if (input.supplierName) {
    const n = norm(input.supplierName)
    const c = norm(input.city)
    const hit = others.find((s) => norm(s.supplierName) === n && (c === '' || norm(s.city) === '' || norm(s.city) === c))
    if (hit) return fail('SUP-008', `A supplier named "${hit.supplierName}" already exists (${hit.supplierCode ?? 'no code'}). Open that supplier, or enter a different city to tell them apart.${archivedHint(hit)}`)
  }
  return null
}
