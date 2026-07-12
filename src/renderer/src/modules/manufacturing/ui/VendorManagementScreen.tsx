import React, { useEffect, useState, useCallback } from 'react'
import { Users, RefreshCw, Phone, Mail, ChevronRight, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@renderer/services/ipc-client'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatNumber } from '@shared/utils/locale.util'
import { Card } from '@shared/ui/molecules/Card'
import { useNotificationStore } from '@app/store/notification.store'

interface Vendor {
  id: string
  supplierName: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  notes: string | null
  outstandingBalance: number
  isActive: boolean
  rawMaterialCount: number
}

interface RawMaterialForVendor {
  id: string
  name: string
  unit: string
  currentStock: number
  reorderLevel: number
  unitCost: number
  isLowStock: boolean
}

export function VendorManagementScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [detailTarget, setDetailTarget] = useState<Vendor | null>(null)
  const [vendorMaterials, setVendorMaterials] = useState<RawMaterialForVendor[]>([])
  const [matLoading, setMatLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Load all suppliers, then load raw materials to cross-reference
      const [suppRes, matRes] = await Promise.all([
        api.suppliers.list({ page: 1, limit: 500 }),
        api.rawMaterials.list({ limit: 500 })
      ])

      if (suppRes.success && suppRes.data && matRes.success && matRes.data) {
        const suppData = suppRes.data as { suppliers: Array<{ id: string; supplierName: string; contactPerson: string | null; phone: string | null; email: string | null; address: string | null; city: string | null; notes: string | null; outstandingBalance: number; isActive: boolean }> }
        const matData = matRes.data as { materials: Array<{ id: string; supplierId: string | null; name: string; unit: string; currentStock: number; reorderLevel: number; unitCost: number; isLowStock: boolean }> }

        const matBySupplierId = new Map<string, number>()
        for (const m of (matData.materials ?? [])) {
          if (m.supplierId) matBySupplierId.set(m.supplierId, (matBySupplierId.get(m.supplierId) ?? 0) + 1)
        }

        const vendorList: Vendor[] = (suppData.suppliers ?? [])
          .filter(s => s.isActive && matBySupplierId.has(s.id))
          .map(s => ({
            id: s.id,
            supplierName: s.supplierName,
            contactPerson: s.contactPerson,
            phone: s.phone,
            email: s.email,
            address: s.address,
            city: s.city,
            notes: s.notes,
            outstandingBalance: s.outstandingBalance,
            isActive: s.isActive,
            rawMaterialCount: matBySupplierId.get(s.id) ?? 0
          }))
        setVendors(vendorList)
      } else {
        toastError(t('common.error'), (suppRes.error ?? matRes.error)?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { loadData() }, [loadData])

  async function openDetail(vendor: Vendor) {
    setDetailTarget(vendor)
    setMatLoading(true)
    try {
      const res = await api.rawMaterials.list({ supplierId: vendor.id, limit: 200 })
      if (res.success && res.data) {
        const d = res.data as { materials: RawMaterialForVendor[] }
        setVendorMaterials(d.materials ?? [])
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setMatLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Users size={24} className="text-brand" />
              {t('manufacturing.vendorManagement')}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">{t('manufacturing.vendorSubtitle')}</p>
          </div>
          <button onClick={loadData} className="h-11 w-11 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : vendors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
            <Users size={40} className="mb-3 opacity-30" />
            <p className="text-base font-medium">{t('manufacturing.noVendorLinked')}</p>
            <p className="text-sm mt-1">{t('manufacturing.noVendorDesc')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {vendors.map(v => (
              <Card key={v.id} padding="lg" hoverable className="cursor-pointer" onClick={() => openDetail(v)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-text-primary truncate">{v.supplierName}</p>
                    {v.contactPerson && <p className="text-xs text-text-secondary mt-0.5">{v.contactPerson}</p>}
                    <div className="flex flex-wrap gap-3 mt-2">
                      {v.phone && (
                        <span className="flex items-center gap-1 text-xs text-text-secondary">
                          <Phone size={11} /> {v.phone}
                        </span>
                      )}
                      {v.email && (
                        <span className="flex items-center gap-1 text-xs text-text-secondary">
                          <Mail size={11} /> {v.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-text-secondary">{v.rawMaterialCount} {t('manufacturing.rawMaterials').toLowerCase()}</p>
                    {v.outstandingBalance > 0 && (
                      <p className="text-xs text-danger font-semibold mt-1">{formatCurrency(v.outstandingBalance)}</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end text-xs text-brand">
                  <span>{t('manufacturing.viewMaterials')}</span> <ChevronRight size={12} className="ml-0.5" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{detailTarget.supplierName}</h2>
                <p className="text-sm text-text-secondary mt-0.5">{detailTarget.rawMaterialCount} {t('manufacturing.rawMaterials').toLowerCase()}</p>
              </div>
              <button onClick={() => setDetailTarget(null)} className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"><X size={18} /></button>
            </div>

            {/* Vendor Info */}
            <div className="px-6 py-4 bg-surface border-b border-border shrink-0">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {detailTarget.contactPerson && <div><span className="text-text-secondary">{t('suppliers.contactPerson')}:</span> <span className="font-medium">{detailTarget.contactPerson}</span></div>}
                {detailTarget.phone && <div><span className="text-text-secondary">{t('common.phone')}:</span> <span className="font-medium">{detailTarget.phone}</span></div>}
                {detailTarget.email && <div className="col-span-2"><span className="text-text-secondary">{t('common.email')}:</span> <span className="font-medium">{detailTarget.email}</span></div>}
                {detailTarget.city && <div><span className="text-text-secondary">{t('customers.city')}:</span> <span className="font-medium">{detailTarget.city}</span></div>}
                {detailTarget.outstandingBalance > 0 && (
                  <div><span className="text-text-secondary">{t('suppliers.outstandingBalance')}:</span> <span className="font-semibold text-danger">{formatCurrency(detailTarget.outstandingBalance)}</span></div>
                )}
              </div>
            </div>

            {/* Materials */}
            <div className="flex-1 overflow-auto">
              {matLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-surface-alt border-b border-border sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-text-secondary">{t('manufacturing.material')}</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold uppercase text-text-secondary">{t('manufacturing.stockCol')}</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold uppercase text-text-secondary">{t('manufacturing.unitCost')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {vendorMaterials.map(m => (
                      <tr key={m.id} className={m.isLowStock ? 'bg-danger/5' : ''}>
                        <td className="px-4 py-2">
                          <p className="font-medium text-text-primary">{m.name}</p>
                          {m.isLowStock && <p className="text-xs text-danger mt-0.5">{t('manufacturing.lowStockBadge')}</p>}
                        </td>
                        <td className="px-4 py-2 text-right text-text-secondary">
                          {formatNumber(m.currentStock, { maximumFractionDigits: 2 })} {m.unit}
                        </td>
                        <td className="px-4 py-2 text-right text-text-secondary">
                          {formatCurrency(m.unitCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-6 pb-6 pt-4 border-t border-border shrink-0">
              <button onClick={() => setDetailTarget(null)} className="w-full h-12 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-surface-hover transition-colors">
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
