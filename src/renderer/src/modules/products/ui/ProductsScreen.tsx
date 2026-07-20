import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Edit, Archive, Package, FolderOpen, Layers, UtensilsCrossed } from 'lucide-react'
import { DataTable } from '@shared/ui/organisms/DataTable'
import { Button } from '@shared/ui/atoms/Button'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { ProductFormModal } from './ProductFormModal'
import { CategoryManageModal } from './CategoryManageModal'
import { VariantManagementModal } from './VariantManagementModal'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { useIndustryStore } from '@app/store/industry.store'
import { cn } from '@shared/utils/cn'

interface Category { id: string; name: string }
interface Inventory { quantity: number; reorderLevel: number; reorderQuantity: number }
interface Product {
  id: string
  productName: string
  categoryId?: string | null
  sku?: string | null
  barcode?: string | null
  description?: string | null
  productType: 'STANDARD' | 'SERVICE'
  unit: string
  costPrice: number
  sellingPrice: number
  taxRate: number
  isActive: boolean
  unavailableUntil?: string | null
  category?: { id: string; name: string } | null
  inventory?: Inventory | null
}

export function ProductsScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const { isModuleEnabled } = useIndustryStore()
  const showVariants = isModuleEnabled('variant_tracking')
  const showKot = isModuleEnabled('kot')
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [catManageOpen, setCatManageOpen] = useState(false)
  const [variantProduct, setVariantProduct] = useState<Product | null>(null)

  const canCreate = hasPermission('products.create')
  const canUpdate = hasPermission('products.update')
  const canArchive = hasPermission('products.archive')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, cRes] = await Promise.all([
        window.api.products.list({ categoryId: selectedCategory || undefined }),
        window.api.categories.list()
      ])
      if (pRes.success) {
        const d = pRes.data as { products: Product[]; total: number }
        setProducts(d.products ?? [])
        setTotal(d.total ?? 0)
      } else {
        toastError(t('common.error'), pRes.error?.message ?? t('common.error'))
      }
      if (cRes.success) setCategories(cRes.data as Category[])
      else toastError(t('common.error'), cRes.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, toastError, t])

  useEffect(() => { loadData() }, [loadData])

  async function handleArchive() {
    if (!archiveTarget) return
    setArchiving(true)
    try {
      const res = await window.api.products.archive(archiveTarget.id)
      if (res.success) {
        toastSuccess(t('products.archiveProduct'), `${archiveTarget.productName}`)
        setArchiveTarget(null)
        loadData()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } finally {
      setArchiving(false)
    }
  }

  // Phase 58 §2 — "86 today". unavailableUntil set to 23:59:59.999 local
  // today marks it unavailable; clearing it back to null restores it
  // immediately — the field naturally self-expires at midnight since every
  // read-side check (menu listing, billing cart) compares against "now".
  async function handleToggle86(product: Product) {
    const isCurrently86d = product.unavailableUntil && new Date(product.unavailableUntil) > new Date()
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)
    const res = await window.api.products.setAvailability({
      id: product.id,
      unavailableUntil: isCurrently86d ? null : endOfToday.toISOString(),
    })
    if (res.success) {
      toastSuccess(isCurrently86d ? 'Available Again' : '86\'d for Today', product.productName)
      loadData()
    } else {
      toastError(t('common.error'), res.error?.message ?? t('common.error'))
    }
  }

  const columns: ColumnDef<Product, unknown>[] = [
    {
      accessorKey: 'productName',
      header: t('products.productName'),
      cell: ({ row }) => {
        const is86d = row.original.unavailableUntil && new Date(row.original.unavailableUntil) > new Date()
        return (
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-dark dark:text-slate-100">{row.original.productName}</p>
              {is86d && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-warning/10 text-warning">Unavailable Today</span>}
            </div>
            {row.original.sku && <p className="text-xs text-slate-400 mt-0.5">SKU: {row.original.sku}</p>}
          </div>
        )
      }
    },
    {
      accessorFn: (r) => r.category?.name ?? '',
      id: 'category',
      header: t('products.category'),
      cell: ({ getValue }) => {
        const v = getValue() as string
        return v ? <span className="text-sm text-slate-600">{v}</span> : <span className="text-slate-300 text-sm">—</span>
      }
    },
    {
      accessorKey: 'productType',
      header: t('products.productType'),
      cell: ({ getValue }) => {
        const v = getValue() as string
        return (
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', v === 'SERVICE' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700')}>
            {v === 'SERVICE' ? t('products.service') : t('products.physical')}
          </span>
        )
      }
    },
    {
      accessorKey: 'sellingPrice',
      header: t('products.sellingPrice'),
      cell: ({ row }) => (
        <div className="text-right">
          <p className="font-medium text-dark dark:text-slate-100">{row.original.sellingPrice.toFixed(2)}</p>
          <p className="text-xs text-slate-400">{row.original.unit}</p>
        </div>
      )
    },
    {
      id: 'stock',
      header: t('inventory.title'),
      cell: ({ row }) => {
        const inv = row.original.inventory
        if (!inv) return <span className="text-slate-300 text-sm">—</span>
        const low = inv.quantity <= inv.reorderLevel
        return (
          <span className={cn('text-sm font-medium', low ? 'text-danger' : 'text-success')}>
            {inv.quantity} {row.original.unit}
          </span>
        )
      }
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const is86d = row.original.unavailableUntil && new Date(row.original.unavailableUntil) > new Date()
        return (
        <div className="flex items-center gap-1 justify-end">
          {showKot && (
            <button onClick={(e) => { e.stopPropagation(); handleToggle86(row.original) }}
              className={cn('p-2.5 rounded-lg transition-colors', is86d ? 'text-warning hover:bg-warning/10' : 'text-slate-400 hover:text-warning hover:bg-warning/10')}
              title={is86d ? 'Mark available again' : "86 for today (mark unavailable until tomorrow)"}>
              <UtensilsCrossed size={16} />
            </button>
          )}
          {showVariants && (
            <button onClick={(e) => { e.stopPropagation(); setVariantProduct(row.original) }}
              className="p-2.5 rounded-lg text-slate-400 hover:text-brand hover:bg-brand/10 transition-colors"
              title="Manage Variants">
              <Layers size={16} />
            </button>
          )}
          {canUpdate && (
            <button onClick={(e) => { e.stopPropagation(); setEditProduct(row.original); setFormOpen(true) }}
              className="p-2.5 rounded-lg text-slate-400 hover:text-brand hover:bg-brand/10 transition-colors">
              <Edit size={16} />
            </button>
          )}
          {canArchive && (
            <button onClick={(e) => { e.stopPropagation(); setArchiveTarget(row.original) }}
              className="p-2.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/10 transition-colors">
              <Archive size={16} />
            </button>
          )}
        </div>
        )
      }
    }
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
            <Package size={20} className="text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark dark:text-slate-100">{t('nav.products')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{total} {t('nav.products').toLowerCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasPermission('products.create') && (
            <Button variant="secondary" size="md" onClick={() => setCatManageOpen(true)}>
              <FolderOpen size={16} className="mr-1.5" /> {t('products.category')}
            </Button>
          )}
          {canCreate && (
            <Button size="md" onClick={() => { setEditProduct(null); setFormOpen(true) }}>
              <Plus size={16} className="mr-1.5" /> {t('products.addProduct')}
            </Button>
          )}
        </div>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedCategory('')}
          className={cn('px-4 py-2.5 rounded-lg text-base font-medium transition-colors', selectedCategory === '' ? 'bg-brand text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700')}
        >
          {t('common.all')}
        </button>
        {categories.map(c => (
          <button key={c.id} onClick={() => setSelectedCategory(c.id)}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', selectedCategory === c.id ? 'bg-brand text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700')}>
            {c.name}
          </button>
        ))}
      </div>

      {!loading && total === 0 && (
        <div className="bg-brand/5 border border-brand/20 rounded-xl px-5 py-4 flex items-center gap-4">
          <Package size={28} className="text-brand shrink-0" />
          <div>
            <p className="text-sm font-semibold text-brand">Add your first product to start billing</p>
            <p className="text-xs text-slate-500 mt-0.5">Products you add here will appear in the billing screen when creating invoices.</p>
          </div>
        </div>
      )}
      <DataTable
        data={products}
        columns={columns}
        searchPlaceholder={t('products.searchProducts')}
        loading={loading}
        emptyMessage={t('products.noProducts')}
      />

      <ProductFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditProduct(null) }}
        onSaved={loadData}
        product={editProduct}
        categories={categories}
      />

      <ConfirmDialog
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        loading={archiving}
        title={t('products.archiveProduct')}
        message={`${t('products.archiveProduct')} "${archiveTarget?.productName}"?`}
        confirmLabel={t('products.archiveProduct')}
      />

      <CategoryManageModal
        open={catManageOpen}
        onClose={() => { setCatManageOpen(false); loadData() }}
      />

      <VariantManagementModal
        open={!!variantProduct}
        productId={variantProduct?.id ?? ''}
        productName={variantProduct?.productName ?? ''}
        onClose={() => { setVariantProduct(null); loadData() }}
      />
    </div>
  )
}
