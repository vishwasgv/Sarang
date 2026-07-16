import React, { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'

// Wall-board rendering of the same KOT queue KOTScreen.tsx shows — used both
// by the second-monitor window (mouse/keyboard on the billing PC, see
// kitchen-display-window.ts) and, conceptually, mirrored by the vanilla-JS
// LAN page any phone/laptop opens (resources/kitchen-display/index.html).
// Deliberately no sidebar/filters/print button — this is meant to be glanced
// at from across a kitchen, not operated like the full KOTScreen.

interface KOTItem { id: string; product: { productName: string }; quantity: number }
interface KOT {
  id: string
  status: string
  createdAt: string
  table?: { tableNumber: string; tableName?: string | null } | null
  invoice: { invoiceNumber: string; items: KOTItem[] }
}

const NEXT_STATUS: Record<string, string | null> = { PENDING: 'IN_PROGRESS', IN_PROGRESS: 'DONE', DONE: null }
const NEXT_LABEL: Record<string, string> = { PENDING: 'Start Cooking', IN_PROGRESS: 'Mark Done' }
const POLL_MS = 15000
const MAX_DONE_SHOWN = 6

function TicketCard({ kot, onAdvance, busy }: { kot: KOT; onAdvance: (kot: KOT) => void; busy: boolean }) {
  const next = NEXT_STATUS[kot.status]
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xl font-bold text-dark dark:text-slate-100">{kot.table?.tableName || kot.table?.tableNumber || kot.invoice.invoiceNumber}</p>
          <p className="text-sm text-slate-400">{new Date(kot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>
      <div className="space-y-1.5">
        {kot.invoice.items.map(item => (
          <div key={item.id} className="flex justify-between text-lg text-dark dark:text-slate-100">
            <span>{item.product.productName}</span>
            <span className="font-bold">× {item.quantity}</span>
          </div>
        ))}
      </div>
      {next && (
        <button
          onClick={() => onAdvance(kot)}
          disabled={busy}
          className="w-full py-3.5 rounded-xl bg-brand text-white text-base font-bold hover:bg-brand/90 transition-colors disabled:opacity-50"
        >
          {busy ? 'Updating…' : NEXT_LABEL[kot.status]}
        </button>
      )}
    </div>
  )
}

function Column({ title, icon, colorClass, kots, onAdvance, busyId }: {
  title: string; icon: React.ReactNode; colorClass: string; kots: KOT[]; onAdvance: (kot: KOT) => void; busyId: string | null
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className={cn('flex items-center gap-2 px-4 py-3 rounded-xl mb-3', colorClass)}>
        {icon}
        <h2 className="text-lg font-bold">{title}</h2>
        <span className="ml-auto text-lg font-bold">{kots.length}</span>
      </div>
      <div className="space-y-3">
        {kots.length === 0 ? (
          <p className="text-center text-slate-400 py-8 text-base">Nothing here</p>
        ) : (
          kots.map(kot => <TicketCard key={kot.id} kot={kot} onAdvance={onAdvance} busy={busyId === kot.id} />)
        )}
      </div>
    </div>
  )
}

export function KitchenDisplayBoardScreen() {
  const [kots, setKots] = useState<KOT[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const failedRef = useRef(false)

  const load = useCallback(async () => {
    try {
      const res = await api.restaurant.listKOTs({})
      if (res.success && res.data) {
        setKots(res.data as KOT[])
        setLastUpdated(new Date())
        failedRef.current = false
        setLoadFailed(false)
      } else if (!failedRef.current) {
        failedRef.current = true
        setLoadFailed(true)
      }
    } catch {
      if (!failedRef.current) { failedRef.current = true; setLoadFailed(true) }
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  async function handleAdvance(kot: KOT) {
    const next = NEXT_STATUS[kot.status]
    if (!next) return
    setBusyId(kot.id)
    try {
      await api.restaurant.updateKOTStatus({ kotId: kot.id, status: next })
    } finally {
      setBusyId(null)
      load()
    }
  }

  const pending = kots.filter(k => k.status === 'PENDING')
  const inProgress = kots.filter(k => k.status === 'IN_PROGRESS')
  const done = kots.filter(k => k.status === 'DONE').slice(0, MAX_DONE_SHOWN)

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950 p-6 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-slate-100">Kitchen Display</h1>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          {loadFailed && <span className="text-danger font-semibold">Connection issue — retrying…</span>}
          <RefreshCw size={14} />
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Loading…'}
        </div>
      </div>
      <div className="flex gap-6 flex-1">
        <Column title="Pending" icon={<Clock size={20} />} colorClass="bg-warning/10 text-warning" kots={pending} onAdvance={handleAdvance} busyId={busyId} />
        <Column title="In Progress" icon={<AlertTriangle size={20} />} colorClass="bg-brand/10 text-brand" kots={inProgress} onAdvance={handleAdvance} busyId={busyId} />
        <Column title="Recently Done" icon={<CheckCircle2 size={20} />} colorClass="bg-success/10 text-success" kots={done} onAdvance={handleAdvance} busyId={busyId} />
      </div>
    </div>
  )
}
