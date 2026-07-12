import React, { useEffect, useState, useCallback } from 'react'
import { api } from '@renderer/services/ipc-client'
import { Home, Plus, X, ChevronDown, ChevronRight, Building2, Printer, Receipt, Pencil } from 'lucide-react'
import { aszurexFooterHtml } from '@shared/utils/print-branding'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Client { id: string; customerName: string; phone: string }
interface PropertyOwner { id: string; customerName: string; phone: string }
interface PropertyInquiry {
  id: string
  propertyId: string
  buyerClientId: string
  inquiryDate: string
  status: string
  notes: string | null
  nextFollowUpDate: string | null
  buyer: Client
}
interface PropertyDeal {
  id: string
  propertyId: string
  buyerClientId: string
  sellerClientId: string
  dealValue: number
  brokeragePercent: number
  brokerageAmount: number
  status: string
  expectedRegistrationDate: string | null
  invoiceId: string | null
  notes: string | null
  buyer: Client
  seller: Client
}
interface Property {
  id: string
  ownerClientId: string
  propertyType: string
  listingType: string
  location: string
  area: number
  floorNumber: number | null
  totalFloors: number | null
  askingPrice: number | null
  monthlyRent: number | null
  securityDeposit: number | null
  brokeragePercent: number | null
  description: string | null
  notes: string | null
  status: string
  createdAt: string
  owner: PropertyOwner
}
interface PropertyWithDetails extends Property {
  inquiries: PropertyInquiry[]
  deals: PropertyDeal[]
}
interface PropertyKPIs { activeListings: number; dealsInProgress: number; newInquiries: number; totalListings: number }
interface Customer { id: string; customerName: string; phone: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const PROPERTY_TYPES = ['RESIDENTIAL_FLAT', 'INDEPENDENT_HOUSE', 'PLOT', 'COMMERCIAL_OFFICE', 'COMMERCIAL_SHOP', 'WAREHOUSE', 'AGRICULTURAL']
const LISTING_TYPES = ['SALE', 'RENT', 'LEASE']
const PROPERTY_STATUSES = ['AVAILABLE', 'UNDER_NEGOTIATION', 'SOLD', 'RENTED', 'OFF_MARKET']
const INQUIRY_STATUSES = ['SHORTLISTED', 'SITE_VISIT_SCHEDULED', 'NEGOTIATION', 'DEAL_CLOSED', 'REJECTED']
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'

// Verified exhaustive against prisma/schema.prisma Property.status ("AVAILABLE|UNDER_NEGOTIATION|SOLD|RENTED|OFF_MARKET")
const PROPERTY_STATUS_VARIANT: Record<string, BadgeVariant> = {
  AVAILABLE: 'success',
  UNDER_NEGOTIATION: 'warning',
  SOLD: 'info',
  RENTED: 'brand',
  OFF_MARKET: 'neutral',
}
// Verified exhaustive against prisma/schema.prisma PropertyDeal.status ("IN_PROGRESS|REGISTERED|FELL_THROUGH")
const DEAL_STATUS_VARIANT: Record<string, BadgeVariant> = {
  IN_PROGRESS: 'warning',
  REGISTERED: 'success',
  FELL_THROUGH: 'danger',
}

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN') : '-'
const fmtLabel = (s: string) => s.replace(/_/g, ' ')
const fmtCurrency = (n: number | null) => n == null ? '-' : `₹${Number(n).toLocaleString('en-IN')}`

function displayPrice(p: Property) {
  if (p.listingType === 'SALE') return p.askingPrice ? fmtCurrency(p.askingPrice) : '-'
  return p.monthlyRent ? `${fmtCurrency(p.monthlyRent)}/mo` : '-'
}

// ─── Property Print Sheet ─────────────────────────────────────────────────────

function printPropertySheet(p: Property) {
  const price = p.listingType === 'SALE'
    ? (p.askingPrice ? `${fmtCurrency(p.askingPrice)}` : 'Price on request')
    : (p.monthlyRent ? `${fmtCurrency(p.monthlyRent)}/month` : 'Rent on request')

  const html = `<!DOCTYPE html><html><head><title>Property Listing - ${p.location}</title>
<style>
  body{font-family:Arial,sans-serif;margin:40px;color:#111;font-size:14px}
  h1{font-size:22px;margin-bottom:4px}
  .badge{display:inline-block;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:600;margin-left:8px;background:#e0f2fe;color:#0369a1}
  table{width:100%;border-collapse:collapse;margin-top:20px}
  td{padding:8px 12px;border:1px solid #e5e7eb}
  td:first-child{font-weight:600;background:#f9fafb;width:35%}
  .price{font-size:26px;font-weight:700;color:#16a34a;margin:12px 0}
  .desc{margin-top:16px;padding:12px;background:#f9fafb;border-radius:6px}
  .footer{margin-top:40px;font-size:11px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:12px}
</style></head><body>
<h1>${fmtLabel(p.propertyType)} for ${p.listingType}<span class="badge">${fmtLabel(p.status)}</span></h1>
<p style="color:#6b7280;margin:0">${p.location}</p>
<div class="price">${price}</div>
<table>
  <tr><td>Owner</td><td>${p.owner.customerName}${p.owner.phone ? ' · ' + p.owner.phone : ''}</td></tr>
  <tr><td>Property Type</td><td>${fmtLabel(p.propertyType)}</td></tr>
  <tr><td>Listing Type</td><td>${p.listingType}</td></tr>
  <tr><td>Area</td><td>${p.area} sq ft</td></tr>
  ${p.floorNumber != null ? `<tr><td>Floor</td><td>${p.floorNumber}${p.totalFloors ? ' of ' + p.totalFloors : ''}</td></tr>` : ''}
  ${p.securityDeposit ? `<tr><td>Security Deposit</td><td>${fmtCurrency(p.securityDeposit)}</td></tr>` : ''}
  <tr><td>Status</td><td>${fmtLabel(p.status)}</td></tr>
  <tr><td>Listed On</td><td>${fmtDate(p.createdAt)}</td></tr>
</table>
${p.description ? `<div class="desc"><strong>Description:</strong><br>${p.description}</div>` : ''}
<div class="footer">${aszurexFooterHtml(11)}</div>
</body></html>`

  const win = window.open('', '_blank', 'width=700,height=900')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}

// ─── Property Form (shared Add + Edit) ───────────────────────────────────────

function PropertyForm({
  clients,
  initial,
  onSave,
  onClose,
}: {
  clients: Customer[]
  initial?: Property
  onSave: () => void
  onClose: () => void
}) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    ownerClientId: initial?.ownerClientId ?? '',
    propertyType: initial?.propertyType ?? 'RESIDENTIAL_FLAT',
    listingType: initial?.listingType ?? 'SALE',
    location: initial?.location ?? '',
    area: initial?.area ? String(initial.area) : '',
    floorNumber: initial?.floorNumber ? String(initial.floorNumber) : '',
    totalFloors: initial?.totalFloors ? String(initial.totalFloors) : '',
    askingPrice: initial?.askingPrice ? String(initial.askingPrice) : '',
    monthlyRent: initial?.monthlyRent ? String(initial.monthlyRent) : '',
    securityDeposit: initial?.securityDeposit ? String(initial.securityDeposit) : '',
    brokeragePercent: initial?.brokeragePercent ? String(initial.brokeragePercent) : '2',
    description: initial?.description ?? '',
    notes: initial?.notes ?? '',
    status: initial?.status ?? 'AVAILABLE',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.ownerClientId) return setError('Owner is required.')
    if (!form.location.trim()) return setError('Location is required.')
    if (!form.area || isNaN(parseFloat(form.area))) return setError('Valid area is required.')
    setSaving(true); setError('')

    let res
    if (isEdit) {
      res = await api.property.update({
        id: initial!.id,
        propertyType: form.propertyType,
        listingType: form.listingType,
        location: form.location,
        area: parseFloat(form.area),
        floorNumber: form.floorNumber ? parseInt(form.floorNumber) : null,
        totalFloors: form.totalFloors ? parseInt(form.totalFloors) : null,
        askingPrice: form.askingPrice ? parseFloat(form.askingPrice) : null,
        monthlyRent: form.monthlyRent ? parseFloat(form.monthlyRent) : null,
        securityDeposit: form.securityDeposit ? parseFloat(form.securityDeposit) : null,
        brokeragePercent: form.brokeragePercent ? parseFloat(form.brokeragePercent) : null,
        description: form.description || null,
        notes: form.notes || null,
        status: form.status,
      })
    } else {
      res = await api.property.create({
        ownerClientId: form.ownerClientId,
        propertyType: form.propertyType,
        listingType: form.listingType,
        location: form.location,
        area: parseFloat(form.area),
        floorNumber: form.floorNumber ? parseInt(form.floorNumber) : undefined,
        totalFloors: form.totalFloors ? parseInt(form.totalFloors) : undefined,
        askingPrice: form.askingPrice ? parseFloat(form.askingPrice) : undefined,
        monthlyRent: form.monthlyRent ? parseFloat(form.monthlyRent) : undefined,
        securityDeposit: form.securityDeposit ? parseFloat(form.securityDeposit) : undefined,
        brokeragePercent: form.brokeragePercent ? parseFloat(form.brokeragePercent) : undefined,
        description: form.description || undefined,
        notes: form.notes || undefined,
      })
    }
    setSaving(false)
    if (res.success) { onSave() } else { setError(res.error?.message ?? 'Failed to save property.') }
  }

  const isSale = form.listingType === 'SALE'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{isEdit ? 'Edit Property' : 'New Property Listing'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-200"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</div>}
          <Select label="Owner" required={!isEdit} value={form.ownerClientId} onChange={e => set('ownerClientId', e.target.value)} disabled={isEdit}>
            <option value="">Select owner...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.customerName}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Property Type" required value={form.propertyType} onChange={e => set('propertyType', e.target.value)}>
              {PROPERTY_TYPES.map(t => <option key={t} value={t}>{fmtLabel(t)}</option>)}
            </Select>
            <Select label="Listing Type" required value={form.listingType} onChange={e => set('listingType', e.target.value)}>
              {LISTING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Location *</label>
            <input type="text" className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="Full address / locality" value={form.location} onChange={e => set('location', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Area (sq ft) *</label>
              <input type="number" min="0" className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="1200" value={form.area} onChange={e => set('area', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Floor No.</label>
              <input type="number" min="0" className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="3" value={form.floorNumber} onChange={e => set('floorNumber', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Total Floors</label>
              <input type="number" min="0" className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="10" value={form.totalFloors} onChange={e => set('totalFloors', e.target.value)} />
            </div>
          </div>
          {isSale ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Asking Price</label>
              <input type="number" min="0" className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="5000000" value={form.askingPrice} onChange={e => set('askingPrice', e.target.value)} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Monthly Rent</label>
                <input type="number" min="0" className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="25000" value={form.monthlyRent} onChange={e => set('monthlyRent', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Security Deposit</label>
                <input type="number" min="0" className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="75000" value={form.securityDeposit} onChange={e => set('securityDeposit', e.target.value)} />
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Brokerage %</label>
            <input type="number" min="0" max="10" step="0.1" className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="2" value={form.brokeragePercent} onChange={e => set('brokeragePercent', e.target.value)} />
          </div>
          {isEdit && (
            <Select label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
              {PROPERTY_STATUSES.map(s => <option key={s} value={s}>{fmtLabel(s)}</option>)}
            </Select>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Description</label>
            <textarea rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="Property features, amenities..." value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="flex-1 h-12 border border-gray-300 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 h-12 bg-green-600 text-white rounded-lg text-base font-medium hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Listing'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Inquiry Form ─────────────────────────────────────────────────────────

function AddInquiryForm({
  propertyId,
  clients,
  onSave,
  onClose,
}: {
  propertyId: string
  clients: Customer[]
  onSave: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState({ buyerClientId: '', notes: '', nextFollowUpDate: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.buyerClientId) return setError('Select a buyer.')
    setSaving(true); setError('')
    const res = await api.propertyInquiry.create({
      propertyId,
      buyerClientId: form.buyerClientId,
      notes: form.notes || undefined,
      nextFollowUpDate: form.nextFollowUpDate || undefined,
    })
    setSaving(false)
    if (res.success) { onSave() } else { setError(res.error?.message ?? 'Failed to add inquiry.') }
  }

  return (
    <div className="border dark:border-slate-700 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 space-y-3 mt-3">
      <p className="text-xs font-semibold text-blue-800">Add Inquiry</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <select className="h-10 border border-gray-300 rounded-lg px-2 text-sm dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" value={form.buyerClientId} onChange={e => set('buyerClientId', e.target.value)}>
          <option value="">Buyer...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.customerName}</option>)}
        </select>
        <input type="date" className="h-10 border border-gray-300 rounded-lg px-2 text-sm dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" title="Next follow-up date" value={form.nextFollowUpDate} onChange={e => set('nextFollowUpDate', e.target.value)} />
        <input type="text" className="h-10 border border-gray-300 rounded-lg px-2 text-sm col-span-2 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="Notes / requirements" value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 h-9 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-white dark:hover:bg-slate-900 dark:border-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 h-9 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? '...' : 'Add Inquiry'}
        </button>
      </div>
    </div>
  )
}

// ─── Add Deal Form ────────────────────────────────────────────────────────────

function AddDealForm({
  propertyId,
  clients,
  onSave,
  onClose,
}: {
  propertyId: string
  clients: Customer[]
  onSave: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState({ buyerClientId: '', sellerClientId: '', dealValue: '', brokeragePercent: '2', expectedRegistrationDate: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.buyerClientId || !form.sellerClientId) return setError('Both buyer and seller are required.')
    if (form.buyerClientId === form.sellerClientId) return setError('Buyer and seller must be different clients.')
    if (!form.dealValue || isNaN(parseFloat(form.dealValue))) return setError('Valid deal value is required.')
    setSaving(true); setError('')
    const res = await api.propertyDeal.create({
      propertyId,
      buyerClientId: form.buyerClientId,
      sellerClientId: form.sellerClientId,
      dealValue: parseFloat(form.dealValue),
      brokeragePercent: parseFloat(form.brokeragePercent) || 2,
      expectedRegistrationDate: form.expectedRegistrationDate || undefined,
      notes: form.notes || undefined,
    })
    setSaving(false)
    if (res.success) { onSave() } else { setError(res.error?.message ?? 'Failed to create deal.') }
  }

  const brokerage = form.dealValue && form.brokeragePercent
    ? (parseFloat(form.dealValue) * parseFloat(form.brokeragePercent)) / 100
    : null

  return (
    <div className="border dark:border-slate-700 rounded-lg bg-green-50 dark:bg-green-900/20 p-4 space-y-3 mt-3">
      <p className="text-xs font-semibold text-green-800">Create Deal</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <select className="h-10 border border-gray-300 rounded-lg px-2 text-sm dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" value={form.buyerClientId} onChange={e => set('buyerClientId', e.target.value)}>
          <option value="">Buyer...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.customerName}</option>)}
        </select>
        <select className="h-10 border border-gray-300 rounded-lg px-2 text-sm dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" value={form.sellerClientId} onChange={e => set('sellerClientId', e.target.value)}>
          <option value="">Seller/Owner...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.customerName}</option>)}
        </select>
        <input type="number" min="0" className="h-10 border border-gray-300 rounded-lg px-2 text-sm dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="Deal Value ₹" value={form.dealValue} onChange={e => set('dealValue', e.target.value)} />
        <input type="number" min="0" max="20" step="0.1" className="h-10 border border-gray-300 rounded-lg px-2 text-sm dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="Brokerage %" value={form.brokeragePercent} onChange={e => set('brokeragePercent', e.target.value)} />
        <input type="date" className="h-10 border border-gray-300 rounded-lg px-2 text-sm dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" title="Expected registration date" value={form.expectedRegistrationDate} onChange={e => set('expectedRegistrationDate', e.target.value)} />
        <input type="text" className="h-10 border border-gray-300 rounded-lg px-2 text-sm dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="Notes" value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
      {brokerage !== null && (
        <p className="text-xs text-green-700 font-medium">Brokerage: {fmtCurrency(brokerage)} + 18% GST on commission invoice</p>
      )}
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 h-9 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-white dark:hover:bg-slate-900 dark:border-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 h-9 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
          {saving ? '...' : 'Create Deal'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PropertiesScreen() {
  const { error: toastError } = useNotificationStore()
  const [properties, setProperties] = useState<Property[]>([])
  const [kpis, setKpis] = useState<PropertyKPIs>({ activeListings: 0, dealsInProgress: 0, newInquiries: 0, totalListings: 0 })
  const [clients, setClients] = useState<Customer[]>([])
  const [propertyDetails, setPropertyDetails] = useState<Record<string, PropertyWithDetails>>({})
  const [statusFilter, setStatusFilter] = useState('')
  const [listingTypeFilter, setListingTypeFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAddInquiryFor, setShowAddInquiryFor] = useState<string | null>(null)
  const [showAddDealFor, setShowAddDealFor] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editProperty, setEditProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [invoiceLoading, setInvoiceLoading] = useState<string | null>(null)
  const [invoiceBanner, setInvoiceBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [dealDeleteError, setDealDeleteError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  type DeleteTarget =
    | { kind: 'property'; id: string }
    | { kind: 'inquiry'; id: string; propertyId: string }
    | { kind: 'deal'; id: string; propertyId: string }
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadProperties = useCallback(async (status?: string, listingType?: string): Promise<Property[]> => {
    try {
      const payload: Record<string, string> = {}
      if (status) payload.status = status
      if (listingType) payload.listingType = listingType
      const res = await api.property.list(payload)
      const data = (res.success ? (res.data as Property[]) : null) ?? []
      if (res.success) setProperties(data)
      else toastError('Error', res.error?.message ?? 'Could not load properties.')
      return data
    } catch {
      toastError('Error', 'Could not load properties.')
      return []
    }
  }, [toastError])

  const loadKpis = useCallback(async () => {
    const res = await api.property.kpis()
    if (res.success && res.data) setKpis(res.data as PropertyKPIs)
  }, [])

  const loadPropertyDetails = useCallback(async (id: string, currentProperties: Property[]) => {
    const [inqRes, dealRes] = await Promise.all([
      api.propertyInquiry.list(id),
      api.propertyDeal.list({ propertyId: id }),
    ])
    const prop = currentProperties.find(p => p.id === id)
    if (!prop) return
    setPropertyDetails(prev => ({
      ...prev,
      [id]: {
        ...prop,
        inquiries: inqRes.success ? ((inqRes.data as PropertyInquiry[]) ?? []) : [],
        deals: dealRes.success ? ((dealRes.data as PropertyDeal[]) ?? []) : [],
      },
    }))
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      await Promise.all([
        loadProperties(),
        loadKpis(),
        api.customers.list({ limit: 500 }).then((r: { success: boolean; data?: unknown }) => {
          if (!r.success) return
          const d = r.data as { customers?: Customer[] } | Customer[]
          setClients(Array.isArray(d) ? d : (d.customers ?? []))
        }),
      ])
      setLoading(false)
    }
    init()
  }, [])

  async function handleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!propertyDetails[id]) await loadPropertyDetails(id, properties)
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    setActionError(null)
    const res = await api.property.delete(id)
    setDeleting(false)
    if (res.success) { setDeleteTarget(null); setProperties(ps => ps.filter(p => p.id !== id)); loadKpis() }
    else setActionError(res.error?.message ?? 'Failed to delete property.')
  }

  async function handleDeleteInquiry(inquiryId: string, propertyId: string) {
    setDeleting(true)
    setActionError(null)
    const res = await api.propertyInquiry.delete(inquiryId)
    setDeleting(false)
    if (res.success) {
      setDeleteTarget(null)
      setPropertyDetails(prev => {
        const existing = prev[propertyId]
        if (!existing) return prev
        return { ...prev, [propertyId]: { ...existing, inquiries: existing.inquiries.filter(i => i.id !== inquiryId) } }
      })
      loadKpis()
    } else {
      setActionError(res.error?.message ?? 'Failed to delete inquiry.')
    }
  }

  async function handleDeleteDeal(dealId: string, propertyId: string) {
    setDeleting(true)
    setDealDeleteError(null)
    const res = await api.propertyDeal.delete(dealId)
    setDeleting(false)
    if (res.success) {
      setDeleteTarget(null)
      setPropertyDetails(prev => {
        const existing = prev[propertyId]
        if (!existing) return prev
        return { ...prev, [propertyId]: { ...existing, deals: existing.deals.filter(d => d.id !== dealId) } }
      })
      await loadProperties(statusFilter, listingTypeFilter)
      loadKpis()
    } else {
      setDealDeleteError(res.error?.message ?? 'Failed to delete deal.')
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'property') await handleDelete(deleteTarget.id)
    else if (deleteTarget.kind === 'inquiry') await handleDeleteInquiry(deleteTarget.id, deleteTarget.propertyId)
    else await handleDeleteDeal(deleteTarget.id, deleteTarget.propertyId)
  }

  async function handleUpdateDealStatus(dealId: string, propertyId: string, status: string) {
    setActionError(null)
    const res = await api.propertyDeal.update({ id: dealId, status })
    if (res.success) {
      const freshProperties = await loadProperties(statusFilter, listingTypeFilter)
      await loadPropertyDetails(propertyId, freshProperties)
      loadKpis()
    } else {
      setActionError(res.error?.message ?? 'Failed to update deal status.')
    }
  }

  async function handleGenerateInvoice(dealId: string, propertyId: string) {
    setInvoiceLoading(dealId)
    setInvoiceBanner(null)
    const res = await api.propertyDeal.generateInvoice(dealId)
    setInvoiceLoading(null)
    if (res.success) {
      await loadPropertyDetails(propertyId, properties)
      setInvoiceBanner({ type: 'success', message: 'Commission invoice generated successfully.' })
    } else {
      setInvoiceBanner({ type: 'error', message: res.error?.message ?? 'Failed to generate invoice.' })
    }
  }

  async function handleInquiryStatusUpdate(inquiryId: string, propertyId: string, status: string) {
    setActionError(null)
    const res = await api.propertyInquiry.update({ id: inquiryId, status })
    if (res.success) {
      setPropertyDetails(prev => {
        const existing = prev[propertyId]
        if (!existing) return prev
        return { ...prev, [propertyId]: { ...existing, inquiries: existing.inquiries.map(i => i.id === inquiryId ? { ...i, status } : i) } }
      })
    } else {
      setActionError(res.error?.message ?? 'Failed to update inquiry status.')
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Home size={22} className="text-green-600" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Properties</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 h-10 px-4 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
        >
          <Plus size={16} />
          Add Listing
        </button>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-4 gap-4 px-6 py-4">
        <KpiCard label="Active Listings" value={kpis.activeListings} color="success" />
        <KpiCard label="Deals In Progress" value={kpis.dealsInProgress} color="warning" />
        <KpiCard label="New Inquiries (7d)" value={kpis.newInquiries} color="info" />
        <KpiCard label="Total Listings" value={kpis.totalListings} color="neutral" />
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-6 pb-3 flex-wrap">
        {['', ...PROPERTY_STATUSES].map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); loadProperties(s, listingTypeFilter) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-green-600 text-white' : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
          >
            {s ? fmtLabel(s) : 'All'}
          </button>
        ))}
        <span className="w-px bg-gray-200 mx-1 dark:bg-slate-700" />
        {['', ...LISTING_TYPES].map(t => (
          <button
            key={t}
            onClick={() => { setListingTypeFilter(t); loadProperties(statusFilter, t) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${listingTypeFilter === t ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
          >
            {t || 'All Types'}
          </button>
        ))}
      </div>

      {/* Invoice banner */}
      {invoiceBanner && (
        <div className={`mx-6 mb-2 text-sm rounded-lg px-4 py-2 flex items-center justify-between border ${invoiceBanner.type === 'success' ? 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'}`}>
          <span>{invoiceBanner.message}</span>
          <button onClick={() => setInvoiceBanner(null)} className="ml-3 opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
      )}
      {/* Action error banner */}
      {actionError && (
        <div className="mx-6 mb-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
        {loading && <p className="text-center text-gray-400 py-8 dark:text-slate-500">Loading...</p>}
        {!loading && properties.length === 0 && (
          <div className="text-center py-16 text-gray-400 dark:text-slate-500">
            <Building2 size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No property listings yet</p>
            <p className="text-sm mt-1">Add the first listing using the button above</p>
          </div>
        )}
        {properties.map(p => {
          const expanded = expandedId === p.id
          const details = propertyDetails[p.id]
          return (
            <Card key={p.id} padding="none" className="overflow-hidden">
              {/* Property Row */}
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800"
                onClick={() => handleExpand(p.id)}
              >
                <div className="flex-shrink-0">{expanded ? <ChevronDown size={16} className="text-gray-400 dark:text-slate-500" /> : <ChevronRight size={16} className="text-gray-400 dark:text-slate-500" />}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{p.location}</p>
                    <Badge variant={PROPERTY_STATUS_VARIANT[p.status] ?? 'neutral'} size="sm">{fmtLabel(p.status)}</Badge>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400">{p.listingType}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 dark:text-slate-400">{fmtLabel(p.propertyType)} · {p.area} sq ft · Owner: {p.owner.customerName}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-green-700">{displayPrice(p)}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{fmtDate(p.createdAt)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={e => { e.stopPropagation(); printPropertySheet(p) }}
                    title="Print listing sheet"
                    className="text-gray-400 hover:text-gray-700 p-1 dark:text-slate-500 dark:hover:text-slate-200"
                  ><Printer size={14} /></button>
                  <button onClick={e => { e.stopPropagation(); setEditProperty(p) }} className="text-gray-400 hover:text-gray-700 p-1 dark:text-slate-500 dark:hover:text-slate-200">
                    <Pencil size={13} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); setDeleteTarget({ kind: 'property', id: p.id }) }} className="text-gray-300 hover:text-red-500 p-1">
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {expanded && (
                <div className="border-t bg-gray-50 px-6 py-4 dark:bg-slate-950">
                  {!details ? (
                    <p className="text-xs text-gray-400 dark:text-slate-500">Loading details...</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-6">
                      {/* Inquiries */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-slate-400">Inquiries ({details.inquiries.length})</p>
                          <button onClick={() => setShowAddInquiryFor(showAddInquiryFor === p.id ? null : p.id)} className="text-xs text-blue-600 font-medium hover:underline">+ Add</button>
                        </div>
                        {details.inquiries.length === 0 ? (
                          <p className="text-xs text-gray-400 italic dark:text-slate-500">No inquiries yet</p>
                        ) : (
                          <div className="space-y-2">
                            {details.inquiries.map(inq => (
                              <div key={inq.id} className="bg-white dark:bg-slate-900 border border-gray-100 rounded-lg px-3 py-2 dark:border-slate-800">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{inq.buyer.customerName}</p>
                                    <p className="text-xs text-gray-500 dark:text-slate-400">{fmtDate(inq.inquiryDate)}{inq.nextFollowUpDate ? ` · Follow-up: ${fmtDate(inq.nextFollowUpDate)}` : ''}</p>
                                    {inq.notes && <p className="text-xs text-gray-400 mt-0.5 dark:text-slate-500">{inq.notes}</p>}
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <select
                                      value={inq.status}
                                      onChange={e => handleInquiryStatusUpdate(inq.id, p.id, e.target.value)}
                                      className="text-xs h-6 px-1 border border-gray-200 rounded bg-white dark:bg-slate-900 dark:border-slate-700"
                                    >
                                      {INQUIRY_STATUSES.map(s => <option key={s} value={s}>{fmtLabel(s)}</option>)}
                                    </select>
                                    <button onClick={() => setDeleteTarget({ kind: 'inquiry', id: inq.id, propertyId: p.id })} className="text-gray-300 hover:text-red-500 p-0.5">
                                      <X size={12} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {showAddInquiryFor === p.id && (
                          <AddInquiryForm
                            propertyId={p.id}
                            clients={clients}
                            onSave={async () => { setShowAddInquiryFor(null); const fresh = await loadProperties(statusFilter, listingTypeFilter); await loadPropertyDetails(p.id, fresh); loadKpis() }}
                            onClose={() => setShowAddInquiryFor(null)}
                          />
                        )}
                      </div>

                      {/* Deals */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-slate-400">Deals ({details.deals.length})</p>
                          <button onClick={() => setShowAddDealFor(showAddDealFor === p.id ? null : p.id)} className="text-xs text-green-600 font-medium hover:underline">+ Add Deal</button>
                        </div>
                        {dealDeleteError && (
                          <div className="mb-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5 flex items-center justify-between">
                            <span>{dealDeleteError}</span>
                            <button onClick={() => setDealDeleteError(null)} className="text-red-400 hover:text-red-600 ml-2"><X size={11} /></button>
                          </div>
                        )}
                        {details.deals.length === 0 ? (
                          <p className="text-xs text-gray-400 italic dark:text-slate-500">No deals yet</p>
                        ) : (
                          <div className="space-y-3">
                            {details.deals.map(deal => (
                              <div key={deal.id} className="bg-white dark:bg-slate-900 border border-gray-100 rounded-lg px-3 py-3 dark:border-slate-800">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-500 dark:text-slate-400">Buyer: <span className="font-medium text-gray-800 dark:text-slate-200">{deal.buyer.customerName}</span></p>
                                    <p className="text-xs text-gray-500 dark:text-slate-400">Seller: <span className="font-medium text-gray-800 dark:text-slate-200">{deal.seller.customerName}</span></p>
                                    <p className="text-sm font-bold text-gray-900 mt-1 dark:text-slate-100">{fmtCurrency(deal.dealValue)}</p>
                                    <p className="text-xs text-green-700">Brokerage: {fmtCurrency(deal.brokerageAmount)} ({deal.brokeragePercent}%)</p>
                                    {deal.expectedRegistrationDate && <p className="text-xs text-orange-600 mt-0.5">Reg. date: {fmtDate(deal.expectedRegistrationDate)}</p>}
                                  </div>
                                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                    <Badge variant={DEAL_STATUS_VARIANT[deal.status] ?? 'neutral'} size="sm">{fmtLabel(deal.status)}</Badge>
                                    <button onClick={() => setDeleteTarget({ kind: 'deal', id: deal.id, propertyId: p.id })} className="text-gray-300 hover:text-red-500 p-0.5">
                                      <X size={12} />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                  {deal.status === 'IN_PROGRESS' && (
                                    <>
                                      <button
                                        onClick={() => handleUpdateDealStatus(deal.id, p.id, 'REGISTERED')}
                                        className="text-xs px-3 h-7 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                                      >Mark Registered</button>
                                      <button
                                        onClick={() => handleUpdateDealStatus(deal.id, p.id, 'FELL_THROUGH')}
                                        className="text-xs px-3 h-7 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 font-medium"
                                      >Fell Through</button>
                                    </>
                                  )}
                                  {deal.status === 'REGISTERED' && !deal.invoiceId && (
                                    <button
                                      onClick={() => handleGenerateInvoice(deal.id, p.id)}
                                      disabled={invoiceLoading === deal.id}
                                      className="flex items-center gap-1 text-xs px-3 h-7 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                                    >
                                      <Receipt size={11} />
                                      {invoiceLoading === deal.id ? 'Generating...' : 'Generate Commission Invoice'}
                                    </button>
                                  )}
                                  {deal.status === 'REGISTERED' && deal.invoiceId && (
                                    <span className="text-xs px-3 h-7 flex items-center gap-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-lg font-medium">
                                      <Receipt size={11} />
                                      Invoice Generated
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {showAddDealFor === p.id && (
                          <AddDealForm
                            propertyId={p.id}
                            clients={clients}
                            onSave={async () => { setShowAddDealFor(null); const fresh = await loadProperties(statusFilter, listingTypeFilter); await loadPropertyDetails(p.id, fresh); loadKpis() }}
                            onClose={() => setShowAddDealFor(null)}
                          />
                        )}
                      </div>
                    </div>
                  )}
                  {p.description && (
                    <p className="text-xs text-gray-500 italic mt-4 border-t pt-3 dark:text-slate-400">{p.description}</p>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {(showForm || editProperty) && (
        <PropertyForm
          clients={clients}
          initial={editProperty ?? undefined}
          onSave={() => { setShowForm(false); setEditProperty(null); loadProperties(statusFilter, listingTypeFilter); loadKpis() }}
          onClose={() => { setShowForm(false); setEditProperty(null) }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title={
          deleteTarget?.kind === 'property' ? 'Delete Property' :
          deleteTarget?.kind === 'inquiry' ? 'Delete Inquiry' : 'Delete Deal'
        }
        message={
          deleteTarget?.kind === 'property' ? 'Delete this property listing?' :
          deleteTarget?.kind === 'inquiry' ? 'Delete this inquiry?' :
          'Delete this deal? The property will be reset to Available if no other active deals exist.'
        }
        confirmLabel="Delete"
      />
    </div>
  )
}
