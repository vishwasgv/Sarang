import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Layers, Plus, Search, Pencil, Trash2, ToggleLeft, ToggleRight, Clock, Tag } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'

interface ServiceItem {
  id: string
  serviceName: string
  serviceCode: string | null
  category: string | null
  description: string | null
  durationMinutes: number
  basePrice: number
  taxRate: number
  sacCode: string | null
  isActive: boolean
  notes: string | null
}

function ServiceForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: Partial<ServiceItem>
  onSave: (data: Partial<ServiceItem>) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState({
    serviceName: initial.serviceName ?? '',
    serviceCode: initial.serviceCode ?? '',
    category: initial.category ?? '',
    description: initial.description ?? '',
    durationMinutes: initial.durationMinutes ?? 30,
    basePrice: initial.basePrice ?? 0,
    taxRate: initial.taxRate ?? 0,
    sacCode: initial.sacCode ?? '',
    notes: initial.notes ?? '',
  })

  return (
    <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Service Name" value={form.serviceName} onChange={(e) => setForm((f) => ({ ...f, serviceName: e.target.value }))} required placeholder="e.g. General Consultation" />
        <Input label="Service Code (optional)" value={form.serviceCode} onChange={(e) => setForm((f) => ({ ...f, serviceCode: e.target.value }))} placeholder="e.g. GC-001" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Consultation" />
        <Input label="SAC Code (GST)" value={form.sacCode} onChange={(e) => setForm((f) => ({ ...f, sacCode: e.target.value }))} placeholder="e.g. 999311" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input label="Duration (min)" type="number" value={form.durationMinutes} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))} />
        <Input label="Base Price" type="number" value={form.basePrice} onChange={(e) => setForm((f) => ({ ...f, basePrice: Number(e.target.value) }))} />
        <Input label="Tax Rate %" type="number" value={form.taxRate} onChange={(e) => setForm((f) => ({ ...f, taxRate: Number(e.target.value) }))} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
        <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-dark dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-brand" />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" loading={saving} onClick={() => onSave(form)}>Save Service</Button>
      </div>
    </div>
  )
}

export function ServiceCatalogScreen() {
  const { hasPermission } = useAuthStore()
  const canManage = hasPermission('settings.modify')
  const currSym = useBusinessStore((s) => s.profile?.currencySymbol ?? '₹')

  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [categories, setCategories] = useState<string[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [svcRes, catRes] = await Promise.all([
        api.serviceCatalog.list(),
        api.serviceCatalog.listCategories(),
      ])
      if (svcRes.success && svcRes.data) setServices(svcRes.data as ServiceItem[])
      else setError(svcRes.error?.message ?? 'Could not load services.')
      if (catRes.success && catRes.data) setCategories(catRes.data as string[])
    } catch {
      setError('Could not load services.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = services.filter((s) => {
    if (categoryFilter !== 'ALL' && s.category !== categoryFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return s.serviceName.toLowerCase().includes(q) || (s.serviceCode ?? '').toLowerCase().includes(q)
    }
    return true
  })

  async function handleCreate(data: Partial<ServiceItem>) {
    if (!data.serviceName) { setError('Service name is required.'); return }
    setSaving(true)
    setError(null)
    const res = await api.serviceCatalog.create(data as Parameters<typeof api.serviceCatalog.create>[0])
    if (res.success) { setShowForm(false); await load() }
    else setError(res.error?.message ?? 'Could not create service.')
    setSaving(false)
  }

  async function handleUpdate(id: string, data: Partial<ServiceItem>) {
    setSaving(true)
    setError(null)
    const res = await api.serviceCatalog.update({ id, ...data })
    if (res.success) { setEditingId(null); await load() }
    else setError(res.error?.message ?? 'Could not update service.')
    setSaving(false)
  }

  async function handleToggleActive(svc: ServiceItem) {
    await api.serviceCatalog.update({ id: svc.id, isActive: !svc.isActive })
    await load()
  }

  async function handleDelete(id: string) {
    setConfirmDeleteId(null)
    const res = await api.serviceCatalog.delete({ id })
    if (res.success) await load()
    else setError(res.error?.message ?? 'Could not delete service.')
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center">
            <Layers size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-dark dark:text-slate-100">Service Catalog</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{services.filter((s) => s.isActive).length} active services</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search services..."
              className="pl-8 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand w-52"
            />
          </div>
          {canManage && (
            <Button size="sm" icon={<Plus size={14} />} onClick={() => { setShowForm(true); setEditingId(null) }}>
              Add Service
            </Button>
          )}
        </div>
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="px-6 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 shrink-0 overflow-x-auto">
          {['ALL', ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`shrink-0 px-3 py-1 text-xs font-medium rounded-full border transition-colors ${categoryFilter === cat ? 'border-brand text-brand bg-brand/5' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'}`}
            >
              {cat === 'ALL' ? 'All Categories' : cat}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {error && <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">{error}</p>}

        {showForm && !editingId && (
          <ServiceForm initial={{}} onSave={handleCreate} onCancel={() => setShowForm(false)} saving={saving} />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 && !showForm ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Layers size={32} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No services yet</p>
            {canManage && <p className="text-xs text-slate-400 mt-1">Add your first service to get started.</p>}
          </div>
        ) : (
          filtered.map((svc) => (
            <motion.div key={svc.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
            <Card
              padding="md"
              className={svc.isActive ? '' : 'border-slate-100 dark:border-slate-800 opacity-60'}
            >
              {editingId === svc.id ? (
                <ServiceForm
                  initial={svc}
                  onSave={(data) => handleUpdate(svc.id, data)}
                  onCancel={() => setEditingId(null)}
                  saving={saving}
                />
              ) : (
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-dark dark:text-slate-100">{svc.serviceName}</p>
                      {svc.serviceCode && <span className="text-xs text-slate-400 font-mono">{svc.serviceCode}</span>}
                      {svc.category && <Badge variant="neutral" size="sm">{svc.category}</Badge>}
                      {!svc.isActive && <Badge variant="neutral" size="sm">Archived</Badge>}
                    </div>
                    {svc.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{svc.description}</p>}
                    <div className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                        <Clock size={11} /> {svc.durationMinutes}min
                      </span>
                      <span className="flex items-center gap-1 text-xs font-medium text-dark dark:text-slate-100">
                        <Tag size={11} />
                        {currSym}{svc.basePrice.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                        {svc.taxRate > 0 && <span className="text-slate-400 font-normal">+{svc.taxRate}% tax</span>}
                      </span>
                      {svc.sacCode && <span className="text-xs text-slate-400">SAC: {svc.sacCode}</span>}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleToggleActive(svc)} className="p-1.5 text-slate-400 hover:text-brand rounded-lg hover:bg-brand/5 transition-colors" title={svc.isActive ? 'Archive' : 'Activate'}>
                        {svc.isActive ? <ToggleRight size={16} className="text-success" /> : <ToggleLeft size={16} />}
                      </button>
                      <button onClick={() => { setEditingId(svc.id); setShowForm(false) }} className="p-1.5 text-slate-400 hover:text-brand rounded-lg hover:bg-brand/5 transition-colors">
                        <Pencil size={14} />
                      </button>
                      {confirmDeleteId === svc.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-danger font-medium">Delete?</span>
                          <button onClick={() => handleDelete(svc.id)} className="px-2 py-0.5 text-xs bg-danger text-white rounded-lg">Yes</button>
                          <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-0.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(svc.id)} className="p-1.5 text-slate-400 hover:text-danger rounded-lg hover:bg-danger/5 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
