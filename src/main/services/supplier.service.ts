import { getPrisma } from '../database/db'
import { checkSupplierUniqueness, validateSupplierFormats, normaliseSupplierIdentifiers } from './supplier-checks'
import { logAction } from './audit.service'
import { getCurrentSession } from './auth.service'
import { generateSequenceNumber } from './sequence.service'
import { supplierLedgerService } from './supplier-ledger.service'
import { serializeCustomFieldValues } from './custom-field.service'
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

    normaliseSupplierIdentifiers(payload)
    const formatError = await validateSupplierFormats(payload)
    if (formatError) return formatError
    // One real-world supplier = one record: phone, GSTIN, email and name+city
    // are all checked against active AND archived suppliers.
    const duplicate = await checkSupplierUniqueness(payload)
    if (duplicate) return duplicate

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

      const created = await tx.supplier.create({
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
          notes: payload.notes,
          bankAccountNumber: payload.bankAccountNumber?.trim() || null,
          bankIfscCode: payload.bankIfscCode?.trim() || null,
          bankName: payload.bankName?.trim() || null,
          panNumber: payload.panNumber?.trim() || null,
          openingBalance: payload.openingBalance ?? 0,
          isMsmeRegistered: payload.isMsmeRegistered ?? false,
          msmeCategory: payload.msmeCategory ?? null,
          paymentTermsDays: payload.paymentTermsDays ?? null,
          priceListId: payload.priceListId || null,
          customFields: serializeCustomFieldValues(payload.customFields)
        }
      })

      // Onboarding a supplier with real pre-existing dues — a one-time
      // opening-balance debit on the ledger so their outstanding balance is
      // correct from day one, same reasoning as receivePO's PO-received
      // debit (debitAmount = amount we owe).
      if (payload.openingBalance && payload.openingBalance > 0) {
        await supplierLedgerService.addEntry({
          supplierId: created.id,
          referenceType: 'OPENING_BALANCE',
          debitAmount: payload.openingBalance,
          creditAmount: 0,
          remarks: 'Opening balance at onboarding'
        }, tx)
      }

      return created
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

    normaliseSupplierIdentifiers(payload)
    // Only the fields this edit actually changes are re-checked, so an old
    // record with a legacy value can still be edited for something else.
    const changed = {
      phone: payload.phone && payload.phone !== existing.phone ? payload.phone : null,
      email: payload.email && payload.email !== existing.email ? payload.email : null,
      taxNumber: payload.taxNumber && payload.taxNumber !== existing.taxNumber ? payload.taxNumber : null,
      panNumber: payload.panNumber && payload.panNumber !== existing.panNumber ? payload.panNumber : null,
      bankIfscCode: payload.bankIfscCode && payload.bankIfscCode !== existing.bankIfscCode ? payload.bankIfscCode : null,
      supplierName: payload.supplierName && (payload.supplierName !== existing.supplierName || (payload.city ?? existing.city) !== existing.city) ? payload.supplierName : null,
      city: payload.city ?? existing.city,
      country: payload.country ?? existing.country
    }
    const formatError = await validateSupplierFormats(changed)
    if (formatError) return formatError
    const duplicate = await checkSupplierUniqueness(changed, payload.id)
    if (duplicate) return duplicate

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
        notes: payload.notes,
        bankAccountNumber: payload.bankAccountNumber?.trim() || null,
        bankIfscCode: payload.bankIfscCode?.trim() || null,
        bankName: payload.bankName?.trim() || null,
        panNumber: payload.panNumber?.trim() || null,
        isMsmeRegistered: payload.isMsmeRegistered ?? false,
        msmeCategory: payload.msmeCategory ?? null,
        paymentTermsDays: payload.paymentTermsDays === undefined ? existing.paymentTermsDays : payload.paymentTermsDays,
        priceListId: payload.priceListId ?? existing.priceListId,
        customFields: payload.customFields !== undefined ? serializeCustomFieldValues(payload.customFields) : existing.customFields
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
