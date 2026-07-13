import React, { useEffect, useState, useCallback, useRef, memo } from 'react'
import { useTranslation } from 'react-i18next'
import { SkeletonCard } from '@shared/ui/Skeleton'
import { AszurexMark } from '@shared/ui/atoms/Brand'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Area, AreaChart
} from 'recharts'
import {
  TrendingUp, TrendingDown, ShoppingCart, Package, Users, Truck,
  DollarSign, AlertTriangle, RefreshCw, AlertCircle, CheckCircle, X,
  Utensils, Store, HardHat, Layers, Activity, Zap, Gem, Sparkles
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useBusinessStore } from '@app/store/business.store'
import { useAuthStore } from '@app/store/auth.store'
import { useIndustryStore } from '@app/store/industry.store'
import { useNotificationStore } from '@app/store/notification.store'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { useNavigate } from 'react-router-dom'
import { documentLogoUrl } from '@shared/ui/molecules/DocumentWatermark'
interface InventoryStats { total: number; inStock: number; lowStock: number; outOfStock: number }
interface DashboardKpis { todaySales: number; todayTrend: number; weekSales: number; weekTrend: number; monthSales: number; monthTrend: number; totalInvoices: number; outstanding: number; inventoryValue: number; monthExpenses: number; expenseTrend: number; estimatedProfit: number; profitTrend: number; lowStockCount: number; customerCount: number; supplierCount: number; inventoryStats: InventoryStats; occupiedTables?: number; kotPending?: number; kotInProgress?: number }
interface TrendPoint { label: string; revenue: number; expenses: number }
interface TopProduct { productName: string; sku: string; quantitySold: number; revenue: number }
interface ActivityItem { id: string; action: string; entityType: string | null; entityId: string | null; user: string; createdAt: string }
interface DashboardAlert { type: string; message: string; severity: 'warning' | 'danger' }
interface TopOutstanding { customerId: string; customerName: string; outstanding: number }
interface TopCategory { categoryName: string; revenue: number; itemsSold: number }

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// "L"/"Cr" (Lakh/Crore) are Indian-numbering-system units — only correct when the
// business's number_format setting is 'IN'. Every other locale gets the
// internationally standard short-scale K/M/B, matching formatCurrency's own
// IN/EU/other locale split (currency.util.ts) instead of assuming India for everyone.
function fmtMoney(n: number, sym: string, numberFormat: string): string {
  if (numberFormat === 'IN') {
    if (n >= 10000000) return `${sym}${(n / 10000000).toFixed(1)}Cr`
    if (n >= 100000) return `${sym}${(n / 100000).toFixed(1)}L`
    if (n >= 1000) return `${sym}${(n / 1000).toFixed(1)}K`
    return `${sym}${n.toFixed(0)}`
  }
  if (n >= 1000000000) return `${sym}${(n / 1000000000).toFixed(1)}B`
  if (n >= 1000000) return `${sym}${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${sym}${(n / 1000).toFixed(1)}K`
  return `${sym}${n.toFixed(0)}`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function actionLabel(action: string): string {
  return action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
}

// ─────────────────────────────────────────────────────────────────────────────
// DashboardScreen
// ─────────────────────────────────────────────────────────────────────────────

type Period = '1d' | '7d' | '30d' | '90d' | '12m' | 'custom'

const NAMED_PERIODS: { label: string; value: Exclude<Period, 'custom'> }[] = [
  { label: 'Today', value: '1d' },
  { label: 'Week', value: '7d' },
  { label: 'Month', value: '30d' },
  { label: 'Quarter', value: '90d' },
  { label: 'Year', value: '12m' }
]

export function DashboardScreen() {
  const { t } = useTranslation()
  const profile = useBusinessStore((s) => s.profile)
  const numberFormat = useBusinessStore((s) => s.getSetting('number_format', 'IN'))
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { isModuleEnabled } = useIndustryStore()
  const { error: toastError } = useNotificationStore()
  const navigate = useNavigate()
  const sym = profile?.currencySymbol ?? '₹'
  const fmt = useCallback((n: number) => fmtMoney(n, sym, numberFormat), [sym, numberFormat])

  // State
  const [kpis, setKpis] = useState<DashboardKpis | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [topOutstanding, setTopOutstanding] = useState<TopOutstanding[]>([])
  const [todayReturns, setTodayReturns] = useState<{ count: number; totalRefunded: number } | null>(null)
  const [expiryAlertCount, setExpiryAlertCount] = useState<{ expiring: number; expired: number } | null>(null)
  const [topCategories, setTopCategories] = useState<TopCategory[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [alerts, setAlerts] = useState<DashboardAlert[]>([])
  const [period, setPeriod] = useState<Period>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [trendLoading, setTrendLoading] = useState(false)
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem('sarang-onboarding-dismissed') === '1'
  )
  const [aiQuestion, setAiQuestion] = useState('')

  // Permissions
  const canViewRevenue = hasPermission('analytics.viewRevenue')
  const canViewInventory = hasPermission('analytics.viewInventory')
  const canViewProfit = hasPermission('analytics.viewProfit')
  const canViewExpenses = hasPermission('analytics.viewExpenses')
  const canUseAi = isModuleEnabled('ai_assistant') && hasPermission('ai.query')

  // Refs to avoid stale closures and double-fetch
  const periodRef = useRef<Period>('30d')
  const isMounted = useRef(false)
  const didInitialLoad = useRef(false)

  // loadAll: KPIs + activity + alerts + outstanding + categories + initial trend
  // Period NOT in deps — uses periodRef to avoid triggering re-runs on period change
  // forceRefresh bypasses getDashboardKpis' 60s cache — the manual Refresh button
  // must always show current numbers, not up-to-60s-old ones. Also forced
  // automatically on mount whenever the onboarding checklist was still incomplete
  // last time we knew — otherwise a user who completes a step (add a customer,
  // create their first invoice) and navigates straight back to the dashboard
  // would see the up-to-60s-stale cache and be told they still haven't.
  const loadAll = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    try {
      const wantsReturnsWidget = isModuleEnabled('returns')
      // Fresh-audit fix (2026-07-12): Agri Inputs/Pharmacy had a
      // 'dashboardLayout' config key with no corresponding widget anywhere —
      // that whole dashboardLayout mechanism turned out to be dead across
      // EVERY business type (this screen has only ever branched on
      // isModuleEnabled(), never on dashboardLayout). Rather than build a
      // vertical-specific widget (which would violate this app's own "no
      // template-specific if/else" rule), reuses the existing shared
      // batch.service.ts getExpiryAlerts() the same way the Returns/
      // Outstanding widgets above reuse existing services — benefits both
      // Agri Inputs and Pharmacy identically via the shared expiry_tracking flag.
      const wantsExpiryWidget = isModuleEnabled('expiry_tracking')
      const [kpiRes, actRes, alertRes, outRes, catRes, retRes, expRes] = await Promise.all([
        api.analytics.getDashboardKpis(forceRefresh ? { forceRefresh: true } : undefined),
        api.analytics.getRecentActivity(),
        api.analytics.getDashboardAlerts(),
        api.analytics.getTopOutstanding({ limit: 5 }),
        canViewInventory ? api.analytics.getTopCategories({ limit: 5 }) : Promise.resolve({ success: true, data: [] }),
        wantsReturnsWidget ? api.returns.todaySummary() : Promise.resolve({ success: true, data: null }),
        wantsExpiryWidget ? api.batches.expiryAlerts({ withinDays: 30 }) : Promise.resolve({ success: true, data: null })
      ])
      if (kpiRes.success) setKpis(kpiRes.data as DashboardKpis)
      else toastError(t('common.error'), kpiRes.error?.message ?? t('common.error'))
      if (actRes.success) setActivity((actRes.data as ActivityItem[]) ?? [])
      if (alertRes.success) setAlerts((alertRes.data as DashboardAlert[]) ?? [])
      if (outRes.success) setTopOutstanding((outRes.data as TopOutstanding[]) ?? [])
      if (catRes.success) setTopCategories((catRes.data as TopCategory[]) ?? [])
      if (retRes.success) setTodayReturns(retRes.data as { count: number; totalRefunded: number } | null)
      if (expRes.success && expRes.data) {
        const d = expRes.data as { expiring: unknown[]; expired: unknown[] }
        setExpiryAlertCount({ expiring: d.expiring.length, expired: d.expired.length })
      } else {
        setExpiryAlertCount(null)
      }

      if (canViewRevenue) {
        const currentPeriod = periodRef.current
        const trendPayload = currentPeriod === 'custom'
          ? { period: 'custom' as const, customFrom: customFrom || undefined, customTo: customTo || undefined }
          : { period: currentPeriod }
        const [trendRes, prodRes] = await Promise.all([
          api.analytics.getRevenueTrend(trendPayload),
          canViewInventory
            ? api.analytics.getTopProducts({ limit: 8 })
            : Promise.resolve({ success: true, data: [] })
        ])
        if (trendRes.success) setTrend((trendRes.data as TrendPoint[]) ?? [])
        if (prodRes.success) setTopProducts((prodRes.data as TopProduct[]) ?? [])
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [canViewRevenue, canViewInventory, customFrom, customTo, isModuleEnabled, toastError, t])

  // loadTrend: only the chart — fast, no full-page skeleton
  const loadTrend = useCallback(async (p: Period, cfrom?: string, cto?: string) => {
    if (!canViewRevenue) return
    setTrendLoading(true)
    try {
      const payload = p === 'custom'
        ? { period: 'custom' as const, customFrom: cfrom || undefined, customTo: cto || undefined }
        : { period: p }
      const res = await api.analytics.getRevenueTrend(payload)
      if (res.success) setTrend((res.data as TrendPoint[]) ?? [])
      else toastError(t('common.error'), res.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setTrendLoading(false)
    }
  }, [canViewRevenue, toastError, t])

  // Full reload on mount and when permissions change. On the mount fire only
  // (not on later re-fires caused by e.g. custom-date-range changes), force a
  // fresh KPI fetch if the onboarding checklist was still incomplete last time
  // we knew — see loadAll's comment above for why.
  useEffect(() => {
    if (!didInitialLoad.current) {
      didInitialLoad.current = true
      const wasIncomplete = sessionStorage.getItem('sarang-onboarding-incomplete') !== '0'
      loadAll(wasIncomplete)
    } else {
      loadAll()
    }
  }, [loadAll])

  // Reload only trend when named period changes — skips the initial mount fire
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return }
    if (period !== 'custom') loadTrend(period)
  }, [period]) // eslint-disable-line react-hooks/exhaustive-deps

  function onPeriodChange(p: Exclude<Period, 'custom'>) {
    periodRef.current = p
    setPeriod(p)
  }

  function onSelectCustom() {
    periodRef.current = 'custom'
    setPeriod('custom')
  }

  function applyCustomRange() {
    if (!customFrom || !customTo) return
    loadTrend('custom', customFrom, customTo)
  }

  function dismissOnboarding() {
    localStorage.setItem('sarang-onboarding-dismissed', '1')
    setOnboardingDismissed(true)
  }

  // The owner types the question here on the home screen, but the answer is
  // rendered on the dedicated AI Assistant screen (model load / inference
  // has nowhere sensible to live inline on the Dashboard) — the question is
  // handed over via router state and AiAssistantScreen auto-asks it on
  // arrival (see that screen's own initialQuestion effect).
  function handleAskFromDashboard(e: React.FormEvent) {
    e.preventDefault()
    const q = aiQuestion.trim()
    if (!q) return
    setAiQuestion('')
    navigate('/ai-assistant', { state: { initialQuestion: q } })
  }

  const hasProducts = (kpis?.inventoryStats?.total ?? 0) > 0
  const hasCustomers = (kpis?.customerCount ?? 0) > 0
  const hasInvoice = (kpis?.totalInvoices ?? 0) > 0
  const showOnboarding = !onboardingDismissed && kpis !== null && (!hasProducts || !hasCustomers || !hasInvoice)

  // Remember whether the checklist is still relevant so the next mount (e.g.
  // navigating back here right after adding a customer) knows to force a fresh
  // KPI fetch instead of trusting the up-to-60s-old cache.
  useEffect(() => {
    if (kpis === null) return
    sessionStorage.setItem('sarang-onboarding-incomplete', showOnboarding ? '1' : '0')
  }, [kpis, showOnboarding])

  const kpiCards = kpis
    ? buildKpiCards(kpis, fmt, canViewRevenue, canViewInventory, canViewProfit, canViewExpenses, t)
    : []

  const bizType = profile?.businessType ?? 'RETAIL'

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">

      {/* ─── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {profile?.showLogoOnDashboard && profile?.logoPath && (
            <img
              src={documentLogoUrl(profile.logoPath)}
              alt=""
              className="w-10 h-10 rounded-lg object-contain bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1"
            />
          )}
          <div>
            <h2 className="text-lg font-bold text-dark dark:text-slate-100">{profile?.businessName ?? 'Dashboard'}</h2>
            <p className="text-sm text-slate-400">{t('dashboard.title')} — {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
        <button onClick={() => loadAll(true)} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:border-brand hover:text-brand transition-colors disabled:opacity-50">
          <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
          {t('common.refresh')}
        </button>
      </div>

      {/* ─── Ask Sarang (AI Assistant entry point) ───────────────────────
          Placed first, right under the header — the most visible slot on
          the home screen — so it's the first thing a business owner sees,
          not buried in the Quick Actions grid below. Owner types the
          question right here; the answer renders on the dedicated AI
          Assistant screen (handleAskFromDashboard hands the question over
          via router state). */}
      {canUseAi && (
        <form onSubmit={handleAskFromDashboard}
          className="w-full flex items-center gap-3 bg-gradient-to-r from-brand/10 to-brand/5 border border-brand/20 rounded-xl p-3 focus-within:border-brand/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center shrink-0">
            <Sparkles size={18} className="text-brand" />
          </div>
          <input
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            placeholder="Ask Sarang about your sales, stock, customers, or profit..."
            className="flex-1 h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-dark dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand placeholder:text-slate-400"
          />
          <button type="submit" disabled={!aiQuestion.trim()}
            className="h-11 px-4 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-40 transition-colors shrink-0">
            Ask →
          </button>
        </form>
      )}

      {/* ─── Onboarding ───────────────────────────────────────────────── */}
      {showOnboarding && (
        <div className="bg-brand/5 border border-brand/20 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-brand mb-1">Getting started with Sarang</p>
              <p className="text-xs text-slate-500 mb-3">Complete these steps to start managing your business</p>
              <div className="space-y-2">
                {[
                  { done: hasProducts, label: 'Add your first product', path: '/products' },
                  { done: hasCustomers, label: 'Add a customer', path: '/customers' },
                  { done: hasInvoice, label: 'Create your first invoice', path: '/billing' }
                ].map(step => (
                  <div key={step.label} className="flex items-center gap-3 text-sm">
                    <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold',
                      step.done ? 'bg-brand border-brand text-white' : 'border-slate-300 text-slate-300')}>
                      {step.done ? <CheckCircle size={12} /> : ''}
                    </div>
                    <span className={cn(step.done ? 'line-through text-slate-400' : 'text-dark dark:text-slate-200')}>
                      {step.label}
                    </span>
                    {!step.done && (
                      <button onClick={() => navigate(step.path)} className="ml-auto text-xs text-brand font-semibold hover:underline">
                        Go →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <button onClick={dismissOnboarding} className="text-slate-400 hover:text-slate-600 mt-0.5 shrink-0">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ─── Alerts ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {alerts.map((alert, i) => (
          <motion.div key={alert.type} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.05 }}
            className={cn('flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium',
              alert.severity === 'danger' ? 'bg-danger/10 text-danger border border-danger/20' : 'bg-warning/10 text-warning border border-warning/20')}>
            <AlertCircle size={15} className="shrink-0" />
            <span className="flex-1">{alert.message}</span>
            {/* Reminders are a manual-send queue by design (no auto-delivery — see
                TRUST_HARDENING_MASTER_PROMPT.md Section 0) — a one-click path
                straight from the alert is what actually gets someone to act on it
                instead of it sitting unnoticed until the queue screen is opened. */}
            {alert.type === 'PENDING_REMINDERS' && (
              <button onClick={() => navigate('/service-notifications')} className="text-xs font-semibold underline shrink-0">
                {t('dashboard.reviewReminders')}
              </button>
            )}
            {alert.type === 'AUDIT_LOG_FAILURE' && (
              <button onClick={() => navigate('/audit')} className="text-xs font-semibold underline shrink-0">
                {t('dashboard.reviewAuditLog')}
              </button>
            )}
            {alert.type === 'RENTAL_OVERDUE' && (
              <button onClick={() => navigate('/rental/bookings')} className="text-xs font-semibold underline shrink-0">
                {t('dashboard.reviewRentals')}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* ─── Industry Widgets ─────────────────────────────────────── */}
      {isModuleEnabled('kot') && kpis && (
        <div className="grid grid-cols-2 gap-3">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-warning/5 border border-warning/20 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center shrink-0">
              <Utensils size={18} className="text-warning" />
            </div>
            <div>
              <p className="text-xl font-bold text-dark dark:text-slate-100">{kpis.kotPending ?? 0}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">KOTs {t('dashboard.kotPending')}</p>
            </div>
            <button onClick={() => navigate('/restaurant/kot')}
              className="ml-auto text-xs text-brand hover:underline">{t('common.view')}</button>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-brand/5 border border-brand/20 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center shrink-0">
              <Zap size={18} className="text-brand" />
            </div>
            <div>
              <p className="text-xl font-bold text-dark dark:text-slate-100">{kpis.kotInProgress ?? 0}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">KOTs {t('dashboard.kotInProgress')}</p>
            </div>
            <button onClick={() => navigate('/restaurant/kot')}
              className="ml-auto text-xs text-brand hover:underline">{t('common.view')}</button>
          </motion.div>
        </div>
      )}
      {/* Distributor's own widget, but Hardware also has credit_limit_enforcement
          (extends credit to trade customers per spec §9.4 "customer ledger with
          credit management") and had no dashboard widget of its own at all —
          reusing this one closes that gap without new backend work. */}
      {(isModuleEnabled('outstanding_analytics') || isModuleEnabled('credit_limit_enforcement')) && topOutstanding.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-danger" />
              <p className="text-sm font-semibold text-dark">{t('dashboard.outstandingBalance')}</p>
            </div>
            <button onClick={() => navigate('/distributor/outstanding')}
              className="text-xs text-brand hover:underline">{t('reports.outstandingReport')}</button>
          </div>
          <div className="space-y-2">
            {topOutstanding.slice(0, 5).map((c, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 truncate max-w-[200px]">{c.customerName}</span>
                <span className="font-semibold text-danger">{fmt(c.outstanding)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Retail's dashboard widget deliverable (spec §9.3) — was entirely
          missing; only Restaurant and Distributor had one. */}
      {isModuleEnabled('returns') && todayReturns && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center shrink-0">
            <Store size={18} className="text-warning" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-dark">{todayReturns.count} return{todayReturns.count !== 1 ? 's' : ''} today</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{fmt(todayReturns.totalRefunded)} refunded</p>
          </div>
          <button onClick={() => navigate('/returns')}
            className="text-xs text-brand hover:underline">{t('common.view')}</button>
        </div>
      )}
      {/* Shared by Agri Inputs and Pharmacy (both gate on expiry_tracking) —
          only shown once there's actually something to flag, same convention
          as the Returns widget above. */}
      {isModuleEnabled('expiry_tracking') && expiryAlertCount && (expiryAlertCount.expiring > 0 || expiryAlertCount.expired > 0) && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-danger/20 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-danger" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-dark">
              {expiryAlertCount.expired > 0 && `${expiryAlertCount.expired} batch${expiryAlertCount.expired !== 1 ? 'es' : ''} expired`}
              {expiryAlertCount.expired > 0 && expiryAlertCount.expiring > 0 && ' · '}
              {expiryAlertCount.expiring > 0 && `${expiryAlertCount.expiring} expiring within 30 days`}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Batch & expiry tracking</p>
          </div>
          <button onClick={() => navigate('/pharmacy/batches')}
            className="text-xs text-brand hover:underline">{t('common.view')}</button>
        </div>
      )}

      {/* ─── KPI Grid ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {kpiCards.map((card, i) => (
            <KpiCard key={card.label} card={card} index={i} />
          ))}
        </div>
      )}

      {/* ─── Revenue Chart + Top Products ────────────────────────────── */}
      {canViewRevenue && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Revenue trend with global date filter */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-dark dark:text-slate-100">{t('dashboard.netRevenue')} vs {t('dashboard.totalExpenses')}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{t('dashboard.salesChart')}</p>
              </div>
              {/* Global date filter: Today / Week / Month / Quarter / Year / Custom */}
              <div className="flex gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
                {NAMED_PERIODS.map(opt => (
                  <button key={opt.value} onClick={() => onPeriodChange(opt.value)} disabled={trendLoading}
                    className={cn('px-2 py-1 text-xs font-semibold rounded-lg transition-all',
                      period === opt.value ? 'bg-white dark:bg-slate-700 text-brand shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-dark dark:hover:text-slate-200')}>
                    {opt.label}
                  </button>
                ))}
                <button onClick={onSelectCustom} disabled={trendLoading}
                  className={cn('px-2 py-1 text-xs font-semibold rounded-lg transition-all',
                    period === 'custom' ? 'bg-white dark:bg-slate-700 text-brand shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-dark dark:hover:text-slate-200')}>
                  Custom
                </button>
              </div>
            </div>

            {/* Custom date range inputs */}
            {period === 'custom' && (
              <div className="flex items-center gap-2 mb-3 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand" />
                <span className="text-xs text-slate-400">to</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand" />
                <button onClick={applyCustomRange} disabled={!customFrom || !customTo || trendLoading}
                  className="text-xs font-semibold text-white bg-brand px-3 py-1 rounded-lg hover:bg-brand/90 disabled:opacity-40 transition-colors">
                  {t('common.apply')}
                </button>
              </div>
            )}

            {trendLoading ? (
              <div className="h-52 bg-slate-50 rounded-xl animate-pulse" />
            ) : trend.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-slate-400">{t('reports.noData')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00AEEF" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#00AEEF" stopOpacity={0} />
                    </linearGradient>
                    {canViewExpenses && (
                      <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    )}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                    formatter={(value: number, name: string) => [fmt(value), name === 'revenue' ? 'Revenue' : 'Expenses']} />
                  <Legend formatter={(v) => v === 'revenue' ? 'Revenue' : 'Expenses'} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Area type="monotone" dataKey="revenue" stroke="#00AEEF" strokeWidth={2} fill="url(#revGrad)" dot={false} />
                  {canViewExpenses && (
                    <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fill="url(#expGrad)" dot={false} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top Products */}
          {canViewInventory && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-1">{t('dashboard.topProducts')}</h3>
              <p className="text-xs text-slate-400 mb-4">{t('dashboard.salesChart')}</p>
              {topProducts.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-slate-400">{t('dashboard.noSalesToday')}</div>
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={topProducts.slice(0, 6)} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                      tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                    <YAxis type="category" dataKey="productName" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={80} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                      formatter={(value: number) => [fmt(value), 'Revenue']} />
                    <Bar dataKey="revenue" fill="#00AEEF" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Analytics Row: Outstanding + Inventory Health ───────────── */}
      {(canViewRevenue || canViewInventory) && kpis && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Outstanding Analytics */}
          {canViewRevenue && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={14} className="text-warning" />
                <div>
                  <h3 className="text-sm font-semibold text-dark dark:text-slate-100">{t('reports.outstandingReport')}</h3>
                  <p className="text-xs text-slate-400">{t('dashboard.outstandingBalance')}</p>
                </div>
              </div>
              {topOutstanding.length === 0 ? (
                <div className="h-36 flex items-center justify-center text-sm text-slate-400">
                  {t('common.noData')}
                </div>
              ) : (() => {
                const total = topOutstanding.reduce((s, r) => s + r.outstanding, 0)
                return (
                  <div className="space-y-3">
                    {topOutstanding.map(item => {
                      const pct = total > 0 ? (item.outstanding / total) * 100 : 0
                      return (
                        <div key={item.customerId}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium text-dark dark:text-slate-100 truncate max-w-[55%]">{item.customerName}</span>
                            <span className="text-warning font-semibold shrink-0">{fmt(item.outstanding)}</span>
                          </div>
                          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-2 bg-warning rounded-full transition-all" style={{ width: `${Math.max(pct, 4)}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}

          {/* Inventory Health */}
          {canViewInventory && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Package size={14} className="text-success" />
                <div>
                  <h3 className="text-sm font-semibold text-dark dark:text-slate-100">{t('dashboard.lowStockItems')}</h3>
                  <p className="text-xs text-slate-400">
                    {kpis.inventoryStats.total} {t('nav.products').toLowerCase()}
                  </p>
                </div>
              </div>
              {kpis.inventoryStats.total === 0 ? (
                <div className="h-36 flex items-center justify-center text-sm text-slate-400">{t('common.noData')}</div>
              ) : (
                <div className="space-y-4 mt-2">
                  {[
                    { label: t('common.active'), count: kpis.inventoryStats.inStock, barColor: 'bg-success', textColor: 'text-success' },
                    { label: t('inventory.lowStock'), count: kpis.inventoryStats.lowStock, barColor: 'bg-warning', textColor: 'text-warning' },
                    { label: t('inventory.noStock'), count: kpis.inventoryStats.outOfStock, barColor: 'bg-danger', textColor: 'text-danger' }
                  ].map(row => {
                    const pct = kpis.inventoryStats.total > 0
                      ? (row.count / kpis.inventoryStats.total) * 100
                      : 0
                    return (
                      <div key={row.label}>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-slate-500">{row.label}</span>
                          <span className={cn('font-semibold', row.textColor)}>
                            {row.count} <span className="text-slate-400 font-normal">({pct.toFixed(0)}%)</span>
                          </span>
                        </div>
                        <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={cn('h-2.5 rounded-full transition-all duration-500', row.barColor)}
                            style={{ width: `${row.count > 0 ? Math.max(pct, 3) : 0}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Bottom row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={14} className="text-brand" />
            <h3 className="text-sm font-semibold text-dark dark:text-slate-100">{t('audit.title')}</h3>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">{t('audit.noLogs')}</p>
          ) : (
            <div className="space-y-1">
              {activity.map(item => (
                <div key={item.id} className="flex items-center gap-3 py-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
                  <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                    <CheckCircle size={12} className="text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-dark dark:text-slate-100 truncate">{actionLabel(item.action)}{item.entityType ? ` · ${item.entityType}` : ''}</p>
                    <p className="text-xs text-slate-400">{item.user}</p>
                  </div>
                  <span className="text-xs text-slate-300 dark:text-slate-500 shrink-0">{relativeTime(item.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions + Industry Spotlight */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={14} className="text-brand" />
              <h3 className="text-sm font-semibold text-dark dark:text-slate-100">{t('dashboard.quickActions')}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: t('billing.newInvoice'), path: '/billing/new', icon: <ShoppingCart size={22} />, color: 'text-brand bg-brand/10' },
                { label: t('products.addProduct'), path: '/products?action=new', icon: <Package size={22} />, color: 'text-success bg-success/10' },
                { label: t('customers.addCustomer'), path: '/customers?action=new', icon: <Users size={22} />, color: 'text-purple-600 bg-purple-50' },
                { label: t('nav.reports'), path: '/reports', icon: <TrendingUp size={22} />, color: 'text-info bg-info/10' },
                { label: t('nav.inventory'), path: '/inventory', icon: <Layers size={22} />, color: 'text-slate-600 bg-slate-100' },
                { label: t('nav.backup'), path: '/backup', icon: <AlertTriangle size={22} />, color: 'text-warning bg-warning/10' }
              ].map(a => (
                <button key={a.label} onClick={() => navigate(a.path)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-brand/30 hover:bg-brand/5 hover:shadow-sm transition-all text-center">
                  <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', a.color)}>{a.icon}</div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 leading-tight">{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          <IndustrySpotlight bizType={bizType} kpis={kpis} fmt={fmt} topCategories={topCategories} canViewRevenue={canViewRevenue} canViewInventory={canViewInventory} />
        </div>
      </div>

      {/* ─── Aszurex footer ──────────────────────────────────────────── */}
      <div className="bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
        <p className="text-xs font-medium text-brand inline-flex items-center gap-1.5">
          Sarang Business OS Lite · Powered by Aszurex <AszurexMark width={12} />
        </p>
        <p className="text-xs text-slate-400">Your data stays on your device. No cloud. No tracking.</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────────────────────────────────────

interface KpiCardData {
  label: string; value: string; trend?: number; trendLabel?: string
  icon: React.ReactNode; colorClass: string; locked?: boolean; tooltip?: string
}

function buildKpiCards(
  d: DashboardKpis, fmt: (n: number) => string,
  canRevenue: boolean, canInventory: boolean, canProfit: boolean, canExpenses: boolean,
  t: (key: string) => string
): KpiCardData[] {
  return [
    {
      label: t('dashboard.todaySales'), value: fmt(d.todaySales), trend: d.todayTrend, trendLabel: t('common.today'),
      icon: <ShoppingCart size={16} />, colorClass: 'text-brand bg-brand/10'
    },
    {
      label: t('dashboard.weekSales'), value: canRevenue ? fmt(d.weekSales) : '—',
      trend: canRevenue ? d.weekTrend : undefined, trendLabel: t('common.thisWeek'),
      icon: <TrendingUp size={16} />, colorClass: 'text-info bg-info/10', locked: !canRevenue
    },
    {
      label: t('dashboard.monthSales'), value: fmt(d.monthSales), trend: d.monthTrend, trendLabel: t('common.thisMonth'),
      icon: <TrendingUp size={16} />, colorClass: 'text-purple-600 bg-purple-50'
    },
    {
      label: t('dashboard.outstandingBalance'), value: fmt(d.outstanding),
      icon: <AlertTriangle size={16} />, colorClass: 'text-warning bg-warning/10'
    },
    {
      label: t('nav.inventory'), value: canInventory ? fmt(d.inventoryValue) : '—',
      icon: <Package size={16} />, colorClass: 'text-success bg-success/10', locked: !canInventory
    },
    {
      label: t('dashboard.totalExpenses'), value: canExpenses ? fmt(d.monthExpenses) : '—',
      trend: canExpenses ? d.expenseTrend : undefined, trendLabel: t('common.thisMonth'),
      icon: <DollarSign size={16} />, colorClass: 'text-danger bg-danger/10', locked: !canExpenses
    },
    {
      label: t('dashboard.profitEstimate'), value: canProfit ? fmt(d.estimatedProfit) : '—',
      trend: canProfit ? d.profitTrend : undefined, trendLabel: t('common.thisMonth'),
      icon: <TrendingUp size={16} />,
      colorClass: !canProfit
        ? 'text-slate-400 bg-slate-100'
        : d.estimatedProfit >= 0 ? 'text-success bg-success/10' : 'text-danger bg-danger/10',
      locked: !canProfit,
      tooltip: t('dashboard.profitEstimateDisclaimer')
    },
    {
      label: t('dashboard.lowStockItems'), value: String(d.lowStockCount),
      icon: <AlertCircle size={16} />, colorClass: d.lowStockCount > 0 ? 'text-orange-600 bg-orange-50' : 'text-slate-400 bg-slate-100'
    },
    {
      label: t('dashboard.customers'), value: String(d.customerCount),
      icon: <Users size={16} />, colorClass: 'text-info bg-info/10'
    },
    {
      label: t('nav.suppliers'), value: String(d.supplierCount),
      icon: <Truck size={16} />, colorClass: 'text-slate-600 bg-slate-100'
    }
  ]
}

const KpiCard = memo(function KpiCard({ card, index }: { card: KpiCardData; index: number }) {
  const { t } = useTranslation()
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-2.5">
        <p className="text-sm font-medium text-slate-500 leading-tight pr-1" title={card.tooltip}>
          {card.label}{card.tooltip && <span className="text-slate-300 ml-1" aria-hidden="true">ⓘ</span>}
        </p>
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', card.colorClass)}>
          {card.icon}
        </div>
      </div>
      <p className={cn('text-xl font-bold', card.locked ? 'text-slate-300 dark:text-slate-600' : 'text-dark dark:text-slate-100')}>{card.value}</p>
      {card.trend !== undefined && !card.locked && (
        <div className={cn('flex items-center gap-1 mt-1', card.trend >= 0 ? 'text-success' : 'text-danger')}>
          {card.trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span className="text-sm">{Math.abs(card.trend).toFixed(1)}% {card.trendLabel}</span>
        </div>
      )}
      {card.locked && (
        <p className="text-sm text-slate-300 dark:text-slate-600 mt-1">{t('common.na')}</p>
      )}
    </motion.div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Industry Spotlight — contextual metrics by business type (§6.3)
// ─────────────────────────────────────────────────────────────────────────────

function IndustrySpotlight({
  bizType, kpis, fmt, topCategories, canViewRevenue, canViewInventory
}: {
  bizType: string
  kpis: DashboardKpis | null
  fmt: (n: number) => string
  topCategories: TopCategory[]
  canViewRevenue: boolean
  canViewInventory: boolean
}) {
  const type = bizType.toUpperCase()
  const navigate = useNavigate()

  // Fresh-audit fix (2026-07-12) — Jewellery previously had zero dashboard
  // presence, unlike every other vertical with a Focus card here. Called
  // unconditionally (Rules of Hooks) but only actually fetches for JEWELLERY.
  const [jewelleryRates, setJewelleryRates] = useState<{ metalType: string; purity: string; ratePerGram: number }[] | null>(null)
  useEffect(() => {
    if (!bizType.toUpperCase().includes('JEWELLERY')) return
    let cancelled = false
    void api.metalRate.list().then(res => {
      if (!cancelled && res.success) setJewelleryRates(res.data as typeof jewelleryRates)
    })
    return () => { cancelled = true }
  }, [bizType])

  if (type.includes('JEWELLERY')) {
    const todaysRate = jewelleryRates?.find(r => r.metalType === 'GOLD') ?? jewelleryRates?.[0]
    return (
      <SpotlightCard
        icon={<Gem size={14} />}
        title="Jewellery Focus"
        items={[
          todaysRate
            ? { label: `Today's Rate — ${todaysRate.metalType} ${todaysRate.purity}`, value: `${fmt(todaysRate.ratePerGram)}/g` }
            : { label: 'Metal Rates', value: jewelleryRates === null ? '—' : 'Not Set', onClick: '/jewellery/metal-rates' },
          { label: 'Metal Rates Configured', value: jewelleryRates !== null ? String(jewelleryRates.length) : '—', onClick: '/jewellery/metal-rates' },
          { label: 'Old-Metal Exchanges', value: 'View →', onClick: '/jewellery/exchanges' }
        ]}
        navigate={navigate}
      />
    )
  }

  if (type.includes('RESTAURANT') || type.includes('FOOD') || type.includes('CAFE')) {
    return (
      <SpotlightCard
        icon={<Utensils size={14} />}
        title="Restaurant Focus"
        items={[
          { label: "Today's Revenue", value: kpis ? fmt(kpis.todaySales) : '—' },
          { label: 'Low Stock Ingredients', value: kpis ? String(kpis.lowStockCount) : '—' },
          { label: 'Tables Occupied', value: kpis?.occupiedTables !== undefined ? String(kpis.occupiedTables) : 'View →', onClick: '/restaurant/tables' }
        ]}
        navigate={navigate}
      />
    )
  }

  if (type.includes('HARDWARE') || type.includes('GLASS') || type.includes('PLYWOOD') || type.includes('BUILDING')) {
    return (
      <SpotlightCard
        icon={<HardHat size={14} />}
        title="Hardware Focus"
        items={[
          { label: 'Customer Outstanding', value: kpis ? fmt(kpis.outstanding) : '—' },
          { label: 'Inventory Value', value: kpis && canViewInventory ? fmt(kpis.inventoryValue) : '—' },
          { label: 'Credit Customers', value: 'View →', onClick: '/customers' }
        ]}
        navigate={navigate}
      />
    )
  }

  if (type.includes('DISTRIBUTOR') || type.includes('WHOLESALE')) {
    return (
      <SpotlightCard
        icon={<Layers size={14} />}
        title="Distribution Focus"
        items={[
          { label: 'Outstanding Dues', value: kpis ? fmt(kpis.outstanding) : '—' },
          { label: 'This Week Sales', value: kpis && canViewRevenue ? fmt(kpis.weekSales) : '—' },
          { label: 'Active Suppliers', value: kpis ? String(kpis.supplierCount) : '—' }
        ]}
        navigate={navigate}
      />
    )
  }

  // Default: Retail — shows Top Categories per §6.3
  const topCatItem = topCategories.length > 0
    ? { label: `Top: ${topCategories[0].categoryName}`, value: fmt(topCategories[0].revenue) }
    : { label: "Today's Invoices", value: 'View →', onClick: '/billing' }

  return (
    <SpotlightCard
      icon={<Store size={14} />}
      title="Retail Focus"
      items={[
        topCatItem,
        { label: 'Low Stock Items', value: kpis ? String(kpis.lowStockCount) : '—' },
        { label: 'Top Categories', value: 'View →', onClick: '/reports' }
      ]}
      navigate={navigate}
    />
  )
}

function SpotlightCard({ icon, title, items, navigate }: {
  icon: React.ReactNode
  title: string
  items: { label: string; value: string; onClick?: string }[]
  navigate: ReturnType<typeof useNavigate>
}) {
  return (
    <div className="bg-brand/5 border border-brand/15 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-brand">{icon}</div>
        <span className="text-xs font-semibold text-brand">{title}</span>
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{item.label}</span>
            {item.onClick ? (
              <button onClick={() => navigate(item.onClick!)} className="text-xs font-semibold text-brand hover:underline">{item.value}</button>
            ) : (
              <span className="text-xs font-semibold text-dark dark:text-slate-100">{item.value}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
