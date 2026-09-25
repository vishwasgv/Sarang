import { getPrisma } from '../database/db'
import type { ApiResponse } from '../ipc/channels'

// Checks shared by createCustomer / updateCustomer, and the duplicate finder behind the merge tool. One real
// customer should be one record, otherwise their ledger and history split across rows.

export interface CustomerCheckInput {
  phone?: string | null
  email?: string | null
  taxNumber?: string | null
  country?: string | null
}

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

const norm = (v?: string | null): string => (v ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
const digits = (v?: string | null): string => (v ?? '').replace(/\D+/g, '')
const fail = (code: string, message: string): ApiResponse => ({ success: false, error: { code, message } })

/** A phone compared the way people write it: digits only, so "98765 43210" equals "9876543210". */
export function phoneKey(v?: string | null): string {
  const d = digits(v)
  return d.length > 10 ? d.slice(-10) : d
}

/** Upper-cases and trims the tax number so it compares and prints consistently. */
export function normaliseCustomerIdentifiers<T extends CustomerCheckInput>(payload: T): T {
  if (typeof payload.taxNumber === 'string') payload.taxNumber = payload.taxNumber.trim().toUpperCase()
  return payload
}

/** GSTIN format, only for an Indian GST business dealing with an Indian customer. */
export async function validateCustomerFormats(input: CustomerCheckInput): Promise<ApiResponse | null> {
  if (!input.taxNumber) return null
  const profile = await getPrisma().businessProfile.findFirst({ select: { taxModel: true, country: true } })
  const country = norm(input.country) || norm(profile?.country)
  const indian = country === '' || country === 'india' || country === 'in'
  if (indian && profile?.taxModel === 'GST' && !GSTIN_RE.test(input.taxNumber.trim().toUpperCase())) {
    return fail('CUS-009', 'GSTIN must be 15 characters, like 29ABCDE1234F1Z5. Please check it.')
  }
  return null
}

/** Rejects a customer whose GSTIN or email is already used by another (active or archived). Phone stays in the service. */
export async function checkCustomerUniqueness(input: CustomerCheckInput, excludeId?: string): Promise<ApiResponse | null> {
  const db = getPrisma()
  if (!input.taxNumber && !input.email) return null
  const all = await db.customer.findMany({ select: { id: true, customerCode: true, customerName: true, email: true, taxNumber: true, isActive: true } })
  const others = all.filter((c) => c.id !== excludeId)
  const label = (c: (typeof all)[number]) => `${c.customerCode ?? ''} ${c.customerName}`.trim()
  const archivedHint = (c: (typeof all)[number]) => (c.isActive ? '' : ' It is archived; restore that customer instead of adding a new one.')
  if (input.taxNumber) {
    const t = norm(input.taxNumber)
    const hit = others.find((c) => c.taxNumber && norm(c.taxNumber) === t)
    if (hit) return fail('CUS-006', `Customer ${label(hit)} already has this GSTIN / tax number.${archivedHint(hit)}`)
  }
  if (input.email) {
    const e = norm(input.email)
    const hit = others.find((c) => c.email && norm(c.email) === e)
    if (hit) return fail('CUS-007', `Customer ${label(hit)} already uses this email address.${archivedHint(hit)}`)
  }
  return null
}

export interface DuplicateParty {
  id: string; code: string | null; name: string; phone: string | null; email: string | null; taxNumber: string | null; city: string | null; balance: number
}

export interface DuplicateGroup {
  reason: 'PHONE' | 'TAX_NUMBER' | 'EMAIL' | 'NAME'
  key: string
  parties: DuplicateParty[]
}

/** Groups of records that look like the same party: same phone, tax number or email, or the same name in the same city. */
export function groupDuplicates(all: DuplicateParty[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = []
  const seen = new Set<string>()
  const add = (reason: DuplicateGroup['reason'], keyOf: (c: DuplicateParty) => string) => {
    const map = new Map<string, DuplicateParty[]>()
    for (const c of all) {
      const k = keyOf(c)
      if (k) map.set(k, [...(map.get(k) ?? []), c])
    }
    for (const [key, list] of map) {
      if (list.length < 2) continue
      const sig = list.map((c) => c.id).sort().join('|')
      if (seen.has(sig)) continue
      seen.add(sig)
      groups.push({ reason, key, parties: list })
    }
  }
  add('PHONE', (c) => phoneKey(c.phone))
  add('TAX_NUMBER', (c) => norm(c.taxNumber))
  add('EMAIL', (c) => norm(c.email))
  add('NAME', (c) => (norm(c.name) && norm(c.city) ? `${norm(c.name)}|${norm(c.city)}` : ''))
  return groups
}

export async function findCustomerDuplicateGroups(): Promise<DuplicateGroup[]> {
  const rows = await getPrisma().customer.findMany({
    where: { isActive: true },
    select: { id: true, customerCode: true, customerName: true, phone: true, email: true, taxNumber: true, city: true, outstandingBalance: true }
  })
  return groupDuplicates(rows.map((r) => ({ id: r.id, code: r.customerCode, name: r.customerName, phone: r.phone, email: r.email, taxNumber: r.taxNumber, city: r.city, balance: r.outstandingBalance })))
}

export async function findSupplierDuplicateGroups(): Promise<DuplicateGroup[]> {
  const rows = await getPrisma().supplier.findMany({
    where: { isActive: true },
    select: { id: true, supplierCode: true, supplierName: true, phone: true, email: true, taxNumber: true, city: true }
  })
  return groupDuplicates(rows.map((r) => ({ id: r.id, code: r.supplierCode, name: r.supplierName, phone: r.phone, email: r.email, taxNumber: r.taxNumber, city: r.city, balance: 0 })))
}
