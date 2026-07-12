import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Package, RefreshCw, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@renderer/services/ipc-client'
import { useIndustryStore } from '@app/store/industry.store'
import { useBusinessStore } from '@app/store/business.store'
import { Badge } from '@shared/ui/atoms/Badge'
import { Card } from '@shared/ui/molecules/Card'
import { cn } from '@shared/utils/cn'
import { useNotificationStore } from '@app/store/notification.store'

interface SessionPack {
  id: string
  packName: string
  totalSessions: number
  usedSessions: number
  purchaseDate: string
  expiryDate: string | null
  pricePerPack: number
  isActive: boolean
  customer: { id: string; customerName: string; phone: string | null }
}

type Band = 'LOW' | 'EXPIRED' | 'ACTIVE'

function getBand(pack: SessionPack): Band {
  if (pack.expiryDate && new Date(pack.expiryDate) < new Date()) return 'EXPIRED'
  const remaining = pack.totalSessions - pack.usedSessions
  if (remaining <= 2) return 'LOW'
  return 'ACTIVE'
}

// Band is a purely client-derived classification (computed by getBand() above from
// expiryDate/remaining sessions, not a backend-set field — ClientSessionPack has no
// `status` column in prisma/schema.prisma). getBand()'s switch is exhaustive over the
// 3-value Band union, so this map is complete by construction.
const BAND_CONFIG: Record<Band, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  EXPIRED: { label: 'Expired',      color: 'text-danger',    bg: 'bg-danger/5',    border: 'border-danger/20',   icon: <AlertTriangle size={13} /> },
  LOW:     { label: 'Running Low',  color: 'text-warning',   bg: 'bg-warning/5',   border: 'border-warning/20',  icon: <Clock size={13} /> },
  ACTIVE:  { label: 'Active',       color: 'text-success',   bg: 'bg-success/5',   border: 'border-success/20',  icon: <CheckCircle2 size={13} /> },
}

const BAND_VARIANT: Record<Band, 'danger' | 'warning' | 'success'> = {
  EXPIRED: 'danger',
  LOW: 'warning',
  ACTIVE: 'success',
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function SessionPacksScreen() {
  const navigate = useNavigate()
  const hasSessionPacks = useIndustryStore((s) => s.isModuleEnabled('session_packs'))
  const currSym = useBusinessStore((s) => s.profile?.currencySymbol ?? '₹')
  const { error: toastError } = useNotificationStore()

  const [packs, setPacks] = useState<SessionPack[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Band | 'ALL'>('ALL')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.sessionPack.listAll()
      if (res.success && res.data) setPacks(res.data as SessionPack[])
      else toastError('Error', res.error?.message ?? 'Could not load session packs.')
    } catch {
      toastError('Error', 'Could not load session packs.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { load() }, [load])

  if (!hasSessionPacks) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Package size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Session Packs are not enabled for your business type.</p>
        </div>
      </div>
    )
  }

  const filtered = packs.filter((p) => {
    if (filter !== 'ALL' && getBand(p) !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return p.customer.customerName.toLowerCase().includes(q) || (p.customer.phone ?? '').includes(q)
    }
    return true
  })

  const counts: Record<Band | 'ALL', number> = {
    ALL:     packs.length,
    ACTIVE:  packs.filter((p) => getBand(p) === 'ACTIVE').length,
    LOW:     packs.filter((p) => getBand(p) === 'LOW').length,
    EXPIRED: packs.filter((p) => getBand(p) === 'EXPIRED').length,
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center">
            <Package size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-dark dark:text-slate-100">Session Packs</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{packs.length} pack{packs.length !== 1 ? 's' : ''} tracked</p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 shrink-0 flex-wrap">
        {(['ALL', 'ACTIVE', 'LOW', 'EXPIRED'] as const).map((b) => {
          const cfg = b === 'ALL' ? null : BAND_CONFIG[b]
          const isActive = filter === b
          return (
            <button
              key={b}
              onClick={() => setFilter(b)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1 ${
                isActive
                  ? cfg ? `${cfg.color} ${cfg.bg} ${cfg.border}` : 'text-brand bg-brand/5 border-brand/20'
                  : 'text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}
            >
              {cfg && <span className={cfg.color}>{cfg.icon}</span>}
              {b === 'ALL' ? 'All' : BAND_CONFIG[b].label}
              <span className={`ml-0.5 ${isActive ? '' : 'text-slate-400'}`}>({counts[b]})</span>
            </button>
          )
        })}
        <input
          type="text"
          placeholder="Search patient..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-2 h-8 px-3 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package size={32} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No session packs found</p>
            <p className="text-xs text-slate-400 mt-1">
              {filter !== 'ALL' ? 'Try a different filter.' : 'Add session packs from the patient physio screen.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((pack) => {
              const band = getBand(pack)
              const cfg = BAND_CONFIG[band]
              const remaining = pack.totalSessions - pack.usedSessions
              return (
                <motion.div
                  key={pack.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                <Card
                  padding="md"
                  className={cn('flex items-center gap-4 hover:shadow-sm transition-all cursor-pointer', cfg.border)}
                  onClick={() => navigate(`/physio/patient/${pack.customer.id}`)}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.color}`}>
                    {cfg.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-dark dark:text-slate-100 truncate">{pack.customer.customerName}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      <span>{pack.packName}</span>
                      {pack.customer.phone && <span>{pack.customer.phone}</span>}
                      <span>{currSym}{Number(pack.pricePerPack).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className={`text-lg font-bold ${remaining <= 2 ? 'text-warning' : 'text-success'}`}>{remaining}</p>
                    <p className="text-xs text-slate-400">of {pack.totalSessions} left</p>
                  </div>

                  <div className="text-right shrink-0">
                    {pack.expiryDate ? (
                      <>
                        <p className={`text-xs font-medium ${band === 'EXPIRED' ? 'text-danger' : 'text-slate-600 dark:text-slate-300'}`}>{fmt(pack.expiryDate)}</p>
                        <p className="text-[10px] text-slate-400">expiry</p>
                      </>
                    ) : (
                      <p className="text-xs text-slate-400">No expiry</p>
                    )}
                  </div>

                  <Badge variant={BAND_VARIANT[band]} size="sm" className="shrink-0">
                    {cfg.label}
                  </Badge>
                </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
