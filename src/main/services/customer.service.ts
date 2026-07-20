import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { getCurrentSession } from './auth.service'
import { generateSequenceNumber } from './sequence.service'
import type { ApiResponse } from '../ipc/channels'
import type { CreateCustomerPayload, UpdateCustomerPayload } from '../validation/customer.validation'

export async function listCustomers(filters?: { page?: number; limit?: number; search?: string }): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const page = filters?.page ?? 1
    const limit = filters?.limit ?? 50
    const skip = (page - 1) * limit
    const search = filters?.search?.trim()

    const where = {
      isActive: true,
      ...(search ? {
        OR: [
          { customerName: { contains: search } },
          { phone: { contains: search } },
          { email: { contains: search } },
          { customerCode: { contains: search } }
        ]
      } : {})
    }

    const [customers, total] = await Promise.all([
      db.customer.findMany({ where, orderBy: { customerName: 'asc' }, skip, take: limit }),
      db.customer.count({ where })
    ])

    return { success: true, data: { customers, total, page, limit, pages: Math.ceil(total / limit) } }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

// Distributor "Outstanding Analytics" needs every customer with a balance,
// not a page of them — the screen was previously calling listCustomers()
// with no arguments, which silently defaulted to the first 50 customers
// (alphabetically). Any distributor with more than 50 customers got a
// dangerously incomplete picture of their true credit exposure — the whole
// point of the feature is a complete total, not an arbitrary alphabetical
// slice. This does the filtering in the DB (outstandingBalance > 0) rather
// than fetching everyone and filtering client-side.
export async function listOutstandingCustomers(): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const customers = await db.customer.findMany({
      where: { isActive: true, outstandingBalance: { gt: 0 } },
      orderBy: { outstandingBalance: 'desc' },
      select: {
        id: true, customerName: true, customerCode: true, phone: true,
        outstandingBalance: true, creditLimit: true
      }
    })
    return { success: true, data: customers }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function searchCustomers(query: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const customers = await db.customer.findMany({
      where: {
        isActive: true,
        OR: [
          { customerName: { contains: query } },
          { phone: { contains: query } },
          { customerCode: { contains: query } }
        ]
      },
      take: 20,
      orderBy: { customerName: 'asc' }
    })
    return { success: true, data: customers }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function getCustomer(id: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const customer = await db.customer.findUnique({ where: { id } })
    if (!customer) return { success: false, error: { code: 'CUS-001', message: 'Customer not found.' } }
    return { success: true, data: customer }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function getCustomerLedger(customerId: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const customer = await db.customer.findUnique({ where: { id: customerId } })
    if (!customer) return { success: false, error: { code: 'CUS-001', message: 'Customer not found.' } }

    const ledger = await db.customerLedger.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 100
    })

    // C003: Outstanding = sum of all debit - sum of all credit
    const outstanding = ledger.reduce((acc, e) => acc + e.debitAmount - e.creditAmount, 0)

    return { success: true, data: { customer, ledger, outstanding } }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function createCustomer(payload: CreateCustomerPayload): Promise<ApiResponse> {
  try {
    const db = getPrisma()

    // C001: Phone unique when provided
    if (payload.phone) {
      const phoneExists = await db.customer.findFirst({ where: { phone: payload.phone, isActive: true } })
      if (phoneExists) {
        return { success: false, error: { code: 'CUS-002', message: 'A customer with this phone number already exists.' } }
      }
    }

    // Auto-generate customer code. Must go through the same atomic
    // Setting-backed sequence generateSequenceNumber already uses for
    // quotation/credit-note/debit-note/rental numbers — a plain
    // count()+1 collides with an existing customerCode as soon as any
    // customer is ever hard-deleted (count drops but the highest code
    // already issued didn't), and also races under concurrent creates the
    // same way sequence.service.ts's own header comment describes.
    const customer = await db.$transaction(async (tx) => {
      const customerCode = await generateSequenceNumber(
        tx, 'customer_code_sequence', 'CUS', 5,
        async () => {
          const rows = await tx.customer.findMany({ select: { customerCode: true } })
          let max = 0
          for (const row of rows) {
            const n = parseInt((row.customerCode ?? '').replace('CUS-', ''), 10)
            if (Number.isFinite(n) && n > max) max = n
          }
          return max
        }
      )

      return tx.customer.create({
        data: {
          customerCode,
          customerName: payload.customerName,
          phone: payload.phone || null,
          email: payload.email || null,
          address: payload.address,
          city: payload.city,
          state: payload.state,
          country: payload.country,
          taxNumber: payload.taxNumber,
          taxExempt: payload.taxExempt ?? false,
          taxExemptReason: payload.taxExempt ? (payload.taxExemptReason || null) : null,
          creditLimit: payload.creditLimit ?? 0,
          customerClass: payload.customerClass?.trim() || null,
          notes: payload.notes
        }
      })
    })

    await logAction({ userId: getCurrentSession()?.userId, action: 'CUSTOMER_CREATED', entityType: 'Customer', entityId: customer.id, newValue: { customerName: payload.customerName } })
    return { success: true, data: customer }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function updateCustomer(payload: UpdateCustomerPayload): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const existing = await db.customer.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'CUS-001', message: 'Customer not found.' } }

    // C001: Phone unique (exclude self)
    if (payload.phone && payload.phone !== existing.phone) {
      const phoneExists = await db.customer.findFirst({ where: { phone: payload.phone, isActive: true, id: { not: payload.id } } })
      if (phoneExists) return { success: false, error: { code: 'CUS-002', message: 'A customer with this phone number already exists.' } }
    }

    const updated = await db.customer.update({
      where: { id: payload.id },
      data: {
        customerName: payload.customerName,
        phone: payload.phone || null,
        email: payload.email || null,
        address: payload.address,
        city: payload.city,
        state: payload.state,
        country: payload.country,
        taxNumber: payload.taxNumber,
        taxExempt: payload.taxExempt ?? false,
        taxExemptReason: payload.taxExempt ? (payload.taxExemptReason || null) : null,
        creditLimit: payload.creditLimit ?? existing.creditLimit,
        customerClass: payload.customerClass?.trim() || null,
        notes: payload.notes
      }
    })

    await logAction({ userId: getCurrentSession()?.userId, action: 'CUSTOMER_UPDATED', entityType: 'Customer', entityId: payload.id })
    return { success: true, data: updated }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function archiveCustomer(id: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    // C005: Cannot archive if has outstanding balance
    const customer = await db.customer.findUnique({ where: { id } })
    if (!customer) return { success: false, error: { code: 'CUS-001', message: 'Customer not found.' } }

    const hasActiveInvoices = await db.invoice.count({ where: { customerId: id, paymentStatus: { in: ['UNPAID', 'PARTIAL'] } } })
    if (hasActiveInvoices > 0) {
      return { success: false, error: { code: 'CUS-003', message: 'Cannot archive: customer has unpaid invoices.' } }
    }

    await db.customer.update({ where: { id }, data: { isActive: false } })
    await logAction({ userId: getCurrentSession()?.userId, action: 'CUSTOMER_ARCHIVED', entityType: 'Customer', entityId: id })
    return { success: true }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}
