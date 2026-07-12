import React, { useEffect, useState, useCallback } from 'react'
import { DollarSign, CheckCircle, Clock, RefreshCw, Award } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Tabs } from '@shared/ui/molecules/Tabs'
import { Badge } from '@shared/ui/atoms/Badge'
import { useNotificationStore } from '@app/store/notification.store'

interface StaffSummary {
  staffId: string
  staffName: string
  designation: string | null
  totalRevenue: number
  totalCommission: number
  totalTips: number
  paidAmount: number
  pendingAmount: number
  recordCount: number
}

interface CommissionRecord {
  id: string
  staffId: string
  serviceRevenue: number
  commissionType: string
  commissionRate: number
  commissionAmount: number
  tipAmount: number
  period: string
  isPaid: boolean
  paidDate: string | null
  appointment: { id: string; appointmentNumber: string; scheduledDate: string; serviceTitle: string; customerName: string } | null
  staff: { id: string; fullName: string; designation: string | null }
}

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatPeriod(p: string) {
  const [year, month] = p.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(month) - 1]} ${year}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function StaffCommissionScreen() {
  const { error: toastError } = useNotificationStore()
  const [period, setPeriod] = useState(currentPeriod())
  const [report, setReport] = useState<StaffSummary[]>([])
  const [records, setRecords] = useState<CommissionRecord[]>([])
  const [tab, setTab] = useState<'report' | 'records'>('report')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filterStaff, setFilterStaff] = useState('')
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'pending'>('all')
  const [staffOptions, setStaffOptions] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [markingPaid, setMarkingPaid] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.staffCommission.monthlyReport({ period })
      if (res.success) setReport((res.data as { staffSummaries: StaffSummary[] }).staffSummaries)
      else setError(res.error?.message ?? 'Could not load report.')
    } catch {
      setError('Could not load report.')
    } finally {
      setLoading(false)
    }
  }, [period])

  const loadRecords = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const filters: Record<string, unknown> = { period }
      if (filterPaid === 'paid') filters.isPaid = true
      if (filterPaid === 'pending') filters.isPaid = false
      if (filterStaff) filters.staffId = filterStaff
      const res = await api.staffCommission.listAll(filters)
      if (res.success) {
        const data = res.data as CommissionRecord[]
        setRecords(data)
        if (!filterStaff) {
          const seen = new Map<string, string>()
          data.forEach((r) => seen.set(r.staffId, r.staff.fullName))
          setStaffOptions(Array.from(seen.entries()).map(([id, name]) => ({ id, name })))
        }
      } else {
        setError(res.error?.message ?? 'Could not load records.')
      }
    } catch {
      setError('Could not load records.')
    } finally {
      setLoading(false)
    }
  }, [period, filterPaid, filterStaff])

  useEffect(() => {
    if (tab === 'report') loadReport()
    else loadRecords()
  }, [tab, loadReport, loadRecords])

  const totalCommission = report.reduce((s, r) => s + r.totalCommission, 0)
  const totalPending = report.reduce((s, r) => s + r.pendingAmount, 0)

  async function handleMarkPaid() {
    if (selectedIds.size === 0) return
    setMarkingPaid(true)
    try {
      const res = await api.staffCommission.markPaid({ ids: Array.from(selectedIds) })
      if (res.success) {
        setSelectedIds(new Set())
        loadRecords()
      } else {
        toastError('Error', res.error?.message ?? 'Could not mark commissions as paid.')
      }
    } catch {
      toastError('Error', 'Could not mark commissions as paid.')
    } finally {
      setMarkingPaid(false)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    const pending = records.filter((r) => !r.isPaid)
    if (selectedIds.size === pending.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pending.map((r) => r.id)))
    }
  }

  // Generate last 12 months for period picker
  const periodOptions: string[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    periodOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Staff Commission</h1>
          <p className="text-sm text-muted-foreground">Track and manage commission earnings</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-10 px-3 rounded-xl border border-border bg-card text-sm text-foreground"
          >
            {periodOptions.map((p) => (
              <option key={p} value={p}>{formatPeriod(p)}</option>
            ))}
          </select>
          <button
            onClick={() => tab === 'report' ? loadReport() : loadRecords()}
            className="h-10 w-10 flex items-center justify-center rounded-xl border border-border hover:bg-muted/50 text-muted-foreground"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label={`Total Commission · ${formatPeriod(period)}`} value={`₹${totalCommission.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} color="neutral" />
        <KpiCard label="Pending Payout" value={`₹${totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} color="warning" />
        <KpiCard label="Staff Members" value={report.length} color="neutral" />
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'report', label: 'Monthly Report' },
          { id: 'records', label: 'All Records' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {error && <div className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{error}</div>}

      {tab === 'report' && (
        <Card padding="none" className="overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Loading...</div>
          ) : report.length === 0 ? (
            <div className="p-12 text-center">
              <Award size={32} className="mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">No commission records for {formatPeriod(period)}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Staff</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Revenue Generated</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Commission</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Tips</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Paid</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Pending</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {report.map((row) => (
                  <tr key={row.staffId} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{row.staffName}</p>
                      {row.designation && <p className="text-xs text-muted-foreground">{row.designation}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">₹{row.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">₹{row.totalCommission.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right text-foreground">₹{row.totalTips.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right text-success">₹{row.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right text-warning">₹{row.pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{row.recordCount}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/20 font-semibold">
                  <td className="px-4 py-3 text-foreground">Total</td>
                  <td className="px-4 py-3 text-right text-foreground">₹{report.reduce((s, r) => s + r.totalRevenue, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right text-foreground">₹{totalCommission.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right text-foreground">₹{report.reduce((s, r) => s + r.totalTips, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right text-success">₹{report.reduce((s, r) => s + r.paidAmount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right text-warning">₹{totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{report.reduce((s, r) => s + r.recordCount, 0)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </Card>
      )}

      {tab === 'records' && (
        <div className="space-y-3">
          {/* Filters + Mark Paid */}
          <div className="flex items-center gap-3">
            <select
              value={filterStaff}
              onChange={(e) => setFilterStaff(e.target.value)}
              className="h-10 px-3 rounded-xl border border-border bg-card text-sm text-foreground"
            >
              <option value="">All Staff</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              value={filterPaid}
              onChange={(e) => setFilterPaid(e.target.value as 'all' | 'paid' | 'pending')}
              className="h-10 px-3 rounded-xl border border-border bg-card text-sm text-foreground"
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
            </select>
            {selectedIds.size > 0 && (
              <button
                onClick={handleMarkPaid}
                disabled={markingPaid}
                className="h-10 px-4 bg-success text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {markingPaid ? 'Marking...' : `Mark ${selectedIds.size} as Paid`}
              </button>
            )}
          </div>

          <Card padding="none" className="overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-muted-foreground text-sm">Loading...</div>
            ) : records.length === 0 ? (
              <div className="p-12 text-center">
                <DollarSign size={32} className="mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">No commission records found</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === records.filter((r) => !r.isPaid).length && records.filter((r) => !r.isPaid).length > 0}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Staff</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Appointment</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Revenue</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Rate</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Commission</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Tips</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-4 py-3 text-center">
                        {!r.isPaid && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(r.id)}
                            onChange={() => toggleSelect(r.id)}
                            className="rounded"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{r.staff.fullName}</p>
                        {r.staff.designation && <p className="text-xs text-muted-foreground">{r.staff.designation}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {r.appointment ? (
                          <>
                            <p className="text-foreground">{r.appointment.serviceTitle}</p>
                            <p className="text-xs text-muted-foreground">{r.appointment.customerName} · {formatDate(r.appointment.scheduledDate)}</p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">₹{Number(r.serviceRevenue).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {r.commissionType === 'PERCENT' ? `${r.commissionRate}%` : `₹${r.commissionRate}`}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">₹{Number(r.commissionAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right text-foreground">₹{Number(r.tipAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={r.isPaid ? 'success' : 'warning'} size="sm" icon={r.isPaid ? <CheckCircle size={12} /> : <Clock size={12} />}>
                          {r.isPaid ? 'Paid' : 'Pending'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
