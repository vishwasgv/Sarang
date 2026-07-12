import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { inventoryService } from './inventory.service'
import { customerLedgerService } from './customer-ledger.service'
import { isModuleEnabled } from './industry-template.service'
import { generateInvoiceNumber } from './billing.service'
import { generateSequenceNumber } from './sequence.service'
import { ServiceError } from '../errors/service-error'

export interface CreateQuotationPayload {
  customerId?: string
  customerName?: string
  validUntil?: string
  notes?: string
  items: Array<{
    productId?: string
    productName: string
    sku?: string
    quantity: number
    unitPrice: number
    discount?: number
    taxRate?: number
  }>
}

export interface UpdateQuotationStatusPayload {
  id: string
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'EXPIRED'
}

export const quotationService = {
  async create(payload: CreateQuotationPayload, userId: string) {
    const db = getPrisma()

    let subtotal = 0
    let taxAmount = 0
    let discountAmount = 0

    const computedItems = payload.items.map(item => {
      const base = item.quantity * item.unitPrice
      const disc = base * ((item.discount ?? 0) / 100)
      const taxable = base - disc
      const tax = taxable * ((item.taxRate ?? 0) / 100)
      subtotal += base
      discountAmount += disc
      taxAmount += tax
      return { ...item, discount: item.discount ?? 0, taxRate: item.taxRate ?? 0, lineTotal: taxable + tax }
    })

    const totalAmount = subtotal - discountAmount + taxAmount

    // Number generation must happen inside the same transaction as the
    // insert — see sequence.service.ts's header comment for why a plain
    // pre-transaction read is a real race under concurrent creates.
    const quotation = await db.$transaction(async (tx) => {
      const quotationNumber = await generateSequenceNumber(
        tx, 'quotation_sequence', 'QT', 5,
        async () => {
          const last = await tx.quotation.findFirst({ orderBy: { createdAt: 'desc' }, select: { quotationNumber: true } })
          return last ? parseInt(last.quotationNumber.replace('QT-', ''), 10) : 0
        }
      )

      return tx.quotation.create({
        data: {
          quotationNumber,
          customerId: payload.customerId ?? null,
          customerName: payload.customerName ?? null,
          validUntil: payload.validUntil ? new Date(payload.validUntil) : null,
          notes: payload.notes ?? null,
          subtotal,
          taxAmount,
          discountAmount,
          totalAmount,
          createdBy: userId,
          items: { create: computedItems }
        },
        include: { items: true, customer: true }
      })
    })

    await logAction({ userId, action: 'CREATE_QUOTATION', entityType: 'Quotation', entityId: quotation.id, newValue: `Quotation ${quotation.quotationNumber}` })
    return { success: true, data: quotation }
  },

  async list(params: { status?: string; customerId?: string; page?: number; limit?: number }) {
    const db = getPrisma()
    const { status, customerId, page = 1, limit = 50 } = params
    const where = {
      ...(status ? { status } : {}),
      ...(customerId ? { customerId } : {})
    }
    const [quotations, total] = await Promise.all([
      db.quotation.findMany({
        where,
        include: { customer: true, _count: { select: { items: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.quotation.count({ where })
    ])
    return { success: true, data: { quotations, total } }
  },

  async getById(id: string) {
    const db = getPrisma()
    const q = await db.quotation.findUnique({
      where: { id },
      include: { items: true, customer: true, invoice: true }
    })
    if (!q) return { success: false, error: { code: 'QT-001', message: 'Quotation not found.' } }
    return { success: true, data: q }
  },

  async updateStatus(payload: UpdateQuotationStatusPayload, userId: string) {
    const db = getPrisma()
    const q = await db.quotation.update({
      where: { id: payload.id },
      data: { status: payload.status }
    })
    await logAction({ userId, action: 'UPDATE_QUOTATION_STATUS', entityType: 'Quotation', entityId: q.id, newValue: `Status → ${payload.status}` })
    return { success: true, data: q }
  },

  async convertToInvoice(id: string, userId: string) {
    const db = getPrisma()
    const q = await db.quotation.findUnique({ where: { id }, include: { items: true, invoice: true } })
    if (!q) return { success: false, error: { code: 'QT-001', message: 'Quotation not found.' } }
    if (q.invoice) return { success: false, error: { code: 'QT-002', message: 'Quotation already converted to an invoice.' } }

    // Resolve productId for each item: use linked product or find by name; fallback to a Misc product.
    // productType is carried through so only real STANDARD products get stock deducted below.
    const resolvedItems = await Promise.all(q.items.map(async (item) => {
      if (item.productId) {
        const p = await db.product.findUnique({ where: { id: item.productId }, select: { productType: true } })
        return { ...item, resolvedProductId: item.productId, resolvedProductType: p?.productType ?? 'STANDARD' }
      }
      const byName = await db.product.findFirst({ where: { productName: item.productName, isActive: true } })
      if (byName) return { ...item, resolvedProductId: byName.id, resolvedProductType: byName.productType }
      // No matching product — get or create a system Miscellaneous product
      let misc = await db.product.findFirst({ where: { productName: '__MISC_ITEM__' } })
      if (!misc) {
        misc = await db.product.create({
          data: { productName: '__MISC_ITEM__', sellingPrice: 0, taxRate: 0, productType: 'SERVICE', unit: 'PCS', isActive: true }
        })
      }
      return { ...item, resolvedProductId: misc.id, resolvedProductType: misc.productType }
    }))

    // A converted invoice always starts fully unpaid (the quotation never collected
    // payment) — treat it like a CREDIT sale for credit-limit enforcement, matching
    // billing.service.ts's own createInvoice behaviour.
    const creditLimitModuleEnabled = await isModuleEnabled('credit_limit_enforcement')

    try {
      const invoice = await db.$transaction(async (tx) => {
        if (q.customerId && creditLimitModuleEnabled) {
          const customer = await tx.customer.findUnique({ where: { id: q.customerId } })
          if (customer && customer.creditLimit > 0) {
            const projectedBalance = customer.outstandingBalance + q.totalAmount
            if (projectedBalance > customer.creditLimit) {
              throw new ServiceError('CUST-003', `Credit limit exceeded. Outstanding: ${customer.outstandingBalance.toFixed(2)}, invoice: ${q.totalAmount.toFixed(2)}, limit: ${customer.creditLimit.toFixed(2)}.`)
            }
          }
        }

        const invoiceNumber = await generateInvoiceNumber(tx)

        const inv = await tx.invoice.create({
          data: {
            invoiceNumber,
            invoiceType: 'RETAIL',
            customerId: q.customerId ?? null,
            subtotal: q.subtotal,
            taxAmount: q.taxAmount,
            discountAmount: q.discountAmount,
            totalAmount: q.totalAmount,
            balanceAmount: q.totalAmount,
            quotationId: q.id,
            createdById: userId
          }
        })

        for (const item of resolvedItems) {
          const lineDiscountAmount = item.quantity * item.unitPrice * (item.discount / 100)
          await tx.invoiceItem.create({
            data: {
              invoiceId: inv.id,
              productId: item.resolvedProductId,
              productName: item.productName,
              productSku: item.sku ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountAmount: lineDiscountAmount,
              taxRate: item.taxRate,
              taxAmount: item.lineTotal - (item.quantity * item.unitPrice - lineDiscountAmount),
              lineTotal: item.lineTotal
            }
          })

          if (item.resolvedProductType === 'STANDARD') {
            await inventoryService.reduceStockTx(
              tx, item.resolvedProductId, item.quantity,
              `Invoice ${invoiceNumber} (converted from quotation ${q.quotationNumber})`, 'INVOICE', inv.id, userId
            )
          }
        }

        if (q.customerId) {
          await customerLedgerService.addEntry({
            customerId: q.customerId,
            referenceType: 'INVOICE',
            referenceId: inv.id,
            debitAmount: q.totalAmount,
            creditAmount: 0,
            remarks: `Invoice ${invoiceNumber} (converted from quotation ${q.quotationNumber})`
          }, tx)
        }

        await tx.quotation.update({ where: { id }, data: { status: 'ACCEPTED' } })

        return inv
      })

      await logAction({ userId, action: 'CONVERT_QUOTATION', entityType: 'Invoice', entityId: invoice.id, newValue: `From quotation ${q.quotationNumber}` })
      return { success: true, data: invoice }
    } catch (err) {
      if (err instanceof ServiceError) {
        return { success: false, error: { code: err.code, message: err.message } }
      }
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  },

  async delete(id: string, userId: string) {
    const db = getPrisma()
    const q = await db.quotation.findUnique({ where: { id } })
    if (!q) return { success: false, error: { code: 'QT-001', message: 'Quotation not found.' } }
    if (q.status === 'ACCEPTED') return { success: false, error: { code: 'QT-003', message: 'Cannot delete an accepted quotation.' } }
    await db.quotation.delete({ where: { id } })
    await logAction({ userId, action: 'DELETE_QUOTATION', entityType: 'Quotation', entityId: id, newValue: q.quotationNumber })
    return { success: true }
  }
}
