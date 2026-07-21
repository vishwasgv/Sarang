import { app, BrowserWindow } from 'electron'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { billingService } from '../../services/billing.service'
import { printService } from '../../services/print.service'
import { heldSaleService } from '../../services/held-sale.service'
import { formatAmount as formatAmountLocaleAware } from '../../services/currency.service'
import { requirePermission, requireSession, hasPermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { logAction } from '../../services/audit.service'
import { getPrisma } from '../../database/db'
import { CreateInvoiceSchema, CancelInvoiceSchema, SplitInvoiceSchema } from '../../validation/billing.validation'
import { PrintLabelsSchema } from '../../validation/product.validation'
import { HoldSaleSchema, HeldSaleIdSchema } from '../../validation/held-sale.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

export function register(handle: HandleFn): void {
  handle('billing:generateInvoiceNumber', async () => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return billingService.generateInvoiceNumber()
  })

  handle('billing:getOrCreateTipProduct', async () => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return billingService.getOrCreateTipProduct()
  })

  handle('billing:getFrequentlySoldProducts', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { limit } = (payload ?? {}) as { limit?: number }
    return billingService.getFrequentlySoldProducts(limit)
  })

  handle('heldSale:hold', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = HoldSaleSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return heldSaleService.holdSale({ ...parsed.data, createdById: session?.userId })
  })

  handle('heldSale:list', async () => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return heldSaleService.listHeldSales()
  })

  handle('heldSale:resume', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = HeldSaleIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return heldSaleService.resumeSale(parsed.data.id, session?.userId)
  })

  handle('heldSale:delete', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = HeldSaleIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return heldSaleService.deleteHeldSale(parsed.data.id, session?.userId)
  })

  handle('billing:createInvoice', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateInvoiceSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return billingService.createInvoice(parsed.data, getCurrentSession()?.userId)
  })

  handle('billing:getInvoice', async (id) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const bad = validateId(id, 'invoice ID'); if (bad) return bad
    return billingService.getInvoice(id as string)
  })

  handle('billing:listInvoices', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return billingService.listInvoices(payload as { status?: string; customerId?: string; dateFrom?: string; dateTo?: string; search?: string; page?: number; limit?: number } | undefined)
  })

  handle('billing:cancelInvoice', async (payload) => {
    const deny = await requirePermission('billing.cancelInvoice'); if (deny) return deny
    const parsed = CancelInvoiceSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return billingService.cancelInvoice(parsed.data, getCurrentSession()?.userId)
  })

  handle('billing:splitInvoice', async (payload) => {
    // Same permission as cancelInvoice — both mutate an already-created
    // invoice's financial shape, not just record a new sale.
    const deny = await requirePermission('billing.cancelInvoice'); if (deny) return deny
    const parsed = SplitInvoiceSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return billingService.splitInvoice(parsed.data, getCurrentSession()?.userId)
  })

  handle('print:invoice', async (payload) => {
    const deny = await requirePermission('billing.printInvoice'); if (deny) return deny
    const { invoiceId } = payload as { invoiceId: string }
    const bad = validateId(invoiceId, 'invoice ID'); if (bad) return bad
    const invoiceRes = await billingService.getInvoice(invoiceId)
    if (!invoiceRes.success) return invoiceRes
    const db = getPrisma()
    const [profile, printTypeSetting] = await Promise.all([
      db.businessProfile.findFirst(),
      db.setting.findUnique({ where: { settingKey: 'print_type' } })
    ])
    const printType = (printTypeSetting?.settingValue ?? 'A4') as 'A4' | 'THERMAL_80MM' | 'THERMAL_58MM'
    const isReceipt = printType === 'THERMAL_80MM' || printType === 'THERMAL_58MM'
    const paperWidth = printType === 'THERMAL_58MM' ? '58mm' : '80mm'
    const html = isReceipt
      ? await printService.generateReceiptHtml(invoiceRes.data as unknown as Parameters<typeof printService.generateReceiptHtml>[0], profile as Parameters<typeof printService.generateReceiptHtml>[1], paperWidth)
      : await printService.generateInvoiceHtml(invoiceRes.data as unknown as Parameters<typeof printService.generateInvoiceHtml>[0], profile as Parameters<typeof printService.generateInvoiceHtml>[1])
    const tmpPath = join(app.getPath('temp'), `sarang_inv_${Date.now()}.html`)
    await writeFile(tmpPath, html, 'utf-8')
    return new Promise<{ success: boolean; data?: unknown; error?: { code: string; message: string } }>((resolve) => {
      const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } })
      win.loadFile(tmpPath)
      win.webContents.once('did-finish-load', () => {
        win.webContents.print({ silent: false, printBackground: true, color: !isReceipt }, (success: boolean) => {
          win.close()
          unlink(tmpPath).catch(() => {})
          resolve({ success, data: { printed: success } })
        })
      })
    })
  })

  handle('print:receipt', async (payload) => {
    const deny = await requirePermission('billing.printInvoice'); if (deny) return deny
    const { invoiceId, paperWidth: overridePaperWidth } = payload as { invoiceId: string; paperWidth?: '80mm' | '58mm' }
    const bad = validateId(invoiceId, 'invoice ID'); if (bad) return bad
    const invoiceRes = await billingService.getInvoice(invoiceId)
    if (!invoiceRes.success) return invoiceRes
    const db = getPrisma()
    const [profile, printTypeSetting] = await Promise.all([
      db.businessProfile.findFirst(),
      db.setting.findUnique({ where: { settingKey: 'print_type' } })
    ])
    const printType = (printTypeSetting?.settingValue ?? 'THERMAL_80MM') as 'A4' | 'THERMAL_80MM' | 'THERMAL_58MM'
    const paperWidth = overridePaperWidth ?? (printType === 'THERMAL_58MM' ? '58mm' : '80mm')
    const html = await printService.generateReceiptHtml(invoiceRes.data as unknown as Parameters<typeof printService.generateReceiptHtml>[0], profile as Parameters<typeof printService.generateReceiptHtml>[1], paperWidth)
    const tmpPath = join(app.getPath('temp'), `sarang_rcpt_${Date.now()}.html`)
    await writeFile(tmpPath, html, 'utf-8')
    return new Promise<{ success: boolean; data?: unknown; error?: { code: string; message: string } }>((resolve) => {
      const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } })
      win.loadFile(tmpPath)
      win.webContents.once('did-finish-load', () => {
        win.webContents.print({ silent: false, printBackground: true }, (success: boolean) => {
          win.close()
          unlink(tmpPath).catch(() => {})
          resolve({ success, data: { printed: success } })
        })
      })
    })
  })

  // Preview only — returns the rendered HTML without ever opening a print
  // dialog, so the cashier can review layout/totals before committing to
  // paper. "Print" was previously a one-shot action straight to the OS print
  // dialog with no chance to check it first.
  handle('print:previewInvoice', async (payload) => {
    const deny = await requirePermission('billing.printInvoice'); if (deny) return deny
    const { invoiceId } = payload as { invoiceId: string }
    const bad = validateId(invoiceId, 'invoice ID'); if (bad) return bad
    const invoiceRes = await billingService.getInvoice(invoiceId)
    if (!invoiceRes.success) return invoiceRes
    const profile = await getPrisma().businessProfile.findFirst()
    const html = await printService.generateInvoiceHtml(invoiceRes.data as unknown as Parameters<typeof printService.generateInvoiceHtml>[0], profile as Parameters<typeof printService.generateInvoiceHtml>[1])
    return { success: true, data: html }
  })

  handle('print:previewReceipt', async (payload) => {
    const deny = await requirePermission('billing.printInvoice'); if (deny) return deny
    const { invoiceId, paperWidth } = payload as { invoiceId: string; paperWidth?: '80mm' | '58mm' }
    const bad = validateId(invoiceId, 'invoice ID'); if (bad) return bad
    const invoiceRes = await billingService.getInvoice(invoiceId)
    if (!invoiceRes.success) return invoiceRes
    const db = getPrisma()
    const [profile, printTypeSetting] = await Promise.all([
      db.businessProfile.findFirst(),
      db.setting.findUnique({ where: { settingKey: 'print_type' } })
    ])
    const printType = (printTypeSetting?.settingValue ?? 'THERMAL_80MM') as 'A4' | 'THERMAL_80MM' | 'THERMAL_58MM'
    const resolvedPaperWidth = paperWidth ?? (printType === 'THERMAL_58MM' ? '58mm' : '80mm')
    const html = await printService.generateReceiptHtml(invoiceRes.data as unknown as Parameters<typeof printService.generateReceiptHtml>[0], profile as Parameters<typeof printService.generateReceiptHtml>[1], resolvedPaperWidth)
    return { success: true, data: html }
  })

  handle('print:kot', async (payload) => {
    // Gated on restaurant.updateKOT, not billing.printInvoice — a kitchen
    // ticket has no pricing/customer info on it (see generateKOTHtml: table,
    // order number, items, quantities — nothing financial), so it isn't a
    // billing document. Gating it on billing.printInvoice meant Kitchen
    // Staff — who has viewKOT/updateKOT but not billing.printInvoice — could
    // see the Print button but get a permission error clicking it, for
    // exactly the role whose entire job is printing kitchen tickets.
    const deny = await requirePermission('restaurant.updateKOT'); if (deny) return deny
    const { kotId } = payload as { kotId: string }
    const bad = validateId(kotId, 'KOT ID'); if (bad) return bad
    const db = getPrisma()
    const [kot, kotPrinterSetting] = await Promise.all([
      db.kOT.findUnique({
        where: { id: kotId },
        include: {
          table: { select: { tableNumber: true, tableName: true } },
          invoice: { include: { items: { include: { product: { select: { productName: true } } } } } }
        }
      }),
      db.setting.findUnique({ where: { settingKey: 'kot_printer_name' } })
    ])
    if (!kot) return { success: false, error: { code: 'RST-015', message: 'KOT not found.' } }
    const profile = await db.businessProfile.findFirst()
    const html = await printService.generateKOTHtml({
      kotId: kot.id,
      tableNumber: kot.table?.tableNumber ?? null,
      tableName: kot.table?.tableName ?? null,
      invoiceNumber: kot.invoice.invoiceNumber,
      items: kot.invoice.items.map(i => ({ productName: i.product.productName, quantity: i.quantity })),
      createdAt: kot.createdAt,
      status: kot.status,
      businessName: profile?.businessName ?? 'Restaurant'
    })
    const tmpPath = join(app.getPath('temp'), `sarang_kot_${Date.now()}.html`)
    await writeFile(tmpPath, html, 'utf-8')
    // Empty string means "no kitchen printer chosen" — fall back to silent
    // print's normal behaviour (the OS default printer) rather than passing
    // deviceName: '', which Electron would reject as an unknown device.
    const kotDeviceName = kotPrinterSetting?.settingValue || undefined
    return new Promise<{ success: boolean; data?: unknown; error?: { code: string; message: string } }>((resolve) => {
      const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } })
      win.loadFile(tmpPath)
      win.webContents.once('did-finish-load', () => {
        win.webContents.print({ silent: true, printBackground: false, ...(kotDeviceName ? { deviceName: kotDeviceName } : {}) }, (success: boolean) => {
          win.close()
          unlink(tmpPath).catch(() => {})
          resolve({ success, data: { printed: success } })
        })
      })
    })
  })

  handle('print:listPrinters', async () => {
    // Gated the same as the setting itself (settings:set uses settings.modify)
    // since this only exists to populate the Kitchen Printer picker in Settings.
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    // Reuses the already-open app window rather than spawning a hidden one
    // (unlike the print:* jobs above) — printer enumeration needs no loaded
    // page content, and Settings is only reachable with the main window open.
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return { success: true, data: [] }
    const printers = await win.webContents.getPrintersAsync()
    return { success: true, data: printers.map(p => ({ name: p.name, displayName: p.displayName, isDefault: p.isDefault })) }
  })

  // Phase 38: barcode/price label printing. Builds the same params shape for
  // both print and preview so the two paths can't drift — preview just skips
  // the actual print-dialog step.
  async function buildLabelHtml(payload: unknown): Promise<{ ok: true; html: string; items: Array<{ productId: string; copies: number }>; printedPrices: Map<string, number> } | { ok: false; res: { success: false; error: { code: string; message: string } } }> {
    // Every other Phase 38 handler validates its payload with the matching Zod
    // schema before touching the database — this one didn't, which meant the
    // schema's copies.max(500) cap and outputMode enum check never actually ran.
    const parsed = PrintLabelsSchema.safeParse(payload)
    if (!parsed.success) {
      return { ok: false, res: { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid data.' } } }
    }
    const { items, outputMode, fields } = parsed.data

    const db = getPrisma()
    const products = await db.product.findMany({ where: { id: { in: items.map(i => i.productId) } } })
    const byId = new Map(products.map(p => [p.id, p]))
    const missing = items.filter(i => !byId.has(i.productId))
    if (missing.length > 0) {
      return { ok: false, res: { success: false, error: { code: 'PRD-001', message: 'One or more selected products could not be found.' } } }
    }

    // Phase 58 §2 — Clothing/Footwear variant-aware label printing. A line
    // with variantId prints THAT specific size/colour's own barcode/price,
    // never the parent product's generic one — resolving the plain product
    // barcode for a variant-tracked item would print a label that scans as
    // the wrong physical unit.
    const variantIds = items.map(i => i.variantId).filter((id): id is string => !!id)
    const variantRows = await db.productVariant.findMany({ where: { id: { in: variantIds } } })
    const variantsById = new Map(variantRows.map(v => [v.id, v]))
    const missingVariants = items.filter(i => i.variantId && (!variantsById.has(i.variantId) || variantsById.get(i.variantId)!.productId !== i.productId))
    if (missingVariants.length > 0) {
      return { ok: false, res: { success: false, error: { code: 'VAR-001', message: 'One or more selected variants could not be found.' } } }
    }

    // A line with barcodeOverride (the weigh-and-print flow) carries its own
    // ad-hoc code and doesn't need the product's own Product.barcode at all.
    const withoutBarcode = items.filter(i => {
      if (i.barcodeOverride) return false
      if (i.variantId) return !variantsById.get(i.variantId)?.barcode
      return !byId.get(i.productId)?.barcode
    })
    if (withoutBarcode.length > 0) {
      return { ok: false, res: { success: false, error: { code: 'BCD-011', message: 'Every selected product/variant needs a barcode before printing labels — use "Generate Missing Barcodes" first.' } } }
    }

    const [profile, widthSetting, heightSetting, fmtSettingRows] = await Promise.all([
      db.businessProfile.findFirst(),
      db.setting.findUnique({ where: { settingKey: 'label_width_mm' } }),
      db.setting.findUnique({ where: { settingKey: 'label_height_mm' } }),
      db.setting.findMany({ where: { settingKey: { in: ['number_format', 'decimal_places', 'currency_symbol_position'] } } })
    ])
    // Real bug found+fixed 2026-07-15: label prices used to be formatted with
    // print.service.ts's old naive formatAmount (no digit grouping at all,
    // e.g. "₹14568" instead of "₹14,568") — see that file's own fix comment
    // for the full story. Fixed the same way here: route through
    // currency.service.ts's already-correct, locale-aware formatter.
    const fmtMap = new Map(fmtSettingRows.map(r => [r.settingKey, r.settingValue]))
    const numberFormat = fmtMap.get('number_format') ?? 'IN'
    const decimalsRaw = fmtMap.get('decimal_places')
    const decimals = decimalsRaw !== undefined ? parseInt(decimalsRaw, 10) : 2
    const symbolPosition = fmtMap.get('currency_symbol_position') === 'suffix' ? 'suffix' : 'prefix'
    const formatAmount = (amount: number, symbol = profile?.currencySymbol ?? '₹'): string =>
      formatAmountLocaleAware(Math.abs(amount), symbol, numberFormat, Number.isFinite(decimals) ? decimals : 2, symbolPosition)

    // Tracks the price actually printed for each *regular batch* line (not the
    // weigh-and-print ad-hoc flow, which already has its own LabelPrintLog
    // reprint-warning mechanism) — used after a successful print to record
    // Product.lastLabelPrintedAt/Price, so a later price change can warn that
    // the shelf label is now stale, the same idea generalized to every product.
    // Deliberately keyed by productId only, even for a variant line — there is
    // no ProductVariant.lastLabelPrintedAt/Price field (out of scope for this
    // pass, see PHASE_58_VERTICAL_COVERAGE_PLAN.md's Clothing/Footwear entry);
    // a variant line's price is never recorded into this reprint-warning map.
    const printedPrices = new Map<string, number>()
    const labels = items.map(i => {
      const p = byId.get(i.productId)!
      const variant = i.variantId ? variantsById.get(i.variantId) : undefined

      if (variant) {
        const variantPrice = p.sellingPrice + variant.additionalPrice
        const priceText = i.priceTextOverride ?? formatAmount(variantPrice, profile?.currencySymbol)
        const variantLabel = [variant.size, variant.color].filter(Boolean).join(' / ')
        return { productName: variantLabel ? `${p.productName} (${variantLabel})` : p.productName, barcode: i.barcodeOverride ?? variant.barcode!, priceText, copies: i.copies }
      }

      const printedPrice = p.sellByWeight ? (p.pricePerWeightUnit ?? 0) : p.sellingPrice
      if (!i.barcodeOverride) printedPrices.set(i.productId, printedPrice)
      const priceText = i.priceTextOverride ?? (p.sellByWeight
        ? (p.pricePerWeightUnit != null ? `${formatAmount(p.pricePerWeightUnit, profile?.currencySymbol)}/${p.weightUnit}` : null)
        : formatAmount(p.sellingPrice, profile?.currencySymbol))
      return { productName: p.productName, barcode: i.barcodeOverride ?? p.barcode!, priceText, copies: i.copies }
    })

    const html = await printService.generateLabelHtml({
      labels,
      outputMode,
      labelSizeMm: { width: Number(widthSetting?.settingValue ?? 40), height: Number(heightSetting?.settingValue ?? 30) },
      fields: { showPrice: fields?.showPrice ?? true, showBarcode: fields?.showBarcode ?? true, showName: fields?.showName ?? true },
      businessName: profile?.businessName ?? 'Business'
    })
    return { ok: true, html, items: items.map(i => ({ productId: i.productId, copies: i.copies })), printedPrices }
  }

  handle('print:labels', async (payload) => {
    const deny = await requirePermission('products.printLabels'); if (deny) return deny
    const built = await buildLabelHtml(payload)
    if (!built.ok) return built.res

    // A remembered Label Printer (Settings → Barcode & Loose Billing) prints
    // silently to that exact device, same convenience as Kitchen Printer —
    // added 2026-07-21 per founder request. Left unset, behaviour is
    // unchanged from before: the OS print dialog opens so the user picks a
    // printer (and can preview) every time.
    const labelPrinterSetting = await getPrisma().setting.findUnique({ where: { settingKey: 'label_printer_name' } })
    const labelDeviceName = labelPrinterSetting?.settingValue || undefined

    const tmpPath = join(app.getPath('temp'), `sarang_labels_${Date.now()}.html`)
    await writeFile(tmpPath, built.html, 'utf-8')
    const printed = await new Promise<boolean>((resolve) => {
      const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } })
      let settled = false
      const finish = (result: boolean) => {
        if (settled) return
        settled = true
        win.close()
        unlink(tmpPath).catch(() => {})
        resolve(result)
      }
      // A load failure (locked temp file, disk full) never fires did-finish-load,
      // which would otherwise hang this IPC call forever and leak the temp file —
      // guard both a hard load failure and a load that simply never completes.
      win.webContents.once('did-fail-load', () => finish(false))
      const loadTimeout = setTimeout(() => finish(false), 15000)
      win.loadFile(tmpPath)
      win.webContents.once('did-finish-load', () => {
        clearTimeout(loadTimeout)
        // Small delay lets the inline JsBarcode script render the SVG bars
        // before the print dialog captures the page.
        setTimeout(() => {
          win.webContents.print(
            labelDeviceName
              ? { silent: true, printBackground: true, deviceName: labelDeviceName }
              : { silent: false, printBackground: true },
            (success: boolean) => finish(success)
          )
        }, 200)
      })
    })

    if (printed) {
      await logAction({
        userId: getCurrentSession()?.userId,
        action: 'LABELS_PRINTED',
        entityType: 'Product',
        newValue: { productIds: built.items.map(i => i.productId), totalCopies: built.items.reduce((s, i) => s + i.copies, 0) }
      })
      // Record what price was actually printed, so a later price change can
      // warn the owner this product's shelf label is now stale. Best-effort —
      // a failure here must not undo an otherwise-successful print.
      try {
        const db = getPrisma()
        const now = new Date()
        await Promise.all(
          Array.from(built.printedPrices.entries()).map(([productId, price]) =>
            db.product.update({ where: { id: productId }, data: { lastLabelPrintedAt: now, lastLabelPrintedPrice: price } })
          )
        )
      } catch { /* best-effort */ }
    }
    return { success: printed, data: { printed } }
  })

  handle('print:previewLabels', async (payload) => {
    const deny = await requirePermission('products.view'); if (deny) return deny
    const built = await buildLabelHtml(payload)
    if (!built.ok) return built.res
    return { success: true, data: built.html }
  })

  handle('search:global', async (payload) => {
    const deny = await requireSession(); if (deny) return deny
    const { query } = (payload ?? {}) as { query?: string }
    if (!query?.trim() || query.trim().length < 2) return { success: true, data: { products: [], customers: [], suppliers: [], invoices: [] } }
    const q = query.trim()
    const db = getPrisma()

    // requireSession() alone only checks "is logged in" — it does NOT mean
    // the caller can see products/customers/suppliers/invoices. Without a
    // per-category check here, a role like Kitchen Staff (products.view +
    // inventory.view only — no customers.view, suppliers.view, or
    // billing.view, and no route access to those screens at all) could use
    // Ctrl+K to see the full customer list with phone numbers, supplier
    // contacts, and invoice totals — a permission bypass of the exact
    // categories those dedicated screens already gate.
    const [canProducts, canCustomers, canSuppliers, canInvoices] = await Promise.all([
      hasPermission('products.view'),
      hasPermission('customers.view'),
      hasPermission('suppliers.view'),
      hasPermission('billing.view')
    ])

    const [products, customers, suppliers, invoices] = await Promise.all([
      canProducts ? db.product.findMany({
        where: { isActive: true, OR: [{ productName: { contains: q } }, { sku: { contains: q } }] },
        select: { id: true, productName: true, sku: true, sellingPrice: true },
        take: 5
      }) : [],
      canCustomers ? db.customer.findMany({
        where: { isActive: true, OR: [{ customerName: { contains: q } }, { phone: { contains: q } }, { customerCode: { contains: q } }] },
        select: { id: true, customerName: true, phone: true, customerCode: true },
        take: 5
      }) : [],
      canSuppliers ? db.supplier.findMany({
        where: { isActive: true, OR: [{ supplierName: { contains: q } }, { phone: { contains: q } }] },
        select: { id: true, supplierName: true, phone: true },
        take: 5
      }) : [],
      canInvoices ? db.invoice.findMany({
        where: { invoiceType: { not: 'RETURN' }, OR: [{ invoiceNumber: { contains: q } }] },
        select: { id: true, invoiceNumber: true, totalAmount: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5
      }) : [],
    ])
    return { success: true, data: { products, customers, suppliers, invoices } }
  })
}
