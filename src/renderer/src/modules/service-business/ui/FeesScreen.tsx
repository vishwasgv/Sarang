import { useEffect, useState, useCallback } from 'react'
import { api } from '@renderer/services/ipc-client'
import { Zap, CheckCircle, XCircle, Edit2, Printer } from 'lucide-react'
import { aszurexFooterHtml } from '@shared/utils/print-branding'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'

interface FeeEnrollment {
  student: { id: string; customerName: string; phone: string | null }
  batch: { id: string; batchName: string; subjectOrCourse: string }
}

interface FeeRecord {
  id: string
  enrollmentId: string
  studentId: string
  batchId: string
  feeMonth: string
  dueDate: string | null
  baseAmount: number
  taxRate: number
  taxAmount: number
  amountDue: number
  amountReceived: number
  status: string
  paidDate: string | null
  notes: string | null
  invoiceId: string | null
  enrollment: FeeEnrollment
}

interface FeeKPIs {
  totalDue: number
  totalReceived: number
  pendingCount: number
  partialCount: number
  paidCount: number
  waivedCount: number
  total: number
}

// Verified exhaustive against CoachingFeeRecord.status in prisma/schema.prisma
// ("PENDING|PAID|PARTIAL|WAIVED") and src/main/services/coaching-fee.service.ts
// (generate() always creates 'PENDING'; update() either passes through the
// caller-supplied status or auto-derives PENDING/PAID/PARTIAL from the
// amountReceived-vs-amountDue comparison — never anything outside this set).
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  PENDING: 'warning',
  PARTIAL: 'info',
  PAID: 'success',
  WAIVED: 'neutral',
}

async function printFeeReceipt(r: FeeRecord) {
  if (!r.enrollment) return
  const receiptDate = r.paidDate ? new Date(r.paidDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const printedOn = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const [yr, mo] = r.feeMonth.split('-')
  const monthLabel = new Date(Number(yr), Number(mo) - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  // Open synchronously, still inside the click's user-gesture window — the
  // UPI QR fetch below is awaited before writing, same pattern already used
  // by ChallanScreen's own popup print flow.
  const win = window.open('', '_blank', 'width=700,height=900')
  if (!win) return

  // Only a PARTIAL payment leaves an actual balance a UPI QR should offer to
  // collect — a fully PAID receipt has nothing left to pay. The endpoint
  // itself is the single source of truth for whether UPI even applies here
  // (returns null unless the business has a UPI ID configured AND is in
  // India) — this screen never re-derives that eligibility itself.
  const balance = Number(r.amountDue) - Number(r.amountReceived)
  let qrHtml = ''
  if (balance > 0.01) {
    const qrRes = await api.app.generateUpiPaymentQr({
      amount: balance,
      note: `Fee - ${r.enrollment.student.customerName} - ${monthLabel}`
    })
    if (qrRes.success && qrRes.data) {
      qrHtml = `<div class="upi-section"><p class="upi-label">Scan to Pay Balance (UPI)</p><img src="${qrRes.data.qrDataUrl}" alt="UPI QR" /><p class="upi-amount">₹${balance.toLocaleString()}</p></div>`
    }
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fee Receipt</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 40px; max-width: 600px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 4px; } .subtitle { color: #555; margin-bottom: 24px; font-size: 12px; }
  .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
  .label { color: #555; } .value { font-weight: 600; }
  .total-row { display: flex; justify-content: space-between; padding: 10px 0; background: #f8fafc; border-top: 2px solid #1e293b; margin-top: 8px; font-size: 14px; font-weight: 700; }
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; background: #dcfce7; color: #16a34a; }
  .upi-section { text-align: center; margin: 24px 0; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; }
  .upi-label { font-size: 12px; font-weight: 600; margin: 0 0 12px; }
  .upi-section img { width: 220px; height: 220px; }
  .upi-amount { font-size: 16px; font-weight: 700; margin: 8px 0 0; }
  .footer { font-size: 10px; color: #555; text-align: center; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
</style></head><body>
<h1>Fee Receipt</h1>
<div class="subtitle">For the month of ${monthLabel} &nbsp; <span class="status-badge">${r.status}</span></div>
<div class="row"><span class="label">Student</span><span class="value">${r.enrollment.student.customerName}</span></div>
<div class="row"><span class="label">Phone</span><span class="value">${r.enrollment.student.phone ?? '—'}</span></div>
<div class="row"><span class="label">Batch</span><span class="value">${r.enrollment.batch.batchName}</span></div>
<div class="row"><span class="label">Course</span><span class="value">${r.enrollment.batch.subjectOrCourse}</span></div>
<div class="row"><span class="label">Fee Month</span><span class="value">${monthLabel}</span></div>
${Number(r.taxRate) > 0 ? `<div class="row"><span class="label">Base Amount</span><span class="value">₹${Number(r.baseAmount).toLocaleString()}</span></div><div class="row"><span class="label">GST (${r.taxRate}%)</span><span class="value">₹${Number(r.taxAmount).toLocaleString()}</span></div>` : ''}
<div class="total-row"><span>Total Amount</span><span>₹${Number(r.amountDue).toLocaleString()}</span></div>
<div class="row" style="margin-top:8px"><span class="label">Amount Received</span><span class="value">₹${Number(r.amountReceived).toLocaleString()}</span></div>
${r.paidDate ? `<div class="row"><span class="label">Paid Date</span><span class="value">${receiptDate}</span></div>` : ''}
${r.notes ? `<div class="row"><span class="label">Notes</span><span class="value">${r.notes}</span></div>` : ''}
<div class="row" style="margin-top:8px"><span class="label">Printed On</span><span>${printedOn}</span></div>
${qrHtml}
<div class="footer">${aszurexFooterHtml(10)}</div>
</body></html>`

  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function isOverdue(record: FeeRecord): boolean {
  if (record.status === 'PAID' || record.status === 'WAIVED') return false
  if (!record.dueDate) return false
  return new Date(record.dueDate) < new Date()
}

export default function FeesScreen() {
  const { error: toastError } = useNotificationStore()
  const [month, setMonth] = useState(currentMonth())
  const [records, setRecords] = useState<FeeRecord[]>([])
  const [kpis, setKpis] = useState<FeeKPIs | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterBatchId, setFilterBatchId] = useState('')
  const [batches, setBatches] = useState<{ id: string; batchName: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genMsg, setGenMsg] = useState('')
  const [genTaxRate, setGenTaxRate] = useState('0')

  const [editRecord, setEditRecord] = useState<FeeRecord | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const filters: Record<string, string> = { month }
      if (filterStatus) filters.status = filterStatus
      if (filterBatchId) filters.batchId = filterBatchId
      const [feeRes, kpiRes, batchRes] = await Promise.all([
        api.coachingFee.list(filters),
        api.coachingFee.kpis({ month }),
        api.coachingBatch.list({}),
      ])
      if (feeRes.success && feeRes.data) setRecords(feeRes.data as FeeRecord[])
      else toastError('Error', feeRes.error?.message ?? 'Could not load fee records.')
      if (kpiRes.success && kpiRes.data) setKpis(kpiRes.data as FeeKPIs)
      if (batchRes.success && batchRes.data) setBatches(batchRes.data as { id: string; batchName: string }[])
    } catch {
      toastError('Error', 'Could not load fee records.')
    } finally {
      setLoading(false)
    }
  }, [month, filterStatus, filterBatchId, toastError])

  useEffect(() => { loadAll() }, [loadAll])

  async function handleGenerate() {
    setGenerating(true)
    setGenMsg('')
    const res = await api.coachingFee.generate({ month, taxRate: Number(genTaxRate) || 0 })
    if (res.success && res.data) {
      const d = res.data as { created: number; skipped: number }
      setGenMsg(`Generated ${d.created} fee record(s). ${d.skipped} already existed.`)
      loadAll()
    } else {
      setGenMsg(res.error?.message ?? 'Generation failed.')
    }
    setGenerating(false)
  }

  async function handleMarkPaid(record: FeeRecord) {
    try {
      const res = await api.coachingFee.update({
        id: record.id,
        amountReceived: Number(record.amountDue),
        status: 'PAID',
      })
      if (res.success) loadAll()
      else toastError('Error', res.error?.message ?? 'Could not mark fee as paid.')
    } catch {
      toastError('Error', 'Could not mark fee as paid.')
    }
  }

  async function handleMarkWaived(record: FeeRecord) {
    try {
      const res = await api.coachingFee.update({ id: record.id, status: 'WAIVED' })
      if (res.success) loadAll()
      else toastError('Error', res.error?.message ?? 'Could not waive fee.')
    } catch {
      toastError('Error', 'Could not waive fee.')
    }
  }

  function openEdit(record: FeeRecord) {
    setEditRecord(record)
    setEditAmount(String(record.amountReceived))
    setEditNotes(record.notes ?? '')
  }

  async function handleSaveEdit() {
    if (!editRecord) return
    setEditSaving(true)
    try {
      const res = await api.coachingFee.update({
        id: editRecord.id,
        amountReceived: Number(editAmount) || 0,
        notes: editNotes || null,
      })
      if (res.success) { setEditRecord(null); loadAll() }
      else toastError('Error', res.error?.message ?? 'Could not save fee payment.')
    } catch {
      toastError('Error', 'Could not save fee payment.')
    } finally {
      setEditSaving(false)
    }
  }

  // Display month as human-readable
  const displayMonth = (() => {
    const [y, m] = month.split('-')
    return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  })()

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Fee Management</h1>
        <div className="flex items-center gap-3">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
          <div className="flex items-center gap-1.5" title="GST rate applied to fees generated for this month. Leave at 0 if your institute is GST-exempt.">
            <label className="text-xs text-gray-500 dark:text-slate-400">GST %</label>
            <input type="number" min={0} max={100} step="0.01" value={genTaxRate} onChange={(e) => setGenTaxRate(e.target.value)}
              className="w-20 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
          </div>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors">
            <Zap size={15} /> {generating ? 'Generating...' : 'Generate Fees'}
          </button>
        </div>
      </div>

      {genMsg && (
        <div className="mb-4 p-3 bg-info/5 border border-info/20 rounded-lg text-sm text-info">{genMsg}</div>
      )}

      {/* KPI bar */}
      {kpis && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <KpiCard label="Total Due" value={`₹${kpis.totalDue.toLocaleString()}`} />
          <KpiCard label="Collected" value={`₹${kpis.totalReceived.toLocaleString()}`} color="success" />
          <KpiCard label="Pending" value={kpis.pendingCount} color="warning" />
          <KpiCard label="Partial" value={kpis.partialCount} color="info" />
          <KpiCard label="Paid" value={kpis.paidCount} color="success" />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="PARTIAL">Partial</option>
          <option value="PAID">Paid</option>
          <option value="WAIVED">Waived</option>
        </Select>
        <Select value={filterBatchId} onChange={(e) => setFilterBatchId(e.target.value)}>
          <option value="">All Batches</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.batchName}</option>)}
        </Select>
      </div>

      {/* Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 dark:bg-slate-950 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">{displayMonth} Fee Records</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Student</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Batch</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Amount Due</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Received</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Status</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Due Date</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Paid Date</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={8} className="py-12 text-center text-gray-400 dark:text-slate-500">Loading...</td></tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-400 dark:text-slate-500">
                  No fee records for {displayMonth}.{' '}
                  <button onClick={handleGenerate} className="text-indigo-600 hover:underline font-medium">Generate now</button>
                </td>
              </tr>
            ) : records.map((r) => {
              const overdue = isOverdue(r)
              const hasGst = Number(r.taxRate) > 0
              return (
                <tr key={r.id} className={`hover:bg-gray-50 dark:hover:bg-slate-800 ${r.status === 'PAID' ? 'opacity-70' : ''}`}>
                  <td className="py-3 px-4">
                    <p className="font-medium text-gray-900 dark:text-slate-100">{r.enrollment.student.customerName}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{r.enrollment.student.phone ?? ''}</p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-gray-700 dark:text-slate-300">{r.enrollment.batch.batchName}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{r.enrollment.batch.subjectOrCourse}</p>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <p className="font-medium text-gray-900 dark:text-slate-100">₹{Number(r.amountDue).toLocaleString()}</p>
                    {hasGst && (
                      <p className="text-xs text-gray-400 dark:text-slate-500">Base ₹{Number(r.baseAmount).toLocaleString()} + GST ₹{Number(r.taxAmount).toLocaleString()}</p>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-700 dark:text-slate-300">₹{Number(r.amountReceived).toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1">
                      <Badge variant={STATUS_VARIANT[r.status] ?? 'neutral'} size="sm" className="w-fit">{r.status}</Badge>
                      {overdue && <Badge variant="danger" size="sm" className="w-fit">OVERDUE</Badge>}
                      {r.invoiceId && <Badge variant="neutral" size="sm" className="w-fit">Invoiced</Badge>}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs dark:text-slate-400">
                    {r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs dark:text-slate-400">
                    {r.paidDate ? new Date(r.paidDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 justify-end">
                      {(r.status === 'PAID' || r.status === 'PARTIAL') && (
                        <button onClick={() => printFeeReceipt(r)} title="Print receipt"
                          className="p-1.5 text-gray-400 hover:text-indigo-600 rounded dark:text-slate-500">
                          <Printer size={14} />
                        </button>
                      )}
                      {r.status !== 'PAID' && r.status !== 'WAIVED' && (
                        <>
                          <button onClick={() => handleMarkPaid(r)} title="Mark Paid"
                            className="p-1.5 text-green-500 hover:text-green-700 rounded">
                            <CheckCircle size={15} />
                          </button>
                          <button onClick={() => openEdit(r)} title="Edit amount"
                            className="p-1.5 text-gray-400 hover:text-indigo-600 rounded dark:text-slate-500">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleMarkWaived(r)} title="Waive"
                            className="p-1.5 text-gray-400 hover:text-amber-600 rounded dark:text-slate-500">
                            <XCircle size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      {/* Edit modal */}
      {editRecord && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1 dark:text-slate-100">Edit Fee Payment</h2>
            <p className="text-sm text-gray-500 mb-4 dark:text-slate-400">{editRecord.enrollment.student.customerName} — {editRecord.enrollment.batch.batchName}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Amount Received (₹)</label>
                <input type="number" min={0} value={editAmount} onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                <p className="text-xs text-gray-400 mt-1 dark:text-slate-500">
                  Due: ₹{Number(editRecord.amountDue).toLocaleString()}
                  {Number(editRecord.taxRate) > 0 && (
                    <span className="ml-1">(Base ₹{Number(editRecord.baseAmount).toLocaleString()} + GST {editRecord.taxRate}% ₹{Number(editRecord.taxAmount).toLocaleString()})</span>
                  )}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Notes</label>
                <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                  placeholder="Optional note" />
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setEditRecord(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={handleSaveEdit} disabled={editSaving} className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
