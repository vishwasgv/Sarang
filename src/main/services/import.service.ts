import { dialog, BrowserWindow } from 'electron'
import { readFileSync } from 'fs'
import { extname } from 'path'
import * as XLSX from 'xlsx'
import { getPrisma } from '../database/db'
import { ensureRecentBackup } from './backup.service'
import { logAction } from './audit.service'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImportModule = 'products' | 'customers' | 'suppliers' | 'inventory' | 'openingBalances'

export interface ImportField {
  key: string
  label: string
  required: boolean
  description?: string
}

export interface ImportPreviewRow {
  rowIndex: number
  status: 'valid' | 'invalid' | 'warning'
  errors: string[]
  warnings: string[]
  data: Record<string, unknown>
}

export interface ParseFileResult {
  sessionId: string
  headers: string[]
  preview: Record<string, string>[]
  totalRows: number
  suggestedMapping: Record<string, string>
  templateFields: ImportField[]
}

export interface PreviewResult {
  rows: ImportPreviewRow[]
  validCount: number
  invalidCount: number
  warningCount: number
  totalCount: number
}

export interface ImportResult {
  imported: number
  skipped: number
  failed: number
  warnings: number
  errors: Array<{ row: number; message: string }>
  backupCreated: boolean
  backupId?: string
}

// ─── Module field definitions ─────────────────────────────────────────────────

export const MODULE_FIELDS: Record<ImportModule, ImportField[]> = {
  products: [
    { key: 'productName', label: 'Product Name', required: true },
    { key: 'sku', label: 'SKU / Code', required: false },
    { key: 'barcode', label: 'Barcode', required: false },
    { key: 'hsnCode', label: 'HSN Code', required: false, description: 'For GST invoicing' },
    { key: 'categoryName', label: 'Category', required: false },
    { key: 'unit', label: 'Unit', required: false, description: 'PCS, KG, MTR, LTR, BOX, etc.' },
    { key: 'sellingPrice', label: 'Selling Price', required: true },
    { key: 'costPrice', label: 'Cost Price', required: false },
    { key: 'taxRate', label: 'Tax Rate %', required: false },
    { key: 'reorderLevel', label: 'Min Stock Level', required: false },
    { key: 'description', label: 'Description', required: false },
  ],
  customers: [
    { key: 'customerName', label: 'Customer Name', required: true },
    { key: 'phone', label: 'Phone', required: false },
    { key: 'email', label: 'Email', required: false },
    { key: 'address', label: 'Address', required: false },
    { key: 'creditLimit', label: 'Credit Limit', required: false },
    { key: 'taxNumber', label: 'Tax / GST Number', required: false },
    { key: 'notes', label: 'Notes', required: false },
  ],
  suppliers: [
    { key: 'supplierName', label: 'Supplier Name', required: true },
    { key: 'phone', label: 'Phone', required: false },
    { key: 'email', label: 'Email', required: false },
    { key: 'address', label: 'Address', required: false },
    { key: 'taxNumber', label: 'Tax Number', required: false },
    { key: 'notes', label: 'Notes', required: false },
  ],
  inventory: [
    { key: 'sku', label: 'Product SKU', required: true, description: 'Must match an existing product SKU' },
    { key: 'quantity', label: 'Quantity', required: true },
    { key: 'unitCost', label: 'Cost per Unit', required: false, description: 'Used to (re)calculate average cost for inventory valuation' },
    { key: 'reason', label: 'Reason', required: false },
  ],
  openingBalances: [
    { key: 'customerName', label: 'Customer Name', required: false, description: 'Used to find the customer' },
    { key: 'phone', label: 'Phone', required: false, description: 'Alternate customer lookup' },
    { key: 'amount', label: 'Amount', required: true },
    { key: 'type', label: 'Type (DR / CR)', required: false, description: 'DR = customer owes you, CR = you owe customer. Default: DR' },
    { key: 'notes', label: 'Notes', required: false },
  ],
}

// ─── Session store ────────────────────────────────────────────────────────────

interface ImportSession {
  module: ImportModule
  headers: string[]
  rows: Record<string, string>[]
  createdAt: number
}

const sessions = new Map<string, ImportSession>()

// Per-module caps from docs/DATA_IMPORT_AND_MIGRATION_SPEC.md's "IMPORT BATCH
// SIZE LIMITS" table — must stay in sync with that table.
const MAX_IMPORT_ROWS: Record<ImportModule, number> = {
  products: 10_000,
  customers: 10_000,
  suppliers: 5_000,
  inventory: 50_000,
  openingBalances: 10_000,
}

const MODULE_LABELS: Record<ImportModule, string> = {
  products: 'Products',
  customers: 'Customers',
  suppliers: 'Suppliers',
  inventory: 'Inventory',
  openingBalances: 'Opening Balances',
}

function makeSessionId(): string {
  return `imp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function cleanOldSessions(): void {
  const cutoff = Date.now() - 30 * 60 * 1000
  for (const [id, s] of sessions) {
    if (s.createdAt < cutoff) sessions.delete(id)
  }
}

// ─── CSV parser ───────────────────────────────────────────────────────────────
//
// Tokenizes the whole file character-by-character so that a newline inside a
// quoted field (e.g. a multi-line address exported from Excel) does not split
// that field into a broken row — a plain split-then-parse-per-line approach
// (the previous implementation) corrupts every row after the first embedded
// newline it hits.

function tokenizeCSV(content: string): string[][] {
  const table: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]

    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') { inQuotes = true; continue }
    if (ch === ',') { row.push(field.trim()); field = ''; continue }
    if (ch === '\r') continue
    if (ch === '\n') {
      row.push(field.trim())
      table.push(row)
      row = []
      field = ''
      continue
    }
    field += ch
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim())
    table.push(row)
  }

  return table.filter(r => r.some(v => v !== ''))
}

function parseCSV(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const clean = content.replace(/^﻿/, '')
  const table = tokenizeCSV(clean)
  if (table.length === 0) return { headers: [], rows: [] }
  const headers = table[0]
  const rows: Record<string, string>[] = []
  for (let i = 1; i < table.length; i++) {
    const values = table[i]
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = (values[idx] ?? '').trim() })
    rows.push(row)
  }
  return { headers, rows }
}

// ─── Excel parser ─────────────────────────────────────────────────────────────

function parseExcel(filePath: string): { headers: string[]; rows: Record<string, string>[] } {
  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }) as unknown[][]
  if (raw.length === 0) return { headers: [], rows: [] }
  const headers = (raw[0] as unknown[]).map(h => String(h ?? '').trim()).filter(h => h.length > 0)
  const rows: Record<string, string>[] = []
  for (let i = 1; i < raw.length; i++) {
    const values = raw[i] as unknown[]
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      const val = values[idx]
      row[h] = val !== null && val !== undefined ? String(val).trim() : ''
    })
    if (Object.values(row).some(v => v !== '')) rows.push(row)
  }
  return { headers, rows }
}

// ─── Auto-mapper ──────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function autoMap(headers: string[], fields: ImportField[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  for (const header of headers) {
    const h = norm(header)
    const match = fields.find(f => norm(f.key) === h || norm(f.label) === h)
    if (match) mapping[header] = match.key
  }
  return mapping
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function getMapped(row: Record<string, string>, mapping: Record<string, string>, fieldKey: string): string {
  const header = Object.entries(mapping).find(([, v]) => v === fieldKey)?.[0]
  return header ? (row[header] ?? '').trim() : ''
}

function parseNum(s: string, fallback = 0): number {
  const n = parseFloat(s.replace(/,/g, ''))
  return isNaN(n) ? fallback : n
}

// ─── Row validators ───────────────────────────────────────────────────────────

function validateProductRow(row: Record<string, string>, mapping: Record<string, string>): { errors: string[]; warnings: string[]; data: Record<string, unknown> } {
  const errors: string[] = []
  const warnings: string[] = []

  const productName = getMapped(row, mapping, 'productName')
  const sellingPriceRaw = getMapped(row, mapping, 'sellingPrice')
  const costPriceRaw = getMapped(row, mapping, 'costPrice')
  const taxRateRaw = getMapped(row, mapping, 'taxRate')
  const reorderLevelRaw = getMapped(row, mapping, 'reorderLevel')

  if (!productName) errors.push('Product Name is required')

  let sellingPrice = 0
  if (!sellingPriceRaw) {
    errors.push('Selling Price is required')
  } else {
    sellingPrice = parseNum(sellingPriceRaw)
    if (isNaN(parseFloat(sellingPriceRaw))) errors.push(`Selling Price "${sellingPriceRaw}" is not a valid number`)
    else if (sellingPrice < 0) errors.push('Selling Price cannot be negative')
  }

  let costPrice = 0
  if (costPriceRaw) {
    costPrice = parseNum(costPriceRaw)
    if (isNaN(parseFloat(costPriceRaw))) warnings.push(`Cost Price "${costPriceRaw}" is not valid — will be set to 0`)
    else if (costPrice < 0) { warnings.push('Cost Price is negative — will be set to 0'); costPrice = 0 }
  }

  let taxRate = 0
  if (taxRateRaw) {
    taxRate = parseNum(taxRateRaw)
    if (isNaN(parseFloat(taxRateRaw))) warnings.push(`Tax Rate "${taxRateRaw}" is not valid — will be set to 0%`)
    else if (taxRate < 0 || taxRate > 100) { warnings.push(`Tax Rate ${taxRate}% out of range — clamped to 0-100`); taxRate = Math.min(100, Math.max(0, taxRate)) }
  }

  let reorderLevel = 0
  if (reorderLevelRaw) {
    reorderLevel = parseNum(reorderLevelRaw)
    if (reorderLevel < 0) { warnings.push('Min Stock Level is negative — will be set to 0'); reorderLevel = 0 }
  }

  return {
    errors,
    warnings,
    data: {
      productName,
      sku: getMapped(row, mapping, 'sku') || null,
      barcode: getMapped(row, mapping, 'barcode') || null,
      hsnCode: getMapped(row, mapping, 'hsnCode') || null,
      categoryName: getMapped(row, mapping, 'categoryName') || null,
      unit: getMapped(row, mapping, 'unit') || 'PCS',
      sellingPrice,
      costPrice,
      taxRate,
      reorderLevel,
      description: getMapped(row, mapping, 'description') || null,
    }
  }
}

function validateCustomerRow(row: Record<string, string>, mapping: Record<string, string>): { errors: string[]; warnings: string[]; data: Record<string, unknown> } {
  const errors: string[] = []
  const warnings: string[] = []

  const customerName = getMapped(row, mapping, 'customerName')
  const creditLimitRaw = getMapped(row, mapping, 'creditLimit')

  if (!customerName) errors.push('Customer Name is required')

  let creditLimit = 0
  if (creditLimitRaw) {
    creditLimit = parseNum(creditLimitRaw)
    if (isNaN(parseFloat(creditLimitRaw))) warnings.push(`Credit Limit "${creditLimitRaw}" is not valid — will be set to 0`)
    else if (creditLimit < 0) { warnings.push('Credit Limit is negative — will be set to 0'); creditLimit = 0 }
  }

  return {
    errors,
    warnings,
    data: {
      customerName,
      phone: getMapped(row, mapping, 'phone') || null,
      email: getMapped(row, mapping, 'email') || null,
      address: getMapped(row, mapping, 'address') || null,
      creditLimit,
      taxNumber: getMapped(row, mapping, 'taxNumber') || null,
      notes: getMapped(row, mapping, 'notes') || null,
    }
  }
}

function validateSupplierRow(row: Record<string, string>, mapping: Record<string, string>): { errors: string[]; warnings: string[]; data: Record<string, unknown> } {
  const errors: string[] = []
  const supplierName = getMapped(row, mapping, 'supplierName')
  if (!supplierName) errors.push('Supplier Name is required')
  return {
    errors,
    warnings: [],
    data: {
      supplierName,
      phone: getMapped(row, mapping, 'phone') || null,
      email: getMapped(row, mapping, 'email') || null,
      address: getMapped(row, mapping, 'address') || null,
      taxNumber: getMapped(row, mapping, 'taxNumber') || null,
      notes: getMapped(row, mapping, 'notes') || null,
    }
  }
}

function validateInventoryRow(row: Record<string, string>, mapping: Record<string, string>): { errors: string[]; warnings: string[]; data: Record<string, unknown> } {
  const errors: string[] = []
  const warnings: string[] = []

  const sku = getMapped(row, mapping, 'sku')
  const quantityRaw = getMapped(row, mapping, 'quantity')
  const unitCostRaw = getMapped(row, mapping, 'unitCost')

  if (!sku) errors.push('Product SKU is required')

  let quantity = 0
  if (!quantityRaw) {
    errors.push('Quantity is required')
  } else {
    quantity = parseNum(quantityRaw)
    if (isNaN(parseFloat(quantityRaw))) errors.push(`Quantity "${quantityRaw}" is not a valid number`)
    else if (quantity <= 0) errors.push('Quantity must be greater than 0')
  }

  let unitCost: number | undefined
  if (unitCostRaw) {
    unitCost = parseNum(unitCostRaw)
    if (isNaN(parseFloat(unitCostRaw))) { warnings.push(`Cost per Unit "${unitCostRaw}" is not valid — average cost will not be updated`); unitCost = undefined }
    else if (unitCost < 0) { warnings.push('Cost per Unit is negative — average cost will not be updated'); unitCost = undefined }
  } else {
    warnings.push('No Cost per Unit given — inventory valuation (average cost) will not reflect this stock')
  }

  return {
    errors,
    warnings,
    data: {
      sku,
      quantity,
      unitCost,
      reason: getMapped(row, mapping, 'reason') || 'Opening Stock Import',
    }
  }
}

function validateOpeningBalanceRow(row: Record<string, string>, mapping: Record<string, string>): { errors: string[]; warnings: string[]; data: Record<string, unknown> } {
  const errors: string[] = []
  const warnings: string[] = []

  const customerName = getMapped(row, mapping, 'customerName')
  const phone = getMapped(row, mapping, 'phone')
  const amountRaw = getMapped(row, mapping, 'amount')
  const type = getMapped(row, mapping, 'type').toUpperCase() || 'DR'

  if (!customerName && !phone) errors.push('Either Customer Name or Phone is required to identify the customer')

  let amount = 0
  if (!amountRaw) {
    errors.push('Amount is required')
  } else {
    amount = parseNum(amountRaw)
    if (isNaN(parseFloat(amountRaw))) errors.push(`Amount "${amountRaw}" is not valid`)
    else if (amount <= 0) errors.push('Amount must be greater than 0')
  }

  if (type && type !== 'DR' && type !== 'CR') {
    warnings.push(`Type "${type}" is not recognized — defaulting to DR`)
  }

  return {
    errors,
    warnings,
    data: {
      customerName: customerName || null,
      phone: phone || null,
      amount,
      type: (type === 'CR') ? 'CR' : 'DR',
      notes: getMapped(row, mapping, 'notes') || 'Opening Balance',
    }
  }
}

function validateRow(module: ImportModule, row: Record<string, string>, mapping: Record<string, string>): { errors: string[]; warnings: string[]; data: Record<string, unknown> } {
  switch (module) {
    case 'products': return validateProductRow(row, mapping)
    case 'customers': return validateCustomerRow(row, mapping)
    case 'suppliers': return validateSupplierRow(row, mapping)
    case 'inventory': return validateInventoryRow(row, mapping)
    case 'openingBalances': return validateOpeningBalanceRow(row, mapping)
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

function loadFileAtPath(module: ImportModule, filePath: string): {
  success: boolean; data?: ParseFileResult; error?: { code: string; message: string }
} {
  const ext = extname(filePath).toLowerCase()
  let headers: string[]
  let rows: Record<string, string>[]

  if (ext === '.csv') {
    const content = readFileSync(filePath, 'utf8')
    ;({ headers, rows } = parseCSV(content))
  } else if (ext === '.xlsx') {
    ;({ headers, rows } = parseExcel(filePath))
  } else {
    return { success: false, error: { code: 'IMP-001', message: 'Unsupported file type. Please use CSV or Excel (.xlsx).' } }
  }

  if (headers.length === 0 || rows.length === 0) {
    return { success: false, error: { code: 'IMP-002', message: 'The file appears empty or has no data rows.' } }
  }

  const maxRows = MAX_IMPORT_ROWS[module]
  if (rows.length > maxRows) {
    return {
      success: false,
      error: {
        code: 'IMP-003',
        message: `This file has ${rows.length.toLocaleString()} rows, which exceeds the maximum of ${maxRows.toLocaleString()} rows per import for ${MODULE_LABELS[module]}. Please split it into smaller files.`
      }
    }
  }

  cleanOldSessions()

  const sessionId = makeSessionId()
  sessions.set(sessionId, { module, headers, rows, createdAt: Date.now() })

  const fields = MODULE_FIELDS[module]
  return {
    success: true,
    data: {
      sessionId,
      headers,
      preview: rows.slice(0, 10),
      totalRows: rows.length,
      suggestedMapping: autoMap(headers, fields),
      templateFields: fields,
    }
  }
}

export async function parseFile(module: ImportModule): Promise<{
  success: boolean; data?: ParseFileResult; error?: { code: string; message: string }
}> {
  try {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Select Import File',
      filters: [
        { name: 'Data Files', extensions: ['csv', 'xlsx'] },
        { name: 'CSV', extensions: ['csv'] },
        { name: 'Excel', extensions: ['xlsx'] }
      ],
      properties: ['openFile']
    })

    if (canceled || !filePaths.length) {
      return { success: false, error: { code: 'IMP-000', message: 'No file selected.' } }
    }

    return loadFileAtPath(module, filePaths[0])
  } catch (err) {
    return { success: false, error: { code: 'IMP-099', message: err instanceof Error ? err.message : 'Failed to read file.' } }
  }
}

// Drag-and-drop entry point — the renderer resolves the dropped File object to
// a real filesystem path via webUtils.getPathForFile() (exposed in preload)
// and hands us just the path, so this reuses the exact same parser/validation
// path as the Browse-File dialog instead of duplicating it.
export async function parseDroppedFile(module: ImportModule, filePath: string): Promise<{
  success: boolean; data?: ParseFileResult; error?: { code: string; message: string }
}> {
  try {
    if (!filePath) return { success: false, error: { code: 'IMP-000', message: 'No file selected.' } }
    return loadFileAtPath(module, filePath)
  } catch (err) {
    return { success: false, error: { code: 'IMP-099', message: err instanceof Error ? err.message : 'Failed to read file.' } }
  }
}

export async function validatePreview(
  sessionId: string,
  mapping: Record<string, string>,
  module: ImportModule
): Promise<{ success: boolean; data?: PreviewResult; error?: { code: string; message: string } }> {
  try {
    const session = sessions.get(sessionId)
    if (!session) return { success: false, error: { code: 'IMP-010', message: 'Import session not found. Please re-upload your file.' } }

    const previewRows = session.rows.slice(0, 20)
    const results: ImportPreviewRow[] = []

    // Pre-load data for DB-dependent validations
    const db = getPrisma()
    const existingSkus = new Set<string>()
    const existingBarcodes = new Set<string>()
    const existingPhones = new Set<string>()
    const existingSupplierNames = new Set<string>()
    let customersForLookup: { id: string; customerName: string; phone: string | null }[] = []

    if (module === 'products' || module === 'inventory') {
      const products = await db.product.findMany({ select: { sku: true, barcode: true } })
      products.forEach(p => {
        if (p.sku) existingSkus.add(p.sku.toLowerCase())
        if (p.barcode) existingBarcodes.add(p.barcode.toLowerCase())
      })
    }
    if (module === 'customers' || module === 'openingBalances') {
      // Scoped to active customers only, matching customer.service.ts's C001
      // rule (phone uniqueness is only enforced among active customers, so an
      // archived customer's phone is free to be reused). Without this filter,
      // a phone shared between an archived and an active customer could
      // resolve an Opening Balance row to the wrong one, or the 'customers'
      // dedupe could wrongly block re-using a phone the app itself allows.
      customersForLookup = await db.customer.findMany({ where: { isActive: true }, select: { id: true, customerName: true, phone: true } })
      customersForLookup.forEach(c => { if (c.phone) existingPhones.add(c.phone) })
    }
    if (module === 'suppliers') {
      const suppliers = await db.supplier.findMany({ select: { supplierName: true } })
      suppliers.forEach(s => existingSupplierNames.add(s.supplierName.toLowerCase()))
    }

    // These sets are mutated as we walk the sampled rows (mirroring what
    // executeImport does row-by-row) so that two rows in the SAME file with
    // the same SKU/barcode/phone/supplier name are correctly flagged against
    // each other, not just against the DB snapshot taken before this preview
    // ran. Without this, row 2 and row 7 of the same file sharing a SKU both
    // showed "Valid" here while execute silently skipped the second one.
    for (let i = 0; i < previewRows.length; i++) {
      const { errors, warnings, data } = validateRow(module, previewRows[i], mapping)
      const rowWarnings = [...warnings]

      // DB-level checks: duplicates cause actual skip during execute, non-duplicate issues are errors
      let willSkip = false
      if (module === 'products') {
        const sku = (data.sku as string | null)?.toLowerCase()
        if (sku && existingSkus.has(sku)) { rowWarnings.push(`SKU "${data.sku}" already exists — this row will be skipped`); willSkip = true }
        const barcode = (data.barcode as string | null)?.toLowerCase()
        if (!willSkip && barcode && existingBarcodes.has(barcode)) { rowWarnings.push(`Barcode "${data.barcode}" already exists — this row will be skipped`); willSkip = true }
        if (errors.length === 0 && !willSkip) {
          if (sku) existingSkus.add(sku)
          if (barcode) existingBarcodes.add(barcode)
        }
      }
      if (module === 'customers') {
        const phone = data.phone as string | null
        if (phone && existingPhones.has(phone)) { rowWarnings.push(`Phone "${phone}" already exists — this row will be skipped`); willSkip = true }
        if (errors.length === 0 && !willSkip && phone) existingPhones.add(phone)
      }
      if (module === 'suppliers') {
        const name = (data.supplierName as string)?.toLowerCase()
        if (name && existingSupplierNames.has(name)) { rowWarnings.push(`Supplier "${data.supplierName}" already exists — this row will be skipped`); willSkip = true }
        if (errors.length === 0 && !willSkip && name) existingSupplierNames.add(name)
      }
      if (module === 'inventory') {
        const sku = (data.sku as string)?.toLowerCase()
        if (sku && !existingSkus.has(sku)) errors.push(`No product found with SKU "${data.sku}"`)
      }
      if (module === 'openingBalances') {
        const phone = data.phone as string | null
        const customerName = data.customerName as string | null
        if (phone && existingPhones.has(phone)) {
          // found by phone — resolvable, no error
        } else if (customerName) {
          const matches = customersForLookup.filter(c => c.customerName.toLowerCase() === customerName.toLowerCase())
          if (matches.length === 0) errors.push(`Customer not found: "${customerName}"`)
          else if (matches.length > 1) errors.push(`Multiple customers named "${customerName}" found — add Phone to identify the correct one`)
        } else if (phone) {
          errors.push(`Customer not found: "${phone}"`)
        }
      }

      // 'warning' only when the row will truly be skipped (duplicate). Format-only warnings keep 'valid'.
      const status = errors.length > 0 ? 'invalid' : willSkip ? 'warning' : 'valid'
      results.push({ rowIndex: i + 2, status, errors, warnings: rowWarnings, data })
    }

    const validCount = results.filter(r => r.status === 'valid').length
    const warningCount = results.filter(r => r.status === 'warning').length
    const invalidCount = results.filter(r => r.status === 'invalid').length

    return { success: true, data: { rows: results, validCount, warningCount, invalidCount, totalCount: session.rows.length } }
  } catch (err) {
    return { success: false, error: { code: 'IMP-099', message: err instanceof Error ? err.message : 'Preview validation failed.' } }
  }
}

export async function executeImport(
  sessionId: string,
  mapping: Record<string, string>,
  module: ImportModule,
  userId?: string
): Promise<{ success: boolean; data?: ImportResult; error?: { code: string; message: string } }> {
  try {
    const session = sessions.get(sessionId)
    if (!session) return { success: false, error: { code: 'IMP-010', message: 'Import session not found. Please re-upload your file.' } }

    const db = getPrisma()
    const win = BrowserWindow.getAllWindows()[0]

    // RULE IMP001 — guarantee a recovery point exists before every import
    // (not just large ones). A 45-row opening-balance import with a mapping
    // mistake writes real, irreversible ledger entries just as surely as a
    // 5,000-row one — there is no size below which skipping the safety net
    // is fine. But forcing a brand-new backup on literally every execute call
    // would tax even a 2-row import with a full VACUUM INTO + double-SHA256 +
    // ZIP pass, and would burn through the retention policy's limited slots
    // with near-duplicate backups during a session of repeated small imports
    // — so this reuses any backup already made in the last 15 minutes instead
    // of always creating a fresh one.
    const bk = await ensureRecentBackup(userId)
    if (!bk.success) {
      return { success: false, error: { code: 'IMP-011', message: 'Could not create safety backup before import. Aborting to protect your data.' } }
    }
    const backupCreated = true
    const backupId = bk.data?.id

    win?.webContents.send('import:progress', { processed: 0, total: session.rows.length })

    let imported = 0
    let skipped = 0
    let failed = 0
    let warnings = 0
    const errors: Array<{ row: number; message: string }> = []

    // Pre-fetch lookup data
    const existingProducts = await db.product.findMany({ select: { id: true, sku: true, barcode: true } })
    const skuToId = new Map(existingProducts.filter(p => p.sku).map(p => [p.sku!.toLowerCase(), p.id]))
    const existingSkus = new Set(existingProducts.filter(p => p.sku).map(p => p.sku!.toLowerCase()))
    const existingBarcodes = new Set(existingProducts.filter(p => p.barcode).map(p => p.barcode!.toLowerCase()))

    // Scoped to active customers only — see the matching comment in
    // validatePreview. Keeps this consistent with C001 (phone uniqueness is
    // only enforced among active customers) and avoids resolving a Customers
    // dedupe or an Opening Balances row onto an archived customer.
    const existingCustomers = await db.customer.findMany({ where: { isActive: true }, select: { id: true, customerName: true, phone: true } })
    const phoneToCustomerId = new Map(existingCustomers.filter(c => c.phone).map(c => [c.phone!, c.id]))
    const existingPhones = new Set(existingCustomers.filter(c => c.phone).map(c => c.phone!))

    const existingSuppliers = await db.supplier.findMany({ select: { supplierName: true } })
    const existingSupplierNames = new Set(existingSuppliers.map(s => s.supplierName.toLowerCase()))

    const existingCategories = await db.productCategory.findMany({ select: { id: true, name: true } })
    const categoryNameToId = new Map(existingCategories.map(c => [c.name.toLowerCase(), c.id]))

    // Process in batches of 100
    const BATCH = 100
    for (let batchStart = 0; batchStart < session.rows.length; batchStart += BATCH) {
      const batch = session.rows.slice(batchStart, batchStart + BATCH)

      for (let i = 0; i < batch.length; i++) {
        const rowNum = batchStart + i + 2
        const row = batch[i]

        try {
          const { errors: rowErrors, warnings: rowWarnings, data } = validateRow(module, row, mapping)

          if (rowErrors.length > 0) {
            failed++
            errors.push({ row: rowNum, message: rowErrors.join('; ') })
            continue
          }
          if (rowWarnings.length > 0) warnings++

          // ── Products ──────────────────────────────────────────────────────────
          if (module === 'products') {
            const sku = (data.sku as string | null)?.toLowerCase()
            if (sku && existingSkus.has(sku)) { skipped++; continue }
            const barcode = (data.barcode as string | null)?.toLowerCase()
            if (barcode && existingBarcodes.has(barcode)) { skipped++; continue }

            let categoryId: string | null = null
            if (data.categoryName) {
              const catKey = (data.categoryName as string).toLowerCase()
              if (categoryNameToId.has(catKey)) {
                categoryId = categoryNameToId.get(catKey)!
              } else {
                const newCat = await db.productCategory.create({ data: { name: data.categoryName as string } })
                categoryId = newCat.id
                categoryNameToId.set(catKey, newCat.id)
              }
            }

            const product = await db.product.create({
              data: {
                productName: data.productName as string,
                sku: data.sku as string | null,
                barcode: data.barcode as string | null,
                hsnCode: data.hsnCode as string | null,
                categoryId,
                unit: data.unit as string,
                sellingPrice: data.sellingPrice as number,
                costPrice: data.costPrice as number,
                taxRate: data.taxRate as number,
                description: data.description as string | null,
              }
            })

            // Imported products are always STANDARD (no productType column in this
            // import) and must get an Inventory row unconditionally, the same as
            // product.service.ts's createProduct does — gating this on
            // reorderLevel > 0 left any product imported with reorderLevel blank/0
            // (the common case) with no Inventory row at all, making it permanently
            // un-stockable: Adjust Stock and PO receiving both require one to exist.
            await db.inventory.upsert({
              where: { productId: product.id },
              create: { productId: product.id, quantity: 0, reorderLevel: (data.reorderLevel as number) ?? 0 },
              update: { reorderLevel: (data.reorderLevel as number) ?? 0 }
            })

            if (sku) existingSkus.add(sku)
            if (barcode) existingBarcodes.add(barcode)
            imported++
          }

          // ── Customers ─────────────────────────────────────────────────────────
          else if (module === 'customers') {
            const phone = data.phone as string | null
            if (phone && existingPhones.has(phone)) { skipped++; continue }

            await db.customer.create({
              data: {
                customerName: data.customerName as string,
                phone,
                email: data.email as string | null,
                address: data.address as string | null,
                creditLimit: data.creditLimit as number,
                taxNumber: data.taxNumber as string | null,
                notes: data.notes as string | null,
              }
            })

            if (phone) existingPhones.add(phone)
            imported++
          }

          // ── Suppliers ─────────────────────────────────────────────────────────
          else if (module === 'suppliers') {
            const nameKey = (data.supplierName as string).toLowerCase()
            if (existingSupplierNames.has(nameKey)) { skipped++; continue }

            await db.supplier.create({
              data: {
                supplierName: data.supplierName as string,
                phone: data.phone as string | null,
                email: data.email as string | null,
                address: data.address as string | null,
                taxNumber: data.taxNumber as string | null,
                notes: data.notes as string | null,
              }
            })

            existingSupplierNames.add(nameKey)
            imported++
          }

          // ── Inventory ─────────────────────────────────────────────────────────
          else if (module === 'inventory') {
            const skuKey = (data.sku as string).toLowerCase()
            const productId = skuToId.get(skuKey)

            if (!productId) {
              failed++
              errors.push({ row: rowNum, message: `No product found with SKU "${data.sku}"` })
              continue
            }

            const qty = data.quantity as number
            const unitCost = data.unitCost as number | undefined

            await db.$transaction(async (tx) => {
              const existing = await tx.inventory.findUnique({ where: { productId } })

              // RULE I007 — recalculate the weighted average cost the same way
              // addStockTx does, so bulk-imported opening stock carries a real
              // cost basis instead of silently defaulting to 0.
              let newAvgCost = existing?.averageCost ?? 0
              if (unitCost !== undefined && unitCost >= 0) {
                const currentQty = existing?.quantity ?? 0
                const currentAvgCost = existing?.averageCost ?? 0
                const totalValue = (currentQty * currentAvgCost) + (qty * unitCost)
                const totalQty = currentQty + qty
                newAvgCost = totalQty > 0 ? totalValue / totalQty : unitCost
              }

              await tx.inventoryMovement.create({
                data: {
                  productId,
                  movementType: 'ADDITION',
                  quantity: qty,
                  referenceType: 'IMPORT',
                  remarks: data.reason as string,
                  createdById: userId ?? null,
                }
              })
              await tx.inventory.upsert({
                where: { productId },
                create: { productId, quantity: qty, averageCost: newAvgCost },
                update: { quantity: { increment: qty }, averageCost: newAvgCost }
              })
            })

            imported++
          }

          // ── Opening Balances ──────────────────────────────────────────────────
          else if (module === 'openingBalances') {
            const customerName = data.customerName as string | null
            const phone = data.phone as string | null

            let customerId: string | null = null

            if (phone && phoneToCustomerId.has(phone)) {
              customerId = phoneToCustomerId.get(phone)!
            } else if (customerName) {
              // Customer.customerName is not unique — picking the first match
              // silently would risk posting an opening balance onto the wrong
              // customer whenever two share a name (common with names like
              // "Ramesh Kumar"). Require Phone to disambiguate instead.
              const matches = existingCustomers.filter(c =>
                c.customerName.toLowerCase() === customerName.toLowerCase()
              )
              if (matches.length === 1) {
                customerId = matches[0].id
              } else if (matches.length > 1) {
                failed++
                errors.push({ row: rowNum, message: `Multiple customers named "${customerName}" found — add Phone to identify the correct one` })
                continue
              }
            }

            if (!customerId) {
              failed++
              errors.push({ row: rowNum, message: `Customer not found: "${customerName ?? phone}"` })
              continue
            }

            const amount = data.amount as number
            const type = data.type as 'DR' | 'CR'

            const last = await db.customerLedger.findFirst({
              where: { customerId },
              orderBy: { createdAt: 'desc' },
              select: { balance: true }
            })

            const prevBalance = last?.balance ?? 0
            const newBalance = type === 'DR' ? prevBalance + amount : prevBalance - amount

            await db.$transaction([
              db.customerLedger.create({
                data: {
                  customerId,
                  referenceType: 'OPENING_BALANCE',
                  debitAmount: type === 'DR' ? amount : 0,
                  creditAmount: type === 'CR' ? amount : 0,
                  balance: newBalance,
                  remarks: data.notes as string,
                }
              }),
              db.customer.update({
                where: { id: customerId },
                data: { outstandingBalance: newBalance }
              })
            ])

            imported++
          }

        } catch (rowErr) {
          failed++
          errors.push({ row: rowNum, message: rowErr instanceof Error ? rowErr.message : 'Row import failed.' })
        }
      }

      // Report progress after each batch so a large import doesn't look frozen
      win?.webContents.send('import:progress', {
        processed: Math.min(batchStart + BATCH, session.rows.length),
        total: session.rows.length
      })
    }

    // Audit log
    await logAction({
      userId,
      action: 'DATA_IMPORTED',
      entityType: 'Import',
      newValue: { module, imported, skipped, failed, totalRows: session.rows.length }
    })

    // Clean up session
    sessions.delete(sessionId)

    win?.webContents.send('import:complete', { imported, skipped, failed })

    return {
      success: true,
      data: { imported, skipped, failed, warnings, errors, backupCreated, backupId }
    }
  } catch (err) {
    return { success: false, error: { code: 'IMP-099', message: err instanceof Error ? err.message : 'Import failed unexpectedly.' } }
  }
}

export async function downloadTemplate(module: ImportModule): Promise<{
  success: boolean; error?: { code: string; message: string }
}> {
  try {
    const fields = MODULE_FIELDS[module]
    const headers = fields.map(f => f.label + (f.required ? ' *' : ''))
    const exampleRows = getTemplateExamples(module, fields)

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows])

    // Column widths
    ws['!cols'] = headers.map(() => ({ wch: 20 }))

    XLSX.utils.book_append_sheet(wb, ws, 'Import Template')

    const moduleNames: Record<ImportModule, string> = {
      products: 'Products',
      customers: 'Customers',
      suppliers: 'Suppliers',
      inventory: 'Inventory',
      openingBalances: 'OpeningBalances'
    }

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Save Import Template',
      defaultPath: `Sarang_${moduleNames[module]}_Import_Template.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })

    if (canceled || !filePath) {
      return { success: false, error: { code: 'IMP-000', message: 'Save cancelled.' } }
    }

    XLSX.writeFile(wb, filePath)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'IMP-099', message: err instanceof Error ? err.message : 'Failed to generate template.' } }
  }
}

function getTemplateExamples(module: ImportModule, fields: ImportField[]): string[][] {
  const examples: Record<ImportModule, string[][]> = {
    products: [
      ['Basmati Rice 5kg', 'RICE-001', '', '10062000', 'Groceries', 'KG', '250', '200', '5', '10', 'Premium quality basmati rice'],
      ['Sugar 1kg', 'SUGAR-001', '', '17019900', 'Groceries', 'KG', '45', '40', '0', '20', ''],
    ],
    customers: [
      ['Ramesh Kumar', '9876543210', 'ramesh@email.com', '123 MG Road, Bangalore', '5000', '29ABCDE1234F1Z5', ''],
      ['Priya Sharma', '9123456789', '', 'Mumbai', '0', '', 'Regular customer'],
    ],
    suppliers: [
      ['Agarwal Traders', '9001234567', 'agarwal@traders.com', 'Delhi', '07AAAAA0000A1Z5', ''],
      ['Sunrise Foods', '9112233445', '', 'Chennai', '', 'Bulk supplier'],
    ],
    inventory: [
      ['RICE-001', '100', '200', 'Opening Stock'],
      ['SUGAR-001', '50', '40', 'Opening Stock'],
    ],
    openingBalances: [
      ['Ramesh Kumar', '9876543210', '5000', 'DR', 'Opening balance as on date'],
      ['Priya Sharma', '9123456789', '2500', 'CR', ''],
    ],
  }
  const rows = examples[module] ?? [fields.map(() => '')]

  // Defensive: force every example row to the current field count. This is
  // exactly the class of bug that once shifted "Opening Stock" into the
  // Cost per Unit column after `unitCost` was added to MODULE_FIELDS.inventory
  // without the example row above being updated to match — if that drift
  // happens again, rows get padded/truncated instead of silently misaligning.
  return rows.map(row => {
    if (row.length === fields.length) return row
    const fixed = row.slice(0, fields.length)
    while (fixed.length < fields.length) fixed.push('')
    return fixed
  })
}

// Single source of truth for "what columns does this module expect" — the
// renderer fetches this instead of keeping its own hardcoded copy, so the
// on-screen field guide can never drift out of sync with MODULE_FIELDS again
// (it previously did: a `unitCost` field was added here without the frontend's
// separate hardcoded list ever being updated to mention it).
export function getModuleFields(module: ImportModule): { success: boolean; data?: ImportField[] } {
  return { success: true, data: MODULE_FIELDS[module] }
}
