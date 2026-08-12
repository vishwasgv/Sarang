import { getPrisma } from '../database/db'
import { parseLocalDateStart } from '../utils/date.util'
import { inventoryService } from './inventory.service'
import { customerLedgerService } from './customer-ledger.service'
import { isModuleEnabled } from './industry-template.service'
import { generateInvoiceNumber, postInvoiceJournalEntry } from './billing.service'
import { generateSequenceNumber } from './sequence.service'
import { calculateLineTotal, sumCurrency, roundCurrency, getCurrencyDecimals } from './currency.service'
import { logAction } from './audit.service'
import { getCurrentSession } from './auth.service'
import { assertNotLocked } from './transaction-lock.service'
import { getLicenseState } from './license.service'
import { approvalWorkflowService } from './approval-workflow.service'
import { ServiceError } from '../errors/service-error'
import type { CreateSalesOrderPayload, CreateInvoiceFromSalesOrderPayload } from '../validation/sales-order.validation'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// Same gap-tolerant, race-safe pattern purchase-order.service.ts's own
// generatePONumber already established — see its header comment for why a
// plain count()+1 is wrong under concurrency and hard-delete both.
async function generateSONumber(tx: TxClient): Promise<string> {
  return generateSequenceNumber(
    tx, 'so_number_sequence', 'SO', 5,
    async () => {
      const rows = await tx.salesOrder.findMany({ select: { soNumber: true } })
      let max = 0
      for (const row of rows) {
        const n = parseInt(row.soNumber.replace('SO-', ''), 10)
        if (Number.isFinite(n) && n > max) max = n
      }
      return max
    }
  )
}

export const salesOrderService = {
  // Mirrors purchaseOrderService.createPO exactly, on the sales side — a
  // Sales Order commits to a sale before it's billed, the direct mirror of
  // how a PO commits to a purchase before it's received.
  async createSalesOrder(payload: CreateSalesOrderPayload, userId?: string) {
    const db = getPrisma()

    const customer = await db.customer.findUnique({ where: { id: payload.customerId } })
    if (!customer) return { success: false, error: { code: 'CUST-001', message: 'Customer not found.' } }
    if (!customer.isActive) return { success: false, error: { code: 'CUST-004', message: 'Cannot create a Sales Order for an archived customer.' } }

    for (const item of payload.items) {
      if (item.productId) {
        const product = await db.product.findUnique({ where: { id: item.productId } })
        if (!product) return { success: false, error: { code: 'PRD-001', message: 'Product not found.' } }
        if (!product.isActive) return { success: false, error: { code: 'PRD-005', message: `Product "${product.productName}" is archived.` } }
      } else if (item.serviceCategoryId) {
        const cat = await db.expenseCategory.findUnique({ where: { id: item.serviceCategoryId } })
        if (!cat) return { success: false, error: { code: 'EXP-002', message: 'Expense category not found.' } }
      }
    }

    const businessProfile = await db.businessProfile.findFirst({ select: { currencyCode: true } })
    const currencyDecimals = getCurrencyDecimals(businessProfile?.currencyCode)

    const lineRows = payload.items.map(item => ({
      item,
      ...calculateLineTotal(item.quantity, item.unitPrice, 0, item.taxRate ?? 0, currencyDecimals)
    }))
    const subtotal = sumCurrency(lineRows.map(r => r.subtotal), currencyDecimals)
    const taxAmount = sumCurrency(lineRows.map(r => r.taxAmount), currencyDecimals)
    const totalAmount = roundCurrency(subtotal + taxAmount, currencyDecimals)

    const so = await db.$transaction(async (tx) => {
      const soNumber = await generateSONumber(tx)
      return tx.salesOrder.create({
        data: {
          soNumber,
          customerId: payload.customerId,
          expectedDate: payload.expectedDate ? parseLocalDateStart(payload.expectedDate) : null,
          notes: payload.notes || null,
          status: 'DRAFT',
          subtotal,
          taxAmount,
          totalAmount,
          createdById: userId || null,
          items: {
            create: lineRows.map(({ item, taxAmount: lineTax, lineTotal }) => ({
              productId: item.productId || null,
              serviceDescription: item.serviceDescription || null,
              serviceCategoryId: item.serviceCategoryId || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate ?? 0,
              taxAmount: lineTax,
              total: lineTotal
            }))
          }
        },
        include: {
          customer: { select: { id: true, customerName: true, customerCode: true } },
          items: {
            include: {
              product: { select: { id: true, productName: true, sku: true, unit: true } },
              serviceCategory: { select: { id: true, categoryName: true } }
            }
          }
        }
      })
    })

    await logAction({ userId: userId ?? getCurrentSession()?.userId, action: 'SO_CREATED', entityType: 'SalesOrder', entityId: so.id, newValue: { soNumber: so.soNumber, customerId: so.customerId, totalAmount: so.totalAmount } })
    return { success: true, data: so }
  },

  async getSalesOrder(id: string) {
    const db = getPrisma()
    const so = await db.salesOrder.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, customerName: true, customerCode: true, phone: true, email: true } },
        items: {
          include: {
            product: { select: { id: true, productName: true, sku: true, unit: true, inventory: { select: { quantity: true } } } },
            serviceCategory: { select: { id: true, categoryName: true } }
          }
        },
        invoices: { select: { id: true, invoiceNumber: true, totalAmount: true, invoiceDate: true } }
      }
    })
    if (!so) return { success: false, error: { code: 'SO-001', message: 'Sales order not found.' } }
    return { success: true, data: so }
  },

  async listSalesOrders(filters?: { customerId?: string; status?: string; page?: number; limit?: number }) {
    const db = getPrisma()
    const page = filters?.page ?? 1
    const limit = filters?.limit ?? 20
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (filters?.customerId) where.customerId = filters.customerId
    if (filters?.status) where.status = filters.status

    const [orders, total] = await db.$transaction([
      db.salesOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, customerName: true, customerCode: true } },
          items: { select: { id: true, quantity: true, invoicedQty: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      db.salesOrder.count({ where })
    ])

    return { success: true, data: { orders, total } }
  },

  // Phase 63 — multi-level approval workflows, fully opt-in: an install with
  // no active ApprovalWorkflow for SALES_ORDER (the overwhelming majority)
  // sees zero behavior change here — submitForApproval always returns
  // requiresApproval:false and this goes straight to CONFIRMED exactly as
  // before. Re-callable: once a PENDING_APPROVAL order's ApprovalInstance
  // reaches APPROVED, calling this again finishes the DRAFT→CONFIRMED
  // transition instead of erroring.
  async confirmSalesOrder(id: string) {
    const db = getPrisma()
    try {
      const so = await db.salesOrder.findUnique({ where: { id } })
      if (!so) return { success: false, error: { code: 'SO-001', message: 'Sales order not found.' } }

      if (so.status === 'PENDING_APPROVAL') {
        const instanceRes = await approvalWorkflowService.getInstanceForDocument('SALES_ORDER', id)
        const instance = instanceRes.success ? (instanceRes.data as { status: string } | null) : null
        if (!instance || instance.status === 'PENDING') {
          return { success: false, error: { code: 'SO-010', message: 'This Sales Order is still awaiting approval.' } }
        }
        if (instance.status === 'REJECTED') {
          return { success: false, error: { code: 'SO-011', message: 'This Sales Order was rejected during approval and cannot be confirmed.' } }
        }
        // instance.status === 'APPROVED' — fall through to the real transition below.
      } else if (so.status !== 'DRAFT') {
        return { success: false, error: { code: 'SO-002', message: `Only DRAFT orders can be confirmed. Current status: ${so.status}.` } }
      } else {
        const approvalRes = await approvalWorkflowService.submitForApproval({ documentType: 'SALES_ORDER', documentId: id, amount: so.totalAmount })
        if (approvalRes.success && (approvalRes.data as { requiresApproval: boolean }).requiresApproval) {
          const pending = await db.salesOrder.update({ where: { id }, data: { status: 'PENDING_APPROVAL' } })
          await logAction({ userId: getCurrentSession()?.userId, action: 'SO_SUBMITTED_FOR_APPROVAL', entityType: 'SalesOrder', entityId: id, newValue: { status: 'PENDING_APPROVAL' } })
          return { success: true, data: pending }
        }
      }

      const updated = await db.$transaction(async (tx) => {
        const fresh = await tx.salesOrder.findUnique({ where: { id } })
        if (!fresh) throw new ServiceError('SO-001', 'Sales order not found.')
        if (fresh.status !== 'DRAFT' && fresh.status !== 'PENDING_APPROVAL') {
          throw new ServiceError('SO-002', `Only DRAFT orders can be confirmed. Current status: ${fresh.status}.`)
        }
        return tx.salesOrder.update({ where: { id }, data: { status: 'CONFIRMED' } })
      })
      await logAction({ userId: getCurrentSession()?.userId, action: 'SO_CONFIRMED', entityType: 'SalesOrder', entityId: id, newValue: { status: 'CONFIRMED' } })
      return { success: true, data: updated }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  },

  async cancelSalesOrder(id: string, reason: string) {
    const db = getPrisma()
    try {
      const updated = await db.$transaction(async (tx) => {
        const so = await tx.salesOrder.findUnique({ where: { id } })
        if (!so) throw new ServiceError('SO-001', 'Sales order not found.')
        if (so.status === 'INVOICED') {
          throw new ServiceError('SO-003', 'Cannot cancel a Sales Order that has already been fully invoiced.')
        }
        if (so.status === 'CANCELLED') {
          throw new ServiceError('SO-004', 'This Sales Order is already cancelled.')
        }
        const cancelNote = so.notes ? `${so.notes}\nCancelled: ${reason}` : `Cancelled: ${reason}`
        return tx.salesOrder.update({ where: { id }, data: { status: 'CANCELLED', notes: cancelNote } })
      })
      await logAction({ userId: getCurrentSession()?.userId, action: 'SO_CANCELLED', entityType: 'SalesOrder', entityId: id, newValue: { status: 'CANCELLED', reason } })
      return { success: true, data: updated }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  },

  // Partial-invoicing conversion — the one function that makes a Sales
  // Order genuinely different from a Quotation. Mirrors
  // quotationService.convertToInvoice's own shape (license gate, credit-limit
  // check, per-line total computation, stock reduction, customer-ledger
  // posting) but supports invoicing only SOME lines/quantities of the order,
  // tracked via SalesOrderItem.invoicedQty rather than a one-shot flag.
  async createInvoiceFromSalesOrder(payload: CreateInvoiceFromSalesOrderPayload, userId: string) {
    const licenseState = await getLicenseState()
    if (licenseState.status === 'EXPIRED') {
      const message = licenseState.tier === 'PAID'
        ? 'Your license has expired. Renew (Settings → License) to keep creating new invoices — all your existing data remains fully accessible.'
        : 'Your free year has ended. Renew your license (Settings → License) to keep creating new invoices — all your existing data remains fully accessible.'
      return { success: false, error: { code: 'LIC-002', message } }
    }

    const db = getPrisma()
    const so = await db.salesOrder.findUnique({ where: { id: payload.salesOrderId }, include: { items: true } })
    if (!so) return { success: false, error: { code: 'SO-001', message: 'Sales order not found.' } }
    if (so.status === 'DRAFT' || so.status === 'PENDING_APPROVAL') return { success: false, error: { code: 'SO-005', message: 'Confirm this Sales Order before invoicing it.' } }
    if (so.status === 'CANCELLED') return { success: false, error: { code: 'SO-006', message: 'Cannot invoice a cancelled Sales Order.' } }
    if (so.status === 'INVOICED') return { success: false, error: { code: 'SO-007', message: 'This Sales Order has already been fully invoiced.' } }

    // Sales Orders don't support backdating an invoice off them — same
    // reasoning billing.service.ts's own createInvoice already applies.
    const lockError = await assertNotLocked(new Date())
    if (lockError) return lockError

    try {
      const itemsById = new Map(so.items.map(i => [i.id, i]))
      const resolvedLines = payload.lines.map(line => {
        const soItem = itemsById.get(line.salesOrderItemId)
        if (!soItem) throw new ServiceError('SO-008', 'One of the requested lines does not belong to this Sales Order.')
        const remaining = roundCurrency(soItem.quantity - soItem.invoicedQty)
        if (line.quantity > remaining) {
          throw new ServiceError('SO-009', `Cannot invoice ${line.quantity} of a line with only ${remaining} remaining.`)
        }
        return { soItem, quantity: line.quantity }
      })

      const businessProfile = await db.businessProfile.findFirst({ select: { currencyCode: true } })
      const currencyDecimals = getCurrencyDecimals(businessProfile?.currencyCode)

      // Resolve productId for a service line the same way
      // quotationService.convertToInvoice already does — a real product line
      // keeps its own productId; a service line falls back to the shared
      // __MISC_ITEM__ system product, since InvoiceItem.productId is
      // non-nullable.
      const resolvedLines2 = await Promise.all(resolvedLines.map(async ({ soItem, quantity }) => {
        if (soItem.productId) {
          const p = await db.product.findUnique({ where: { id: soItem.productId }, select: { id: true, productName: true, sku: true, productType: true } })
          return { soItem, quantity, resolvedProductId: soItem.productId, productName: p?.productName ?? 'Product', productSku: p?.sku ?? null, resolvedProductType: p?.productType ?? 'STANDARD' }
        }
        let misc = await db.product.findFirst({ where: { productName: '__MISC_ITEM__' } })
        if (!misc) {
          misc = await db.product.create({ data: { productName: '__MISC_ITEM__', sellingPrice: 0, taxRate: 0, productType: 'SERVICE', unit: 'PCS', isActive: true } })
        }
        return { soItem, quantity, resolvedProductId: misc.id, productName: soItem.serviceDescription ?? 'Service', productSku: null, resolvedProductType: misc.productType }
      }))

      const invoiceLineRows = resolvedLines2.map(row => {
        const { taxAmount: lineTaxAmount, lineTotal } = calculateLineTotal(row.quantity, row.soItem.unitPrice, 0, row.soItem.taxRate, currencyDecimals)
        return { ...row, lineTaxAmount, lineTotal }
      })
      const invoiceSubtotal = sumCurrency(invoiceLineRows.map(r => roundCurrency(r.quantity * r.soItem.unitPrice, currencyDecimals)), currencyDecimals)
      const invoiceTaxAmount = sumCurrency(invoiceLineRows.map(r => r.lineTaxAmount), currencyDecimals)
      const invoiceTotalAmount = roundCurrency(invoiceSubtotal + invoiceTaxAmount, currencyDecimals)

      const creditLimitModuleEnabled = await isModuleEnabled('credit_limit_enforcement')

      const invoice = await db.$transaction(async (tx) => {
        if (creditLimitModuleEnabled) {
          const customer = await tx.customer.findUnique({ where: { id: so.customerId } })
          if (customer && customer.creditLimit > 0) {
            const projectedBalance = customer.outstandingBalance + invoiceTotalAmount
            if (projectedBalance > customer.creditLimit) {
              throw new ServiceError('CUST-003', `Credit limit exceeded. Outstanding: ${customer.outstandingBalance.toFixed(2)}, invoice: ${invoiceTotalAmount.toFixed(2)}, limit: ${customer.creditLimit.toFixed(2)}.`)
            }
          }
        }

        const invoiceNumber = await generateInvoiceNumber(tx)

        const inv = await tx.invoice.create({
          data: {
            invoiceNumber,
            invoiceType: 'RETAIL',
            customerId: so.customerId,
            subtotal: invoiceSubtotal,
            taxAmount: invoiceTaxAmount,
            totalAmount: invoiceTotalAmount,
            balanceAmount: invoiceTotalAmount,
            salesOrderId: so.id,
            createdById: userId
          }
        })

        for (const row of invoiceLineRows) {
          await tx.invoiceItem.create({
            data: {
              invoiceId: inv.id,
              productId: row.resolvedProductId,
              productName: row.productName,
              productSku: row.productSku,
              quantity: row.quantity,
              unitPrice: row.soItem.unitPrice,
              taxRate: row.soItem.taxRate,
              taxAmount: row.lineTaxAmount,
              lineTotal: row.lineTotal
            }
          })

          if (row.resolvedProductType === 'STANDARD') {
            await inventoryService.reduceStockTx(
              tx, row.resolvedProductId, row.quantity,
              `Invoice ${invoiceNumber} (from Sales Order ${so.soNumber})`, 'INVOICE', inv.id, userId
            )
          }

          await tx.salesOrderItem.update({
            where: { id: row.soItem.id },
            data: { invoicedQty: roundCurrency(row.soItem.invoicedQty + row.quantity) }
          })
        }

        await customerLedgerService.addEntry({
          customerId: so.customerId,
          referenceType: 'INVOICE',
          referenceId: inv.id,
          debitAmount: invoiceTotalAmount,
          creditAmount: 0,
          remarks: `Invoice ${invoiceNumber} (from Sales Order ${so.soNumber})`
        }, tx)

        // Same GL gap-fix as quotationService.convertToInvoice — always
        // CREDIT-shaped, so receivesCashNow=false.
        await postInvoiceJournalEntry(tx, inv, false)

        // Re-derive status from every line's own post-update invoicedQty,
        // not just the lines touched this call — a prior partial-invoice
        // pass may have already covered other lines.
        const freshItems = await tx.salesOrderItem.findMany({ where: { salesOrderId: so.id } })
        const allFullyInvoiced = freshItems.every(i => i.invoicedQty >= i.quantity)
        const anyInvoiced = freshItems.some(i => i.invoicedQty > 0)
        const newStatus = allFullyInvoiced ? 'INVOICED' : anyInvoiced ? 'PARTIALLY_INVOICED' : so.status
        await tx.salesOrder.update({ where: { id: so.id }, data: { status: newStatus } })

        return inv
      })

      await logAction({ userId, action: 'SO_INVOICED', entityType: 'Invoice', entityId: invoice.id, newValue: { fromSalesOrder: so.soNumber } })
      return { success: true, data: invoice }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  }
}
