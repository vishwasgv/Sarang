import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Plus, RefreshCw, UtensilsCrossed, Trash2, CheckCircle2, Clock, AlertTriangle, MoonStar, QrCode, X, Receipt, Merge, CalendarClock, Wifi, Pencil } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { formatCurrency } from '@shared/utils/currency.util'
import { Card } from '@shared/ui/molecules/Card'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { useIndustryStore } from '@renderer/app/store/industry.store'
import { aszurexFooterHtml } from '@shared/utils/print-branding'
import { useNotificationStore } from '@app/store/notification.store'

interface RestaurantTable {
  id: string
  tableNumber: string
  tableName?: string | null
  status: string
  kots: { id: string; status: string }[]
  waiterId?: string | null
  waiter?: { id: string; fullName: string } | null
  // Phase 58 §2 (2026-07-21) — live pointer to this table's currently
  // running dine-in order (set by billing.createInvoice's tableIds, or by
  // an ad-hoc merge). Null for a free table.
  currentInvoiceId?: string | null
}

interface Employee { id: string; fullName: string }

interface UpcomingReservation { id: string; customerName: string; partySize: number; reservedFor: string }

interface Reservation {
  id: string; customerName: string; phone: string; partySize: number; reservedFor: string
  tableId?: string | null; notes?: string | null; status: string
  table?: { id: string; tableNumber: string; tableName?: string | null } | null
}

const STATUS_COLOR = {
  AVAILABLE: 'bg-success/10 text-success border-success/20',
  OCCUPIED:  'bg-danger/10 text-danger border-danger/20',
  RESERVED:  'bg-warning/10 text-warning border-warning/20',
}
const STATUS_ICON = {
  AVAILABLE: CheckCircle2,
  OCCUPIED:  Clock,
  RESERVED:  AlertTriangle,
}

export function RestaurantTablesScreen() {
  const { t } = useTranslation()
  const STATUS_CONFIG = {
    AVAILABLE: { label: t('restaurantTables.statusAvailable'), color: STATUS_COLOR.AVAILABLE, icon: STATUS_ICON.AVAILABLE },
    OCCUPIED:  { label: t('restaurantTables.statusOccupied'), color: STATUS_COLOR.OCCUPIED, icon: STATUS_ICON.OCCUPIED },
    RESERVED:  { label: t('restaurantTables.statusReserved'), color: STATUS_COLOR.RESERVED, icon: STATUS_ICON.RESERVED },
  }
  const navigate = useNavigate()
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [tableNumber, setTableNumber] = useState('')
  const [tableName, setTableName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [closingDay, setClosingDay] = useState(false)
  const [closeResult, setCloseResult] = useState<{ message: string; success: boolean } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RestaurantTable | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showDailyCloseConfirm, setShowDailyCloseConfirm] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [assigningWaiterFor, setAssigningWaiterFor] = useState<string | null>(null)

  const { enabledModules, updateEnabledModules } = useIndustryStore()
  const qrEnabled = enabledModules.includes('qr_table_ordering')
  const [qrToggling, setQrToggling] = useState(false)
  const [qrStatus, setQrStatus] = useState<{ running: boolean; port: number | null; lanUrls: string[] } | null>(null)
  const [qrModalTable, setQrModalTable] = useState<RestaurantTable | null>(null)
  const [qrImage, setQrImage] = useState<{ qrDataUrl: string; orderUrl: string; wifiQrDataUrl: string | null; wifiSsid: string | null } | null>(null)
  const [qrModalError, setQrModalError] = useState<string | null>(null)

  // Task 18 — WiFi-join QR, printed alongside the order QR so a customer
  // whose phone isn't already on the restaurant's network can join it with
  // the same scan gesture. Entirely optional — if no SSID is ever saved,
  // generateTableQr just returns wifiQrDataUrl: null and everything behaves
  // exactly as before this feature existed.
  const [wifiSsidInput, setWifiSsidInput] = useState('')
  const [wifiPasswordInput, setWifiPasswordInput] = useState('')
  const [wifiOpenInput, setWifiOpenInput] = useState(false)
  const [wifiHasPassword, setWifiHasPassword] = useState(false)
  const [wifiSaving, setWifiSaving] = useState(false)
  const [wifiEditing, setWifiEditing] = useState(false)

  // Phase 58 §2 (2026-07-21) — upcoming reservations, table merge, and the
  // Reservations panel.
  const [upcomingByTable, setUpcomingByTable] = useState<Record<string, UpcomingReservation>>({})
  const [mergeTarget, setMergeTarget] = useState<RestaurantTable | null>(null)
  const [merging, setMerging] = useState(false)
  const [showReservations, setShowReservations] = useState(false)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loadingReservations, setLoadingReservations] = useState(false)
  const [addingReservation, setAddingReservation] = useState(false)
  const [rsvName, setRsvName] = useState('')
  const [rsvPhone, setRsvPhone] = useState('')
  const [rsvPartySize, setRsvPartySize] = useState('2')
  const [rsvDateTime, setRsvDateTime] = useState('')
  const [rsvTableId, setRsvTableId] = useState('')
  const [rsvNotes, setRsvNotes] = useState('')
  const [savingReservation, setSavingReservation] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.restaurant.listTables()
      if (res.success && res.data) {
        setTables(res.data as RestaurantTable[])
      } else {
        toastError('Error', res.error?.message ?? t('restaurantTables.couldNotLoadTables'))
      }
    } catch {
      toastError('Error', t('restaurantTables.couldNotLoadTables'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  const loadQrStatus = useCallback(async () => {
    try {
      const res = await api.restaurant.getQrOrderingStatus()
      if (res.success && res.data) {
        setQrStatus(res.data as { running: boolean; port: number | null; lanUrls: string[] })
      } else {
        toastError('Error', res.error?.message ?? t('restaurantTables.couldNotLoadQrStatus'))
      }
    } catch {
      toastError('Error', t('restaurantTables.couldNotLoadQrStatus'))
    }
  }, [toastError, t])

  const loadWifiConfig = useCallback(async () => {
    try {
      const res = await api.restaurant.getWifiConfig()
      if (res.success && res.data) {
        const data = res.data as { ssid: string; hasPassword: boolean; open: boolean }
        setWifiSsidInput(data.ssid)
        setWifiHasPassword(data.hasPassword)
        setWifiOpenInput(data.open)
      }
    } catch { /* WiFi card is supplementary — table list itself already surfaces errors */ }
  }, [])

  async function saveWifiConfig() {
    setWifiSaving(true)
    try {
      const res = await api.restaurant.setWifiConfig({
        ssid: wifiSsidInput.trim(),
        // Blank password input means "don't change it" once one is already
        // saved — only send it through when the field actually has text, so
        // re-saving just to rename the network can't silently wipe a working
        // password.
        password: wifiPasswordInput ? wifiPasswordInput : undefined,
        open: wifiOpenInput
      })
      if (res.success) {
        toastSuccess(t('restaurantTables.wifiSaved'))
        setWifiPasswordInput('')
        setWifiEditing(false)
        await loadWifiConfig()
      } else {
        toastError('Error', res.error?.message ?? t('restaurantTables.couldNotSaveWifi'))
      }
    } catch {
      toastError('Error', t('restaurantTables.couldNotSaveWifi'))
    } finally {
      setWifiSaving(false)
    }
  }

  const loadUpcomingReservations = useCallback(async () => {
    try {
      const res = await api.reservations.upcomingByTable()
      if (res.success && res.data) setUpcomingByTable(res.data as Record<string, UpcomingReservation>)
    } catch { /* badge is supplementary — table list itself already surfaces errors */ }
  }, [])

  const loadReservations = useCallback(async () => {
    setLoadingReservations(true)
    try {
      const res = await api.reservations.list({ status: 'CONFIRMED' })
      if (res.success && res.data) setReservations(res.data as Reservation[])
      else toastError('Error', res.error?.message ?? t('restaurantTables.couldNotLoadReservations'))
    } catch {
      toastError('Error', t('restaurantTables.couldNotLoadReservations'))
    } finally {
      setLoadingReservations(false)
    }
  }, [toastError, t])

  useEffect(() => { load(); loadQrStatus(); loadUpcomingReservations(); loadWifiConfig() }, [load, loadQrStatus, loadUpcomingReservations, loadWifiConfig])
  useEffect(() => { if (showReservations) loadReservations() }, [showReservations, loadReservations])

  useEffect(() => {
    api.hr.listEmployees({ isActive: true }).then((res) => {
      if (res.success && res.data) setEmployees((res.data as { employees: Employee[] }).employees ?? [])
    }).catch(() => { /* waiter picker is supplementary — table list itself already surfaces errors */ })
  }, [])

  async function handleAssignWaiter(tableId: string, waiterId: string) {
    setAssigningWaiterFor(tableId)
    try {
      const res = await api.restaurant.assignWaiter({ tableId, waiterId: waiterId || null })
      if (!res.success) toastError('Error', res.error?.message ?? t('restaurantTables.couldNotAssignWaiter'))
      await load()
    } catch {
      toastError('Error', t('restaurantTables.couldNotAssignWaiter'))
    } finally {
      setAssigningWaiterFor(null)
    }
  }

  async function toggleQrOrdering(on: boolean) {
    setQrToggling(true)
    try {
      const next = on ? [...enabledModules, 'qr_table_ordering' as never] : enabledModules.filter(m => m !== 'qr_table_ordering')
      const res = await updateEnabledModules(next as typeof enabledModules)
      if (!res.success) toastError('Error', res.error?.message ?? t('restaurantTables.couldNotUpdateQrSetting'))
      await loadQrStatus()
    } catch {
      toastError('Error', t('restaurantTables.couldNotUpdateQrSetting'))
    } finally {
      setQrToggling(false)
    }
  }

  async function openQrModal(table: RestaurantTable) {
    setQrModalTable(table)
    setQrImage(null)
    setQrModalError(null)
    try {
      const res = await api.restaurant.generateTableQr({ tableId: table.id })
      if (res.success && res.data) setQrImage(res.data as { qrDataUrl: string; orderUrl: string; wifiQrDataUrl: string | null; wifiSsid: string | null })
      else setQrModalError((res.error as { message?: string })?.message ?? t('restaurantTables.couldNotGenerateQr'))
    } catch {
      setQrModalError(t('restaurantTables.couldNotGenerateQr'))
    }
  }

  function printTableQr(table: RestaurantTable, qrDataUrl: string, wifiQrDataUrl?: string | null, wifiSsid?: string | null) {
    const w = window.open('', '_blank')
    // Task 18 — when a WiFi QR is available, print it first with a "join
    // WiFi, then scan to order" flow, side by side on one card rather than
    // two separate printouts, so staff only handle one piece of paper per
    // table.
    const wifiBlock = wifiQrDataUrl
      ? `<div class="qr-block"><h2>${t('restaurantTables.scanToJoinWifi')}</h2><img src="${wifiQrDataUrl}" alt="WiFi QR code" />${wifiSsid ? `<p class="ssid">${wifiSsid}</p>` : ''}</div>`
      : ''
    const orderBlock = `<div class="qr-block"><h2>${t('restaurantTables.scanToOrder')}</h2><img src="${qrDataUrl}" alt="Order QR code" /></div>`
    const html = `<html><head><style>
      body{font-family:Arial,sans-serif;text-align:center;padding:40px}
      h1{font-size:20px;margin-bottom:16px}
      h2{font-size:13px;color:#666;font-weight:600;margin:0 0 8px}
      .row{display:flex;justify-content:center;gap:32px;flex-wrap:wrap}
      .qr-block{width:220px}
      img{width:200px;height:200px}
      .ssid{font-size:11px;color:#666;margin-top:6px;word-break:break-word}
      footer{margin-top:24px;font-size:10px;color:#888}
    </style></head><body><h1>${table.tableName || table.tableNumber}</h1><div class="row">${wifiBlock}${orderBlock}</div><footer>${aszurexFooterHtml(10)}</footer></body></html>`
    if (w) { w.document.write(html); w.document.close(); w.print() }
  }

  async function handleAdd() {
    if (!tableNumber.trim()) { setError(t('restaurantTables.tableNumberRequired')); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await api.restaurant.createTable({ tableNumber: tableNumber.trim(), tableName: tableName.trim() || undefined })
      if (res.success) {
        setTableNumber(''); setTableName(''); setAdding(false)
        load()
      } else {
        setError((res.error as { message?: string })?.message ?? t('restaurantTables.couldNotCreateTable'))
      }
    } catch {
      setError(t('restaurantTables.couldNotCreateTable'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatus(tableId: string, status: string) {
    try {
      const res = await api.restaurant.updateTableStatus({ tableId, status })
      if (!res.success) toastError('Error', res.error?.message ?? t('restaurantTables.couldNotUpdateStatus'))
    } catch {
      toastError('Error', t('restaurantTables.couldNotUpdateStatus'))
    } finally {
      load()
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await api.restaurant.deleteTable({ tableId: deleteTarget.id })
      if (!res.success) {
        setError((res.error as { message?: string })?.message ?? t('restaurantTables.couldNotDeleteTable'))
      } else {
        setDeleteTarget(null)
        load()
      }
    } catch {
      setError(t('restaurantTables.couldNotDeleteTable'))
    } finally {
      setDeleting(false)
    }
  }

  function startOrder(table: RestaurantTable) {
    const label = table.tableName || table.tableNumber
    navigate(`/billing/new?tableId=${encodeURIComponent(table.id)}&tableLabel=${encodeURIComponent(label)}`)
  }

  async function handleMerge(freeTableId: string) {
    if (!mergeTarget?.currentInvoiceId) return
    setMerging(true)
    try {
      const res = await api.restaurant.mergeTableIntoInvoice({ tableId: freeTableId, invoiceId: mergeTarget.currentInvoiceId })
      if (res.success) {
        toastSuccess(t('restaurantTables.merged'), t('restaurantTables.tableMergedIntoOrder'))
        setMergeTarget(null)
        load()
      } else {
        toastError('Error', res.error?.message ?? t('restaurantTables.couldNotMergeTable'))
      }
    } catch {
      toastError('Error', t('restaurantTables.couldNotMergeTable'))
    } finally {
      setMerging(false)
    }
  }

  async function handleAddReservation() {
    if (!rsvName.trim() || !rsvPhone.trim() || !rsvDateTime) {
      toastError(t('restaurantTables.missingDetails'), t('restaurantTables.reservationDetailsRequired'))
      return
    }
    setSavingReservation(true)
    try {
      const res = await api.reservations.create({
        customerName: rsvName.trim(), phone: rsvPhone.trim(),
        partySize: parseInt(rsvPartySize, 10) || 1,
        reservedFor: new Date(rsvDateTime).toISOString(),
        tableId: rsvTableId || undefined,
        notes: rsvNotes.trim() || undefined,
      })
      if (res.success) {
        toastSuccess(t('restaurantTables.reservationAdded'), t('restaurantTables.reservationAddedDesc', { name: rsvName, datetime: new Date(rsvDateTime).toLocaleString() }))
        setRsvName(''); setRsvPhone(''); setRsvPartySize('2'); setRsvDateTime(''); setRsvTableId(''); setRsvNotes('')
        setAddingReservation(false)
        loadReservations(); loadUpcomingReservations()
      } else {
        toastError('Error', res.error?.message ?? t('restaurantTables.couldNotAddReservation'))
      }
    } catch {
      toastError('Error', t('restaurantTables.couldNotAddReservation'))
    } finally {
      setSavingReservation(false)
    }
  }

  async function handleReservationStatus(id: string, status: string) {
    try {
      const res = await api.reservations.updateStatus({ id, status })
      if (!res.success) toastError('Error', res.error?.message ?? t('restaurantTables.couldNotUpdateReservation'))
      loadReservations(); loadUpcomingReservations(); load()
    } catch {
      toastError('Error', t('restaurantTables.couldNotUpdateReservation'))
    }
  }

  async function handleDailyClose() {
    setShowDailyCloseConfirm(false)
    setClosingDay(true)
    setCloseResult(null)
    try {
      const res = await api.restaurant.performDailyClose()
      if (res.success && res.data) {
        const d = res.data as { kots: { DONE: number; CANCELLED: number }; revenue: { total: number; invoiceCount: number } }
        setCloseResult({
          success: true,
          message: t('restaurantTables.dayClosed', { kotCount: d.kots?.DONE ?? 0, revenue: formatCurrency(d.revenue?.total ?? 0), invoiceCount: d.revenue?.invoiceCount ?? 0 }),
        })
        load()
      } else {
        setCloseResult({ success: false, message: t('restaurantTables.dailyCloseFailed', { message: (res.error as { message?: string })?.message ?? 'Unknown error' }) })
      }
    } catch {
      setCloseResult({ success: false, message: t('restaurantTables.dailyCloseFailedUnknown') })
    } finally {
      setClosingDay(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('restaurantTables.title')}</h2>
          <p className="text-sm text-slate-400">{t('restaurantTables.tablesConfigured', { count: tables.length })}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:border-slate-300 transition-colors">
            <RefreshCw size={14} /> {t('common.refresh')}
          </button>
          <button
            onClick={() => setShowReservations(v => !v)}
            className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors',
              showReservations ? 'bg-brand/10 border-brand text-brand' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300')}>
            <CalendarClock size={14} /> {t('restaurantTables.reservations')}
          </button>
          <button
            onClick={() => setShowDailyCloseConfirm(true)}
            disabled={closingDay}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
            <MoonStar size={14} /> {closingDay ? t('restaurantTables.closing') : t('restaurantTables.endOfDay')}
          </button>
          <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors">
            <Plus size={14} /> {t('restaurantTables.addTable')}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-danger/5 border border-danger/20 rounded-xl px-4 py-3 text-sm text-danger">{error}</div>
      )}
      <Card padding="lg" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-dark dark:text-slate-100 flex items-center gap-2"><QrCode size={16} /> {t('restaurantTables.qrTableOrdering')}</h3>
            <p className="text-xs text-slate-400 mt-1">{t('restaurantTables.qrTableOrderingDesc')}</p>
          </div>
          <button
            onClick={() => toggleQrOrdering(!qrEnabled)}
            disabled={qrToggling}
            className={cn('px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50',
              qrEnabled ? 'bg-success/10 text-success border border-success/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400')}>
            {qrToggling ? t('restaurantTables.updating') : qrEnabled ? t('restaurantTables.enabled') : t('restaurantTables.enable')}
          </button>
        </div>
        {qrEnabled && (
          qrStatus?.running ? (
            <p className="text-xs text-success">{t('restaurantTables.qrRunningHint')}</p>
          ) : (
            <p className="text-xs text-warning">{t('restaurantTables.qrNotRunningHint')}</p>
          )
        )}
      </Card>

      {/* Task 18 — WiFi Network, printed as a combo QR alongside each
          table's order QR. Only meaningful once QR ordering itself is on. */}
      {qrEnabled && (
        <Card padding="lg" className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-dark dark:text-slate-100 flex items-center gap-2"><Wifi size={16} /> {t('restaurantTables.wifiNetwork')}</h3>
              <p className="text-xs text-slate-400 mt-1">{t('restaurantTables.wifiNetworkDesc')}</p>
            </div>
            {!wifiEditing && (
              <button onClick={() => { setWifiEditing(true); setWifiPasswordInput('') }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand hover:text-brand transition-colors">
                <Pencil size={13} /> {wifiSsidInput ? t('common.edit') : t('restaurantTables.addWifi')}
              </button>
            )}
          </div>

          {wifiEditing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={wifiSsidInput} onChange={e => setWifiSsidInput(e.target.value)} maxLength={32}
                  placeholder={t('restaurantTables.wifiSsidPlaceholder')}
                  className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand" />
                {!wifiOpenInput && (
                  <input type="password" value={wifiPasswordInput} onChange={e => setWifiPasswordInput(e.target.value)} maxLength={63}
                    placeholder={wifiHasPassword ? t('restaurantTables.wifiPasswordKeepPlaceholder') : t('restaurantTables.wifiPasswordPlaceholder')}
                    className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand" />
                )}
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <input type="checkbox" checked={wifiOpenInput} onChange={e => setWifiOpenInput(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" />
                {t('restaurantTables.wifiOpenNetwork')}
              </label>
              <div className="flex gap-2">
                <button onClick={saveWifiConfig} disabled={wifiSaving || !wifiSsidInput.trim()}
                  className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
                  {wifiSaving ? t('restaurantTables.saving') : t('common.save')}
                </button>
                <button onClick={() => { setWifiEditing(false); setWifiPasswordInput(''); loadWifiConfig() }}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:border-slate-300 transition-colors">
                  {t('restaurantTables.cancel')}
                </button>
              </div>
            </div>
          ) : wifiSsidInput ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{wifiSsidInput}</p>
          ) : (
            <p className="text-xs text-slate-400 italic">{t('restaurantTables.wifiNotConfigured')}</p>
          )}
        </Card>
      )}

      {/* Phase 58 §2 (2026-07-21) — Reservations panel */}
      {showReservations && (
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-dark dark:text-slate-100 flex items-center gap-2"><CalendarClock size={16} /> {t('restaurantTables.reservations')}</h3>
            <button onClick={() => setAddingReservation(v => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors">
              <Plus size={13} /> {t('restaurantTables.addReservation')}
            </button>
          </div>

          {addingReservation && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input value={rsvName} onChange={e => setRsvName(e.target.value)} placeholder={t('restaurantTables.customerNamePlaceholder')}
                  className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand" />
                <input value={rsvPhone} onChange={e => setRsvPhone(e.target.value)} placeholder={t('restaurantTables.phonePlaceholder')}
                  className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand" />
                <input type="number" min="1" value={rsvPartySize} onChange={e => setRsvPartySize(e.target.value)} placeholder={t('restaurantTables.partySizePlaceholder')}
                  className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand" />
                <input type="datetime-local" value={rsvDateTime} onChange={e => setRsvDateTime(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand" />
                <select value={rsvTableId} onChange={e => setRsvTableId(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand">
                  <option value="">{t('restaurantTables.noTablePreAssigned')}</option>
                  {tables.map(t2 => <option key={t2.id} value={t2.id}>{t2.tableName || t2.tableNumber}</option>)}
                </select>
                <input value={rsvNotes} onChange={e => setRsvNotes(e.target.value)} placeholder={t('restaurantTables.notesOptionalPlaceholder')}
                  className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setAddingReservation(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:border-slate-300 transition-colors">{t('restaurantTables.cancel')}</button>
                <button onClick={handleAddReservation} disabled={savingReservation}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
                  {savingReservation && <RefreshCw size={12} className="animate-spin" />} {t('restaurantTables.saveReservation')}
                </button>
              </div>
            </div>
          )}

          {loadingReservations ? (
            <div className="flex justify-center py-6"><RefreshCw size={18} className="animate-spin text-brand" /></div>
          ) : reservations.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">{t('restaurantTables.noUpcomingReservations')}</p>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {reservations.map(r => (
                <div key={r.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-semibold text-dark dark:text-slate-100">
                      {r.customerName} <span className="text-slate-400 font-normal">· {t('restaurantTables.guestsAndPhone', { partySize: r.partySize, phone: r.phone })}</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(r.reservedFor).toLocaleString()}{r.table ? ` · ${r.table.tableName || r.table.tableNumber}` : ''}
                      {r.notes ? ` · ${r.notes}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleReservationStatus(r.id, 'SEATED')}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors">{t('restaurantTables.seat')}</button>
                    <button onClick={() => handleReservationStatus(r.id, 'NO_SHOW')}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-warning/10 text-warning hover:bg-warning/20 transition-colors">{t('restaurantTables.noShow')}</button>
                    <button onClick={() => handleReservationStatus(r.id, 'CANCELLED')}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors">{t('restaurantTables.cancel')}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {closeResult && (
        <div className={`rounded-xl px-4 py-3 text-sm ${closeResult.success ? 'bg-success/5 border border-success/20 text-success' : 'bg-danger/5 border border-danger/20 text-danger'}`}>
          {closeResult.message}
        </div>
      )}

      {/* Add table form */}
      {adding && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <Card padding="lg" className="space-y-3">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100">{t('restaurantTables.addTable')}</h3>
          <div className="flex gap-3">
            <input
              value={tableNumber}
              onChange={e => setTableNumber(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder={t('restaurantTables.tableNumberPlaceholder')}
              className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand"
            />
            <input
              value={tableName}
              onChange={e => setTableName(e.target.value)}
              placeholder={t('restaurantTables.displayNamePlaceholder')}
              className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setError(null) }}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:border-slate-300 transition-colors">
              {t('restaurantTables.cancel')}
            </button>
            <button onClick={handleAdd} disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
              {submitting && <RefreshCw size={12} className="animate-spin" />} {t('restaurantTables.addTable')}
            </button>
          </div>
        </Card>
        </motion.div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw size={20} className="animate-spin text-brand" />
        </div>
      ) : tables.length === 0 ? (
        <Card padding="none" className="p-12 text-center">
          <UtensilsCrossed size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('restaurantTables.noTablesConfigured')}</p>
          <p className="text-xs text-slate-400 mt-1">{t('restaurantTables.addFirstTableHint')}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {tables.map(table => {
            const config = STATUS_CONFIG[table.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.AVAILABLE
            const Icon = config.icon
            return (
              <motion.div key={table.id}
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className={cn('bg-white dark:bg-slate-900 rounded-xl border-2 p-4 space-y-3 transition-colors', config.color)}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold text-dark dark:text-slate-100">{table.tableName || table.tableNumber}</p>
                    <p className="text-xs text-slate-400">{table.tableNumber}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {qrEnabled && (
                      <button onClick={() => openQrModal(table)}
                        className="text-slate-300 hover:text-brand transition-colors p-1" title={t('restaurantTables.printTableQrTitle')}>
                        <QrCode size={14} />
                      </button>
                    )}
                    <button onClick={() => setDeleteTarget(table)}
                      className="text-slate-300 hover:text-danger transition-colors p-1">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Icon size={12} />
                  <span className="text-xs font-semibold">{config.label}</span>
                  {table.kots.length > 0 && (
                    <span className="ms-auto text-xs bg-warning/10 text-warning px-1.5 py-0.5 rounded-full">
                      {t('restaurantTables.kotCount', { count: table.kots.length })}
                    </span>
                  )}
                </div>

                {upcomingByTable[table.id] && (
                  <p className="text-xs text-warning flex items-center gap-1">
                    <CalendarClock size={11} /> {t('restaurantTables.reservedAt', { time: new Date(upcomingByTable[table.id].reservedFor).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), name: upcomingByTable[table.id].customerName })}
                  </p>
                )}

                {/* Phase 58 §2 — start/continue a real dine-in order, and
                    merge another table into one already running */}
                {table.currentInvoiceId ? (
                  <div className="flex gap-1.5">
                    <button onClick={() => navigate(`/billing/invoices/${table.currentInvoiceId}`)}
                      className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg font-medium bg-brand/10 text-brand hover:bg-brand/20 transition-colors">
                      <Receipt size={12} /> {t('restaurantTables.viewBill')}
                    </button>
                    <button onClick={() => setMergeTarget(table)}
                      className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg font-medium bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-brand/10 hover:text-brand transition-colors">
                      <Merge size={12} /> {t('restaurantTables.mergeIn')}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => startOrder(table)}
                    className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg font-semibold bg-brand text-white hover:bg-brand/90 transition-colors">
                    <UtensilsCrossed size={12} /> {t('restaurantTables.startOrder')}
                  </button>
                )}

                <div className="flex gap-1">
                  {(['AVAILABLE', 'OCCUPIED', 'RESERVED'] as const).map(s => (
                    <button key={s}
                      onClick={() => handleStatus(table.id, s)}
                      disabled={table.status === s}
                      className={cn(
                        'flex-1 text-xs py-1 rounded-lg font-medium transition-colors',
                        table.status === s
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 cursor-default'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-brand/10 hover:text-brand'
                      )}>
                      {s === 'AVAILABLE' ? t('restaurantTables.statusShortFree') : s === 'OCCUPIED' ? t('restaurantTables.statusShortBusy') : t('restaurantTables.statusShortReserved')}
                    </button>
                  ))}
                </div>

                {employees.length > 0 && (
                  <select
                    value={table.waiterId ?? ''}
                    onChange={(e) => handleAssignWaiter(table.id, e.target.value)}
                    disabled={assigningWaiterFor === table.id}
                    className="w-full text-xs py-1.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-50"
                    title={t('restaurantTables.assignWaiterTitle')}
                  >
                    <option value="">{t('restaurantTables.noWaiter')}</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                  </select>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
            <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('restaurantTables.deleteTableTitle')}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {t('restaurantTables.deleteTableConfirm', { name: deleteTarget.tableName || deleteTarget.tableNumber })}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-danger text-white text-sm font-semibold hover:bg-danger/90 transition-colors disabled:opacity-50">
                {deleting ? t('restaurantTables.deleting') : t('restaurantTables.delete')}
              </button>
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:border-slate-300 transition-colors">
                {t('restaurantTables.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {mergeTarget && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('restaurantTables.mergeIntoTitle', { name: mergeTarget.tableName || mergeTarget.tableNumber })}</h2>
              <button onClick={() => setMergeTarget(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('restaurantTables.mergeHint')}</p>
            {tables.filter(t2 => t2.id !== mergeTarget.id && !t2.currentInvoiceId).length === 0 ? (
              <p className="text-sm text-slate-400 italic py-4 text-center">{t('restaurantTables.noFreeTablesToMerge')}</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {tables.filter(t2 => t2.id !== mergeTarget.id && !t2.currentInvoiceId).map(t2 => (
                  <button key={t2.id} onClick={() => handleMerge(t2.id)} disabled={merging}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:border-brand hover:text-brand transition-colors disabled:opacity-50">
                    <span>{t2.tableName || t2.tableNumber}</span>
                    <Merge size={14} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {qrModalTable && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 text-center">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-dark dark:text-slate-100">{qrModalTable.tableName || qrModalTable.tableNumber}</h2>
              <button onClick={() => setQrModalTable(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            {qrModalError ? (
              <p className="text-sm text-danger">{qrModalError}</p>
            ) : qrImage ? (
              <>
                {qrImage.wifiQrDataUrl && (
                  <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">{t('restaurantTables.scanToJoinWifi')}</p>
                    <img src={qrImage.wifiQrDataUrl} alt="WiFi QR code" className="w-40 h-40 mx-auto" />
                    {qrImage.wifiSsid && <p className="text-xs text-slate-400 mt-1">{qrImage.wifiSsid}</p>}
                  </div>
                )}
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('restaurantTables.scanToOrder')}</p>
                <img src={qrImage.qrDataUrl} alt="Table QR code" className="w-56 h-56 mx-auto" />
                <p className="text-xs text-slate-400 break-all">{qrImage.orderUrl}</p>
                <button onClick={() => printTableQr(qrModalTable, qrImage.qrDataUrl, qrImage.wifiQrDataUrl, qrImage.wifiSsid)}
                  className="w-full px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors">
                  {t('restaurantTables.print')}
                </button>
              </>
            ) : (
              <div className="flex justify-center py-8"><RefreshCw size={20} className="animate-spin text-brand" /></div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showDailyCloseConfirm}
        onClose={() => setShowDailyCloseConfirm(false)}
        onConfirm={handleDailyClose}
        loading={closingDay}
        title={t('restaurantTables.endOfDay')}
        message={t('restaurantTables.performDailyCloseConfirm')}
        confirmLabel={t('restaurantTables.endOfDay')}
        confirmVariant="primary"
      />
    </div>
  )
}
