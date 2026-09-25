import { phoneKey } from './customer-checks'

// Duplicate detection for the Excel/CSV import of customers and suppliers, against what is already saved and
// against the earlier rows of the same file. The same index is used by the preview and by the real import so
// both give the same answer.

export interface PartyRowData {
  customerName?: unknown
  supplierName?: unknown
  phone?: unknown
  email?: unknown
  taxNumber?: unknown
}

export interface ExistingParty {
  name?: string | null
  phone?: string | null
  email?: string | null
  taxNumber?: string | null
  /** Customers: a phone counts only while the customer is active (the rule the app already had). */
  phoneCounts?: boolean
}

const norm = (v: unknown): string => (typeof v === 'string' ? v.trim().toLowerCase().replace(/\s+/g, ' ') : '')

export class PartyDuplicateIndex {
  private phones = new Set<string>()
  private taxNumbers = new Set<string>()
  private emails = new Set<string>()
  private names = new Set<string>()

  constructor(private readonly kind: 'customers' | 'suppliers') {}

  load(existing: ExistingParty[]): void {
    for (const e of existing) this.add(e)
  }

  private add(e: ExistingParty): void {
    if (e.phone && e.phoneCounts !== false && phoneKey(e.phone)) this.phones.add(phoneKey(e.phone))
    if (e.taxNumber && norm(e.taxNumber)) this.taxNumbers.add(norm(e.taxNumber))
    if (e.email && norm(e.email)) this.emails.add(norm(e.email))
    if (this.kind === 'suppliers' && e.name && norm(e.name)) this.names.add(norm(e.name))
  }

  /** Why a row would be skipped, or null when it is new. */
  reason(data: PartyRowData): string | null {
    const phone = typeof data.phone === 'string' ? data.phone : null
    if (phone && this.phones.has(phoneKey(phone))) return `Phone "${phone}" already exists`
    const tax = typeof data.taxNumber === 'string' ? data.taxNumber : null
    if (tax && this.taxNumbers.has(norm(tax))) return `Tax number "${tax}" already exists`
    const email = typeof data.email === 'string' ? data.email : null
    if (email && this.emails.has(norm(email))) return `Email "${email}" already exists`
    if (this.kind === 'suppliers') {
      const name = typeof data.supplierName === 'string' ? data.supplierName : null
      if (name && this.names.has(norm(name))) return `Supplier "${name}" already exists`
    }
    return null
  }

  /** Records a row that will be imported so a later row of the same file is compared with it. */
  remember(data: PartyRowData): void {
    this.add({
      name: (this.kind === 'suppliers' ? data.supplierName : data.customerName) as string | null,
      phone: data.phone as string | null, email: data.email as string | null, taxNumber: data.taxNumber as string | null
    })
  }
}
