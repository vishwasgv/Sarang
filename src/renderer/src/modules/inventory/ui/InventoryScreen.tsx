import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Warehouse, AlertTriangle, Package, ClipboardList, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'
import { DataTable } from '@shared/ui/organisms/DataTable'
import { Button } from '@shared/ui/atoms/Button'
import { Tabs } from '@shared/ui/molecules/Tabs'
import { StockAdjustmentModal } from './StockAdjustmentModal'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'
import { cn } from '@shared/utils/cn'

interface Category { id: string; name: string }
interface InventoryItem {
  id: string
  productId: string
  quantity: number
  reservedQuantity: number
  reorderLevel: number
  reorderQuantity: number
  averageCost: number
  product: {
    id: string
    productName: string
    sku?: string | null
    unit: string
    isActive: boolean
    category?: Category | null
  }
}

export function InventoryScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const { error: toastError } = useNotificationStore()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [adjustTarget, setAdjustTarget] = useState<InventoryItem | null>(null)
  const [page, setPage] = useState(1)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [outOfStockCount, setOutOfStockCount] = useState(0)
  const limit = 50

  const canAdjust = hasPermission('inventory.adjustStock')
  const canViewMovements = hasPermission('inventory.viewMovements')
  // This button navigates to the PO list/detail screens, it doesn't create a PO —
  // gate it on the same permission that actually guards that route (.view), not
  // .create, so staff who can only view/receive POs still get the shortcut.
  const canViewPOs = hasPermission('purchaseOrders.view')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, valueRes] = await Promise.all([
        window.api.inventory.list({ lowStockOnly, page, limit }),
        window.api.inventory.getInventoryValue()
      ])
      if (listRes.success) {
        const d = listRes.data as { inventory: InventoryItem[]; total: number }
        setInventory(d.inventory ?? [])
        setTotal(d.total ?? 0)
      } else {
        toastError(t('common.error'), listRes.error?.message ?? t('common.error'))
      }
      // Low/out-of-stock badges must reflect the FULL catalog, not just the
      // current page — otherwise they silently go wrong for >50 active products.
      if (valueRes.success) {
        const v = valueRes.data as { lowStockCount: number; outOfStockCount: number }
        setLowStockCount(v.lowStockCount ?? 0)
        setOutOfStockCount(v.outOfStockCount ?? 0)
      } else {
        toastError(t('common.error'), valueRes.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [lowStockOnly, page, toastError, t])

  useEffect(() => { loadData() }, [loadData])

  const columns: ColumnDef<InventoryItem, unknown>[] = [
    {
      accessorFn: (r) => r.product.productName,
      id: 'productName',
      header: t('products.productName'),
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-dark dark:text-slate-100">{row.original.product.productName}</p>
          {row.original.product.sku && (
            <p className="text-xs text-slate-400 mt-0.5">SKU: {row.original.product.sku}</p>
          )}
        </div>
      )
    },
    {
      accessorFn: (r) => r.product.category?.name ?? '',
      id: 'category',
      header: t('products.category'),
      cell: ({ getValue }) => {
        const v = getValue() as string
        return v ? <span className="text-sm text-slate-600">{v}</span> : <span className="text-slate-300 text-sm">—</span>
      }
    },
    {
      accessorKey: 'quantity',
      header: t('inventory.currentStock'),
      cell: ({ row }) => {
        const { quantity, reorderLevel, product } = row.original
        const isLow = quantity <= reorderLevel
        const isOut = quantity === 0
        return (
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-sm font-semibold',
              isOut ? 'text-danger' : isLow ? 'text-warning' : 'text-success'
            )}>
              {quantity} {product.unit}
            </span>
            {isLow && !isOut && <AlertTriangle size={12} className="text-warning shrink-0" />}
            {isOut && <AlertTriangle size={12} className="text-danger shrink-0" />}
          </div>
        )
      }
    },
    {
      accessorKey: 'reorderLevel',
      header: t('inventory.reorderLevel'),
      cell: ({ row }) => (
        <span className="text-sm text-slate-500">{row.original.reorderLevel} {row.original.product.unit}</span>
      )
    },
    {
      accessorKey: 'averageCost',
      header: t('products.costPrice'),
      cell: ({ getValue }) => {
        const v = getValue() as number
        return <span className="text-sm text-slate-700 dark:text-slate-300">{v > 0 ? v.toFixed(2) : '—'}</span>
      }
    },
    {
      id: 'value',
      header: t('common.total'),
      cell: ({ row }) => {
        const val = row.original.quantity * row.original.averageCost
        return <span className="text-sm font-medium text-dark dark:text-slate-100">{val > 0 ? val.toFixed(2) : '—'}</span>
      }
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          {canAdjust && (
            <button
              onClick={(e) => { e.stopPropagation(); setAdjustTarget(row.original) }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-brand hover:bg-brand/10 transition-colors text-xs font-medium"
              title="Adjust Stock"
            >
              <SlidersHorizontal size={14} />
            </button>
          )}
        </div>
      )
    }
  ]

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
            <Warehouse size={20} className="text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark dark:text-slate-100">{t('nav.inventory')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{total} {t('nav.products').toLowerCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canViewMovements && (
            <Button variant="secondary" size="sm" onClick={() => navigate('/inventory/movements')}>
              <Package size={14} className="mr-1.5" /> {t('inventory.movements')}
            </Button>
          )}
          {canViewPOs && (
            <Button size="sm" onClick={() => navigate('/purchase-orders')}>
              <ClipboardList size={14} className="mr-1.5" /> {t('inventory.purchaseOrders')}
            </Button>
          )}
        </div>
      </div>

      {/* Alert bar */}
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div className="flex items-center gap-3 flex-wrap">
          {outOfStockCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger/10 border border-danger/20">
              <AlertTriangle size={14} className="text-danger" />
              <span className="text-sm font-medium text-danger">{outOfStockCount} {t('inventory.noStock')}</span>
            </div>
          )}
          {lowStockCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20">
              <AlertTriangle size={14} className="text-warning" />
              <span className="text-sm font-medium text-warning">{lowStockCount} {t('inventory.lowStock')}</span>
            </div>
          )}
        </div>
      )}

      {/* Filter toggle */}
      <Tabs
        tabs={[
          { id: 'all', label: t('common.all') },
          { id: 'low', label: t('inventory.lowStock'), icon: <AlertTriangle size={12} /> },
        ]}
        active={lowStockOnly ? 'low' : 'all'}
        onChange={(id) => { setLowStockOnly(id === 'low'); setPage(1) }}
      />

      {!loading && total === 0 && !lowStockOnly && (
        <div className="bg-brand/5 border border-brand/20 rounded-xl px-5 py-4 flex items-center gap-4">
          <Warehouse size={28} className="text-brand shrink-0" />
          <div>
            <p className="text-sm font-semibold text-brand">Set reorder levels to get low-stock alerts</p>
            <p className="text-xs text-slate-500 mt-0.5">Add products first, then come here to set stock quantities and reorder levels so you never run out.</p>
          </div>
        </div>
      )}
      <DataTable
        data={inventory}
        columns={columns}
        searchPlaceholder={t('products.searchProducts')}
        loading={loading}
        emptyMessage={lowStockOnly ? t('dashboard.noLowStock') : t('inventory.noInventory')}
      />

      {/* Server-side pagination — the table only ever holds one page (limit=50);
          search above only filters within the loaded page, by design. */}
      {total > limit && (
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>{t('audit.page')} {page} {t('audit.of')} {totalPages} · {total} {t('nav.products').toLowerCase()}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={14} className="mr-1" /> {t('inventory.previous')}
            </Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              {t('common.next')} <ChevronRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {adjustTarget && (
        <StockAdjustmentModal
          open={!!adjustTarget}
          inventoryItem={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onSaved={() => { setAdjustTarget(null); loadData() }}
        />
      )}
    </div>
  )
}
