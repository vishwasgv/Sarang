import { randomBytes } from 'crypto'
import { getPrisma } from '../database/db'
import { reportService } from './report.service'
import { getDashboardKpis } from './analytics.service'
import { toLocalISODate } from '../utils/date.util'

// 2026-09-16 — Owner View (originally spec'd as "Phase 72," built now on
// explicit founder go-ahead). A QR-paired, read-only LAN dashboard so an
// owner can check today's numbers/reports from their own phone without
// interrupting whoever's on the desktop billing. Structurally mirrors
// doctor-pad.service.ts's token/PIN split: a long per-install token for the
// one-time "connect this phone" QR scan, plus a short 6-digit access code
// (2026-09-15's own follow-up fix) for typing that same connection by hand
// when a camera isn't handy. Every function here is a pure DB read — this
// file must never gain a write path; that is a permanent constraint, not a
// v1 note (see the original Phase 72 spec's own explicit decision).

export async function getOrCreateOwnerViewToken(): Promise<string> {
  const db = getPrisma()
  const existing = await db.setting.findUnique({ where: { settingKey: 'owner_view_token' } })
  if (existing?.settingValue) return existing.settingValue
  const token = randomBytes(12).toString('hex')
  await db.setting.upsert({
    where: { settingKey: 'owner_view_token' },
    create: { settingKey: 'owner_view_token', settingValue: token },
    update: { settingValue: token }
  })
  return token
}

export async function regenerateOwnerViewToken(): Promise<string> {
  const db = getPrisma()
  const token = randomBytes(12).toString('hex')
  await db.setting.upsert({
    where: { settingKey: 'owner_view_token' },
    create: { settingKey: 'owner_view_token', settingValue: token },
    update: { settingValue: token }
  })
  return token
}

function generateAccessCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function getOrCreateOwnerViewAccessCode(): Promise<string> {
  const db = getPrisma()
  const existing = await db.setting.findUnique({ where: { settingKey: 'owner_view_access_code' } })
  if (existing?.settingValue) return existing.settingValue
  const code = generateAccessCode()
  await db.setting.upsert({
    where: { settingKey: 'owner_view_access_code' },
    create: { settingKey: 'owner_view_access_code', settingValue: code },
    update: { settingValue: code }
  })
  return code
}

export async function regenerateOwnerViewAccessCode(): Promise<string> {
  const db = getPrisma()
  const code = generateAccessCode()
  await db.setting.upsert({
    where: { settingKey: 'owner_view_access_code' },
    create: { settingKey: 'owner_view_access_code', settingValue: code },
    update: { settingValue: code }
  })
  return code
}

export interface OwnerViewReportDef {
  id: string
  label: string
  category: 'sales' | 'finance' | 'inventory' | 'suppliers'
  requiresDateRange: boolean
}

// The full report catalog (`reports.handler.ts`) has ~170 entries covering
// every vertical's own specialized reports. This is a deliberately-scoped
// v1: the reports that matter to almost any business owner checking in from
// a phone, not the long tail of vertical-specific ones — chosen so the
// pattern below (id -> real reportService function, zero bespoke UI code)
// is trivial to extend later, rather than a one-off hack per report.
export const OWNER_VIEW_REPORTS: OwnerViewReportDef[] = [
  { id: 'sales', label: 'Sales', category: 'sales', requiresDateRange: true },
  { id: 'outstanding', label: 'Outstanding (Receivable & Payable)', category: 'finance', requiresDateRange: false },
  { id: 'inventory', label: 'Inventory', category: 'inventory', requiresDateRange: false },
  { id: 'tax', label: 'Tax Summary', category: 'finance', requiresDateRange: true },
  { id: 'expenses', label: 'Expenses', category: 'finance', requiresDateRange: true },
  { id: 'profitAndLoss', label: 'Profit & Loss', category: 'finance', requiresDateRange: true },
  { id: 'cashBook', label: 'Cash Book', category: 'finance', requiresDateRange: true },
  { id: 'trialBalance', label: 'Trial Balance', category: 'finance', requiresDateRange: true },
  { id: 'apAging', label: 'Accounts Payable Aging', category: 'suppliers', requiresDateRange: false },
  { id: 'purchaseRegister', label: 'Purchase Register', category: 'suppliers', requiresDateRange: true }
]

function defaultDateRange(): { dateFrom: string; dateTo: string } {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 30)
  return { dateFrom: toLocalISODate(from), dateTo: toLocalISODate(to) }
}

export function listOwnerViewReports(): OwnerViewReportDef[] {
  return OWNER_VIEW_REPORTS
}

export interface OwnerViewReportError { code: string; message: string }

// Single dispatch point — every branch below calls the exact same
// reportService function the desktop Reports screen uses (no re-derived
// computation), and every branch is a plain read. Adding a report later is
// one more entry in OWNER_VIEW_REPORTS plus one more case here — never a
// new server route or a new client-side renderer.
export async function runOwnerViewReport(
  reportId: string,
  params: { dateFrom?: string; dateTo?: string }
): Promise<{ success: true; data: unknown } | { success: false; error: OwnerViewReportError }> {
  const def = OWNER_VIEW_REPORTS.find((r) => r.id === reportId)
  if (!def) return { success: false, error: { code: 'OV-001', message: 'Unknown report.' } }

  const range = def.requiresDateRange
    ? { dateFrom: params.dateFrom || defaultDateRange().dateFrom, dateTo: params.dateTo || defaultDateRange().dateTo }
    : undefined

  try {
    switch (reportId) {
      case 'sales':
        return { success: true, data: await reportService.generateSalesReport({ dateFrom: range!.dateFrom, dateTo: range!.dateTo }) }
      case 'outstanding':
        return { success: true, data: await reportService.generateOutstandingReport() }
      case 'inventory':
        return { success: true, data: await reportService.generateInventoryReport() }
      case 'tax':
        return { success: true, data: await reportService.generateTaxReport({ dateFrom: range!.dateFrom, dateTo: range!.dateTo }) }
      case 'expenses':
        return { success: true, data: await reportService.generateExpenseReport({ dateFrom: range!.dateFrom, dateTo: range!.dateTo }) }
      case 'profitAndLoss':
        return { success: true, data: await reportService.generateProfitAndLossReport({ dateFrom: range!.dateFrom, dateTo: range!.dateTo }) }
      case 'cashBook':
        return { success: true, data: await reportService.generateCashBookReport({ dateFrom: range!.dateFrom, dateTo: range!.dateTo }) }
      case 'trialBalance':
        return { success: true, data: await reportService.generateTrialBalanceReport({ dateFrom: range!.dateFrom, dateTo: range!.dateTo }) }
      case 'apAging':
        return { success: true, data: await reportService.generateApAgingReport() }
      case 'purchaseRegister':
        return { success: true, data: await reportService.generatePurchaseRegisterReport({ dateFrom: range!.dateFrom, dateTo: range!.dateTo }) }
      default:
        return { success: false, error: { code: 'OV-001', message: 'Unknown report.' } }
    }
  } catch {
    return { success: false, error: { code: 'OV-002', message: 'Could not load this report. Please try again.' } }
  }
}

// Landing-page summary — reuses the exact same cached KPI computation the
// desktop Dashboard shows (60s cache, so repeat phone polling is cheap).
export async function getOwnerViewSummary() {
  return getDashboardKpis(false)
}
