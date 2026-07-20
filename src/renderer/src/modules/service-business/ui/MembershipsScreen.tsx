import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Users, CheckCircle, AlertTriangle, Search, UserCheck, RefreshCw, X, Receipt, Clock, History } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Tabs } from '@shared/ui/molecules/Tabs'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { CustomerPicker } from '@shared/ui/molecules/CustomerPicker'
import { useNotificationStore } from '@app/store/notification.store'

interface MembershipPlan {
  id: string
  planName: string
  durationDays: number
  price: number
  sessionsIncluded: number | null
  allowedClasses: string | null
  isActive: boolean
}

interface Membership {
  id: string
  clientId: string
  planId: string
  startDate: string
  endDate: string
  status: string
  paymentStatus: string
  sessionsUsed: number
  invoiceId: string | null
  notes: string | null
  client: { id: string; customerName: string; phone: string | null }
  plan: { id: string; planName: string; durationDays: number; price: number }
}

interface Customer {
  id: string
  customerName: string
  phone: string | null
}

interface ExpiringMembership {
  id: string
  endDate: string
  client: { id: string; customerName: string; phone: string | null }
  plan: { id: string; planName: string }
}

interface AttendanceRecord {
  id: string
  checkInTime: string
  checkOutTime: string | null
  client: { id: string; customerName: string }
}

const STATUS_VARIANT: Record<string, 'success' | 'info' | 'neutral' | 'danger'> = {
  ACTIVE: 'success',
  FROZEN: 'info',
  EXPIRED: 'neutral',
  CANCELLED: 'danger',
}

const PAYMENT_VARIANT: Record<string, 'success' | 'warning' | 'info'> = {
  PAID: 'success',
  PENDING: 'warning',
  PARTIAL: 'info',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysLeft(endDate: string) {
  const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)
  return diff
}

export function MembershipsScreen() {
  const { error: toastError } = useNotificationStore()
  const [tab, setTab] = useState<'memberships' | 'plans' | 'checkin' | 'expiring'>('memberships')
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [statusFilter, setStatusFilter] = useState('ACTIVE')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [counts, setCounts] = useState({ ACTIVE: 0, FROZEN: 0, EXPIRED: 0, CANCELLED: 0 })

  // New membership form
  const [showNewMembership, setShowNewMembership] = useState(false)
  const [freezeTarget, setFreezeTarget] = useState<string | null>(null)
  const [freezeReason, setFreezeReason] = useState('')
  const [freezing, setFreezing] = useState(false)
  const [newForm, setNewForm] = useState({ planId: '', startDate: new Date().toISOString().slice(0, 10), paymentStatus: 'PENDING', notes: '' })
  const [pickedClient, setPickedClient] = useState<Customer | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Plan form
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null)
  const [planForm, setPlanForm] = useState({ planName: '', durationDays: 30, price: 0, sessionsIncluded: '', allowedClasses: '' })
  const [planSaving, setPlanSaving] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)

  // Check-in
  const [checkInSearch, setCheckInSearch] = useState('')
  const [checkingIn, setCheckingIn] = useState<string | null>(null)
  const [checkInMsg, setCheckInMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Invoice generation
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  // Expiring memberships (Phase 58 §1 — was a dead backend function with no UI)
  const [expiring, setExpiring] = useState<ExpiringMembership[]>([])
  const [loadingExpiring, setLoadingExpiring] = useState(false)
  const [expiringDays, setExpiringDays] = useState(30)

  // Per-member attendance history (Phase 58 §1 — was a dead backend function with no UI)
  const [attendanceMembership, setAttendanceMembership] = useState<Membership | null>(null)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [loadingAttendance, setLoadingAttendance] = useState(false)

  const loadMemberships = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.membership.list({ status: statusFilter || undefined, search: search || undefined })
      if (res.success) setMemberships(res.data as Membership[])
      else setError(res.error?.message ?? 'Could not load memberships.')
    } catch {
      setError('Could not load memberships.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  const loadPlans = useCallback(async () => {
    try {
      const res = await api.membershipPlan.list()
      if (res.success) setPlans(res.data as MembershipPlan[])
      else toastError('Error', res.error?.message ?? 'Could not load plans.')
    } catch { toastError('Error', 'Could not load plans.') }
  }, [toastError])

  const loadMembershipCounts = useCallback(async () => {
    try {
      const res = await api.membership.list({})
      if (res.success) {
        const all = res.data as Membership[]
        setCounts({
          ACTIVE: all.filter((m) => m.status === 'ACTIVE').length,
          FROZEN: all.filter((m) => m.status === 'FROZEN').length,
          EXPIRED: all.filter((m) => m.status === 'EXPIRED').length,
          CANCELLED: all.filter((m) => m.status === 'CANCELLED').length,
        })
      } else {
        toastError('Error', res.error?.message ?? 'Could not load membership counts.')
      }
    } catch {
      toastError('Error', 'Could not load membership counts.')
    }
  }, [toastError])

  const loadExpiring = useCallback(async () => {
    setLoadingExpiring(true)
    try {
      const res = await api.membership.expiring({ daysAhead: expiringDays })
      if (res.success) setExpiring(res.data as ExpiringMembership[])
      else toastError('Error', res.error?.message ?? 'Could not load expiring memberships.')
    } catch {
      toastError('Error', 'Could not load expiring memberships.')
    } finally {
      setLoadingExpiring(false)
    }
  }, [expiringDays, toastError])

  useEffect(() => {
    loadMemberships()
    loadPlans()
    loadMembershipCounts()
  }, [loadMemberships, loadPlans, loadMembershipCounts])

  useEffect(() => {
    if (tab === 'expiring') loadExpiring()
  }, [tab, loadExpiring])

  async function openAttendance(membership: Membership) {
    setAttendanceMembership(membership)
    setLoadingAttendance(true)
    try {
      const res = await api.membership.attendance({ membershipId: membership.id })
      if (res.success) setAttendanceRecords(res.data as AttendanceRecord[])
      else toastError('Error', res.error?.message ?? 'Could not load attendance history.')
    } catch {
      toastError('Error', 'Could not load attendance history.')
    } finally {
      setLoadingAttendance(false)
    }
  }

  function openNewMembership() {
    setShowNewMembership(true)
    setSaveError(null)
    setNewForm({ planId: '', startDate: new Date().toISOString().slice(0, 10), paymentStatus: 'PENDING', notes: '' })
    setPickedClient(null)
  }

  async function handleCreateMembership() {
    if (!pickedClient || !newForm.planId || !newForm.startDate) {
      setSaveError('Client, Plan, and Start Date are required.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const res = await api.membership.create({
        clientId: pickedClient.id,
        planId: newForm.planId,
        startDate: newForm.startDate,
        paymentStatus: newForm.paymentStatus,
        notes: newForm.notes || undefined,
      })
      if (res.success) {
        setShowNewMembership(false)
        loadMemberships()
        loadMembershipCounts()
      } else {
        setSaveError(res.error?.message ?? 'Could not create membership.')
      }
    } catch {
      setSaveError('Could not create membership.')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      const res = await api.membership.update({ id, status })
      if (res.success) {
        loadMemberships()
        loadMembershipCounts()
      } else {
        toastError('Error', res.error?.message ?? 'Could not update membership status.')
      }
    } catch {
      toastError('Error', 'Could not update membership status.')
    }
  }

  function openFreezeModal(id: string) {
    setFreezeTarget(id)
    setFreezeReason('')
  }

  async function handleFreeze() {
    if (!freezeTarget) return
    setFreezing(true)
    try {
      const res = await api.membership.freeze({ id: freezeTarget, reason: freezeReason.trim() || undefined })
      if (res.success) {
        setFreezeTarget(null)
        loadMemberships()
        loadMembershipCounts()
      } else {
        toastError('Error', res.error?.message ?? 'Could not freeze membership.')
      }
    } catch {
      toastError('Error', 'Could not freeze membership.')
    } finally {
      setFreezing(false)
    }
  }

  async function handleResume(id: string) {
    try {
      const res = await api.membership.resume({ id })
      if (res.success) {
        loadMemberships()
        loadMembershipCounts()
      } else {
        toastError('Error', res.error?.message ?? 'Could not resume membership.')
      }
    } catch {
      toastError('Error', 'Could not resume membership.')
    }
  }

  async function handleGenerateInvoice(id: string) {
    setInvoiceError(null)
    setGeneratingId(id)
    try {
      const res = await api.membership.generateInvoice({ id })
      if (res.success) {
        loadMemberships()
      } else {
        setInvoiceError(res.error?.message ?? 'Could not generate invoice.')
      }
    } catch {
      setInvoiceError('Could not generate invoice.')
    } finally {
      setGeneratingId(null)
    }
  }

  function openPlanForm(plan?: MembershipPlan) {
    setEditingPlan(plan ?? null)
    setPlanForm({
      planName: plan?.planName ?? '',
      durationDays: plan?.durationDays ?? 30,
      price: plan?.price ?? 0,
      sessionsIncluded: plan?.sessionsIncluded != null ? String(plan.sessionsIncluded) : '',
      allowedClasses: plan?.allowedClasses ? JSON.parse(plan.allowedClasses).join(', ') : '',
    })
    setShowPlanForm(true)
    setPlanError(null)
  }

  async function handleSavePlan() {
    if (!planForm.planName) { setPlanError('Plan name is required.'); return }
    setPlanSaving(true)
    setPlanError(null)
    try {
      const payload = {
        planName: planForm.planName,
        durationDays: Number(planForm.durationDays),
        price: Number(planForm.price),
        sessionsIncluded: planForm.sessionsIncluded ? Number(planForm.sessionsIncluded) : undefined,
        allowedClasses: planForm.allowedClasses
          ? JSON.stringify(planForm.allowedClasses.split(',').map((s) => s.trim()).filter(Boolean))
          : undefined,
      }
      const res = editingPlan
        ? await api.membershipPlan.update({ id: editingPlan.id, ...payload })
        : await api.membershipPlan.create(payload)
      if (res.success) {
        setShowPlanForm(false)
        loadPlans()
      } else {
        setPlanError(res.error?.message ?? 'Could not save plan.')
      }
    } catch {
      setPlanError('Could not save plan.')
    } finally {
      setPlanSaving(false)
    }
  }

  async function handleDeletePlan(id: string) {
    try {
      const res = await api.membershipPlan.delete({ id })
      if (!res.success) toastError('Error', res.error?.message ?? 'Could not delete plan.')
      else loadPlans()
    } catch {
      toastError('Error', 'Could not delete plan.')
    }
  }

  async function handleCheckIn(membership: Membership) {
    setCheckingIn(membership.id)
    setCheckInMsg(null)
    try {
      const res = await api.membership.checkIn({ clientId: membership.clientId, membershipId: membership.id })
      if (res.success) {
        setCheckInMsg({ type: 'success', msg: `${membership.client.customerName} checked in successfully.` })
        loadMemberships()
      } else {
        setCheckInMsg({ type: 'error', msg: res.error?.message ?? 'Check-in failed.' })
      }
    } catch {
      setCheckInMsg({ type: 'error', msg: 'Check-in failed.' })
    } finally {
      setCheckingIn(null)
    }
  }

  const checkInFiltered = memberships.filter((m) =>
    m.status === 'ACTIVE' && (!checkInSearch || m.client.customerName.toLowerCase().includes(checkInSearch.toLowerCase()) || (m.client.phone ?? '').includes(checkInSearch))
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Memberships</h1>
          <p className="text-sm text-muted-foreground">Manage gym memberships and check-ins</p>
        </div>
        {tab === 'memberships' && (
          <button onClick={openNewMembership} className="h-10 px-4 bg-primary text-primary-foreground rounded-xl text-sm font-medium flex items-center gap-2">
            <Plus size={16} /> New Membership
          </button>
        )}
        {tab === 'plans' && (
          <button onClick={() => openPlanForm()} className="h-10 px-4 bg-primary text-primary-foreground rounded-xl text-sm font-medium flex items-center gap-2">
            <Plus size={16} /> New Plan
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {(['ACTIVE', 'FROZEN', 'EXPIRED', 'CANCELLED'] as const).map((s) => (
          <KpiCard key={s} label={s} value={counts[s]} color={STATUS_VARIANT[s] === 'danger' ? 'danger' : STATUS_VARIANT[s] === 'success' ? 'success' : STATUS_VARIANT[s] === 'info' ? 'info' : 'neutral'} />
        ))}
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'memberships', label: 'All Memberships' },
          { id: 'plans', label: 'Plans' },
          { id: 'checkin', label: 'Quick Check-In' },
          { id: 'expiring', label: 'Expiring Soon' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* Memberships Tab */}
      {tab === 'memberships' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search member..." className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-card text-sm text-foreground" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 px-3 rounded-xl border border-border bg-card text-sm text-foreground">
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="FROZEN">Frozen</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <button onClick={loadMemberships} className="h-10 w-10 flex items-center justify-center rounded-xl border border-border hover:bg-muted/50 text-muted-foreground">
              <RefreshCw size={16} />
            </button>
          </div>

          {error && <div className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{error}</div>}
          {invoiceError && <div className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{invoiceError}</div>}

          <Card padding="none" className="overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-muted-foreground text-sm">Loading...</div>
            ) : memberships.length === 0 ? (
              <div className="p-12 text-center">
                <Users size={32} className="mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">No memberships found</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Member</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Valid Till</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Sessions Used</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Payment</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {memberships.map((m) => {
                    const days = daysLeft(m.endDate)
                    return (
                      <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{m.client.customerName}</p>
                          {m.client.phone && <p className="text-xs text-muted-foreground">{m.client.phone}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-foreground">{m.plan.planName}</p>
                          <p className="text-xs text-muted-foreground">₹{Number(m.plan.price).toLocaleString('en-IN')} · {m.plan.durationDays}d</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-foreground">{formatDate(m.endDate)}</p>
                          {m.status === 'ACTIVE' && (
                            <p className={cn('text-xs', days <= 7 ? 'text-danger' : days <= 30 ? 'text-warning' : 'text-muted-foreground')}>
                              {days > 0 ? `${days} days left` : 'Expired'}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-foreground">{m.sessionsUsed}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={STATUS_VARIANT[m.status] ?? 'neutral'} size="sm">{m.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={PAYMENT_VARIANT[m.paymentStatus] ?? 'neutral'} size="sm">{m.paymentStatus}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openAttendance(m)}
                              title="Attendance history"
                              className="p-1.5 text-muted-foreground hover:text-brand hover:bg-brand/5 rounded-lg transition-colors"
                            >
                              <History size={14} />
                            </button>
                            {m.status === 'ACTIVE' && (
                              <>
                                <button onClick={() => openFreezeModal(m.id)} className="text-xs text-info border border-info/30 rounded-lg px-2 py-1">Freeze</button>
                                <button onClick={() => handleStatusChange(m.id, 'CANCELLED')} className="text-xs text-danger border border-danger/30 rounded-lg px-2 py-1">Cancel</button>
                              </>
                            )}
                            {m.status === 'FROZEN' && (
                              <button onClick={() => handleResume(m.id)} className="text-xs text-info border border-info/30 rounded-lg px-2 py-1">Resume</button>
                            )}
                            {m.invoiceId ? (
                              <span className="text-xs text-success font-medium px-1">Invoiced</span>
                            ) : Number(m.plan.price) > 0 && (
                              <button
                                onClick={() => handleGenerateInvoice(m.id)}
                                disabled={generatingId === m.id}
                                title="Generate Invoice"
                                className="p-1.5 text-muted-foreground hover:text-success hover:bg-success/5 rounded-lg transition-colors disabled:opacity-50"
                              >
                                <Receipt size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* Plans Tab */}
      {tab === 'plans' && (
        <div className="grid grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card key={plan.id} padding="lg" className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{plan.planName}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{plan.durationDays} days</p>
                </div>
                {!plan.isActive && <Badge variant="neutral" size="sm">Inactive</Badge>}
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">₹{Number(plan.price).toLocaleString('en-IN')}</p>
              {plan.sessionsIncluded != null && <p className="text-xs text-slate-500 dark:text-slate-400">{plan.sessionsIncluded} sessions included</p>}
              {plan.allowedClasses && (
                <p className="text-xs text-slate-500 dark:text-slate-400">Classes: {JSON.parse(plan.allowedClasses).join(', ')}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => openPlanForm(plan)} className="flex-1 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Edit</button>
                <button onClick={() => handleDeletePlan(plan.id)} className="h-8 px-3 rounded-lg border border-danger/30 text-xs text-danger hover:bg-danger/5">Delete</button>
              </div>
            </Card>
          ))}
          {plans.length === 0 && (
            <Card padding="lg" className="col-span-3 text-center">
              <p className="text-slate-500 dark:text-slate-400">No membership plans yet. Create one to get started.</p>
            </Card>
          )}
        </div>
      )}

      {/* Quick Check-In Tab */}
      {tab === 'checkin' && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={checkInSearch}
              onChange={(e) => setCheckInSearch(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-full h-12 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
          </div>

          {checkInMsg && (
            <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-sm border', checkInMsg.type === 'success' ? 'bg-success/5 border-success/20 text-success' : 'bg-danger/5 border-danger/20 text-danger')}>
              {checkInMsg.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              {checkInMsg.msg}
            </div>
          )}

          <div className="space-y-2">
            {checkInFiltered.slice(0, 20).map((m) => (
              <Card key={m.id} padding="none" className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{m.client.customerName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{m.plan.planName} · Expires {formatDate(m.endDate)}</p>
                </div>
                <button
                  onClick={() => handleCheckIn(m)}
                  disabled={checkingIn === m.id}
                  className="h-10 px-4 bg-success text-white rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  <UserCheck size={14} />
                  {checkingIn === m.id ? 'Checking In...' : 'Check In'}
                </button>
              </Card>
            ))}
            {checkInFiltered.length === 0 && (
              <Card padding="lg" className="text-center">
                <UserCheck size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p className="text-slate-500 dark:text-slate-400">No active members found</p>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Expiring Soon Tab */}
      {tab === 'expiring' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Select label="Show expiring within" value={String(expiringDays)} onChange={(e) => setExpiringDays(Number(e.target.value))}>
              <option value="7">Next 7 days</option>
              <option value="14">Next 14 days</option>
              <option value="30">Next 30 days</option>
              <option value="60">Next 60 days</option>
            </Select>
            <button onClick={loadExpiring} className="h-10 w-10 flex items-center justify-center rounded-xl border border-border hover:bg-muted/50 text-muted-foreground">
              <RefreshCw size={16} />
            </button>
          </div>

          <Card padding="none" className="overflow-hidden">
            {loadingExpiring ? (
              <div className="p-12 text-center text-muted-foreground text-sm">Loading...</div>
            ) : expiring.length === 0 ? (
              <div className="p-12 text-center">
                <Clock size={32} className="mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">No memberships expiring in this window.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Member</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Expires On</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Days Left</th>
                  </tr>
                </thead>
                <tbody>
                  {expiring.map((m) => {
                    const days = daysLeft(m.endDate)
                    return (
                      <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{m.client.customerName}</p>
                          {m.client.phone && <p className="text-xs text-muted-foreground">{m.client.phone}</p>}
                        </td>
                        <td className="px-4 py-3 text-foreground">{m.plan.planName}</td>
                        <td className="px-4 py-3 text-foreground">{formatDate(m.endDate)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn('text-xs font-semibold', days <= 7 ? 'text-danger' : 'text-warning')}>{days} days</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* New Membership Modal */}
      {showNewMembership && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">New Membership</h2>
              <button onClick={() => setShowNewMembership(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            {saveError && <div className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{saveError}</div>}
            <div className="space-y-3">
              <CustomerPicker label="Member *" value={pickedClient} onChange={setPickedClient} placeholder="Search by name or phone..." />
              <Select label="Plan" required value={newForm.planId} onChange={(e) => setNewForm({ ...newForm, planId: e.target.value })}>
                <option value="">Select plan...</option>
                {plans.filter((p) => p.isActive).map((p) => <option key={p.id} value={p.id}>{p.planName} — ₹{Number(p.price).toLocaleString('en-IN')} ({p.durationDays}d)</option>)}
              </Select>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Start Date *</label>
                <input type="date" value={newForm.startDate} onChange={(e) => setNewForm({ ...newForm, startDate: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" />
              </div>
              <Select label="Payment Status" value={newForm.paymentStatus} onChange={(e) => setNewForm({ ...newForm, paymentStatus: e.target.value })}>
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
                <option value="PARTIAL">Partial</option>
              </Select>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                <textarea value={newForm.notes} onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm resize-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowNewMembership(false)} className="flex-1 h-11 rounded-xl border border-border text-sm text-foreground hover:bg-muted/50">Cancel</button>
              <button onClick={handleCreateMembership} disabled={saving} className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Membership'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Freeze Membership Modal */}
      {freezeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Freeze Membership</h2>
              <button onClick={() => setFreezeTarget(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <p className="text-sm text-muted-foreground">The member's remaining time is preserved — resuming later pushes their expiry date out by exactly how many days it stayed frozen.</p>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Reason (optional)</label>
              <textarea value={freezeReason} onChange={(e) => setFreezeReason(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm resize-none" placeholder="e.g. Traveling, injury..." />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setFreezeTarget(null)} className="flex-1 h-11 rounded-xl border border-border text-sm text-foreground hover:bg-muted/50">Cancel</button>
              <button onClick={handleFreeze} disabled={freezing} className="flex-1 h-11 bg-info text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {freezing ? 'Freezing...' : 'Freeze Membership'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Form Modal */}
      {showPlanForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{editingPlan ? 'Edit Plan' : 'New Plan'}</h2>
              <button onClick={() => setShowPlanForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            {planError && <div className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{planError}</div>}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Plan Name *</label>
                <input value={planForm.planName} onChange={(e) => setPlanForm({ ...planForm, planName: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" placeholder="e.g. Monthly Unlimited" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Duration (days) *</label>
                  <input type="number" min="1" value={planForm.durationDays} onChange={(e) => setPlanForm({ ...planForm, durationDays: Number(e.target.value) })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Price (₹) *</label>
                  <input type="number" min="0" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: Number(e.target.value) })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Sessions Included (optional)</label>
                <input type="number" min="0" value={planForm.sessionsIncluded} onChange={(e) => setPlanForm({ ...planForm, sessionsIncluded: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" placeholder="Leave blank for unlimited" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Allowed Classes (comma-separated)</label>
                <input value={planForm.allowedClasses} onChange={(e) => setPlanForm({ ...planForm, allowedClasses: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" placeholder="e.g. Yoga, Zumba, CrossFit" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowPlanForm(false)} className="flex-1 h-11 rounded-xl border border-border text-sm text-foreground hover:bg-muted/50">Cancel</button>
              <button onClick={handleSavePlan} disabled={planSaving} className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50">
                {planSaving ? 'Saving...' : 'Save Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance History Modal */}
      {attendanceMembership && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Attendance History</h2>
                <p className="text-sm text-muted-foreground">{attendanceMembership.client.customerName} · {attendanceMembership.plan.planName}</p>
              </div>
              <button onClick={() => { setAttendanceMembership(null); setAttendanceRecords([]) }} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            {loadingAttendance ? (
              <p className="text-center text-sm text-muted-foreground py-8">Loading...</p>
            ) : attendanceRecords.length === 0 ? (
              <div className="text-center py-8">
                <History size={28} className="mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">No check-ins recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {attendanceRecords.map((rec) => (
                  <div key={rec.id} className="flex items-center justify-between px-3 py-2.5 bg-muted/20 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Clock size={13} className="text-muted-foreground" />
                      <span className="text-sm text-foreground">{new Date(rec.checkInTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(rec.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
