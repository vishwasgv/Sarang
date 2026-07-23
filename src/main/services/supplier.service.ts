import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { getCurrentSession } from './auth.service'
import { generateSequenceNumber } from './sequence.service'
import { supplierLedgerService } from './supplier-ledger.service'
import type { ApiResponse } from '../ipc/channels'
import type { CreateSupplierPayload, UpdateSupplierPayload } from '../validation/supplier.validation'

export async function listSuppliers(filters?: { page?: number; limit?: number; search?: string }): Promise<ApiResponse> {
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
          { supplierName: { contains: search } },
          { phone: { contains: search } },
          { email: { contains: search } },
          { supplierCode: { contains: search } }
        ]
      } : {})
    }

    const [suppliers, total] = await Promise.all([
      db.supplier.findMany({ where, orderBy: { supplierName: 'asc' }, skip, take: limit }),
      db.supplier.count({ where })
    ])

    return { success: true, data: { suppliers, total, page, limit, pages: Math.ceil(total / limit) } }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function searchSuppliers(query: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const suppliers = await db.supplier.findMany({
      where: {
        isActive: true,
        OR: [
          { supplierName: { contains: query } },
          { phone: { contains: query } },
          { supplierCode: { contains: query } }
        ]
      },
      take: 20,
      orderBy: { supplierName: 'asc' }
    })
    return { success: true, data: suppliers }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function getSupplier(id: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const supplier = await db.supplier.findUnique({ where: { id } })
    if (!supplier) return { success: false, error: { code: 'SUP-001', message: 'Supplier not found.' } }
    return { success: true, data: supplier }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function getSupplierLedger(supplierId: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const supplier = await db.supplier.findUnique({ where: { id: supplierId } })
    if (!supplier) return { success: false, error: { code: 'SUP-001', message: 'Supplier not found.' } }

    const ledger = await db.supplierLedger.findMany({
      where: { supplierId },
      orderBy: { createdAt: 'desc' },
      take: 100
    })

    // BUG FOUND 2026-07-22: same issue as customer.service.ts's
    // getCustomerLedger — this summed only the 100 most-recent rows
    // instead of the whole ledger. supplier-ledger.service.ts's own
    // calculateBalance (a true aggregate SUM) already exists and is
    // correct, it just wasn't wired to this screen.
    const outstanding = await supplierLedgerService.calculateBalance(supplierId)
    return { success: true, data: { supplier, ledger, outstanding } }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function createSupplier(payload: CreateSupplierPayload): Promise<ApiResponse> {
  try {
    const db = getPrisma()

    // S001: Phone unique when provided
    if (payload.phone) {
      const phoneExists = await db.supplier.findFirst({ where: { phone: payload.phone, isActive: true } })
      if (phoneExists) return { success: false, error: { code: 'SUP-002', message: 'A supplier with this phone number already exists.' } }
    }

    // Same fix as customer.service.ts's createCustomer: a plain count()+1
    // collides with an existing supplierCode as soon as any supplier is
    // ever hard-deleted (count drops but the highest code already issued
    // didn't) and races under concurrent creates. Atomic Setting-backed
    // sequence, matching quotation/credit-note/debit-note/rental numbering.
    const supplier = await db.$transaction(async (tx) => {
      const supplierCode = await generateSequenceNumber(
        tx, 'supplier_code_sequence', 'SUP', 5,
        async () => {
          const rows = await tx.supplier.findMany({ select: { supplierCode: true } })
          let max = 0
          for (const row of rows) {
            const n = parseInt((row.supplierCode ?? '').replace('SUP-', ''), 10)
            if (Number.isFinite(n) && n > max) max = n
          }
          return max
        }
      )

      return tx.supplier.create({
        data: {
          supplierCode,
          supplierName: payload.supplierName,
          phone: payload.phone || null,
          email: payload.email || null,
          address: payload.address,
          city: payload.city,
          state: payload.state,
          country: payload.country,
          taxNumber: payload.taxNumber,
          notes: payload.notes
        }
      })
    })

    await logAction({ userId: getCurrentSession()?.userId, action: 'SUPPLIER_CREATED', entityType: 'Supplier', entityId: supplier.id, newValue: { supplierName: payload.supplierName } })
    return { success: true, data: supplier }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function updateSupplier(payload: UpdateSupplierPayload): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const existing = await db.supplier.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'SUP-001', message: 'Supplier not found.' } }

    // S001: Phone unique (exclude self)
    if (payload.phone && payload.phone !== existing.phone) {
      const phoneExists = await db.supplier.findFirst({ where: { phone: payload.phone, isActive: true, id: { not: payload.id } } })
      if (phoneExists) return { success: false, error: { code: 'SUP-002', message: 'A supplier with this phone number already exists.' } }
    }

    const updated = await db.supplier.update({
      where: { id: payload.id },
      data: {
        supplierName: payload.supplierName,
        phone: payload.phone || null,
        email: payload.email || null,
        address: payload.address,
        city: payload.city,
        state: payload.state,
        country: payload.country,
        taxNumber: payload.taxNumber,
        notes: payload.notes
      }
    })

    await logAction({ userId: getCurrentSession()?.userId, action: 'SUPPLIER_UPDATED', entityType: 'Supplier', entityId: payload.id })
    return { success: true, data: updated }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function archiveSupplier(id: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    // S002: Cannot archive if has open POs
    const openPOs = await db.purchaseOrder.count({ where: { supplierId: id, status: { in: ['DRAFT', 'APPROVED'] } } })
    if (openPOs > 0) {
      return { success: false, error: { code: 'SUP-003', message: 'Cannot archive: supplier has open purchase orders.' } }
    }

    await db.supplier.update({ where: { id }, data: { isActive: false } })
    await logAction({ userId: getCurrentSession()?.userId, action: 'SUPPLIER_ARCHIVED', entityType: 'Supplier', entityId: id })
    return { success: true }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}
