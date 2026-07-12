import React, { useState, useEffect, useCallback } from 'react'
import {
  Building2, Users, Receipt, BadgeDollarSign, HardDrive,
  Info, Shield, Plus, Edit2, Trash2, Check, X, Star, Layers, RefreshCw, Globe, Moon, Printer,
  ChevronRight, Eye, EyeOff, Barcode, ToggleRight
} from 'lucide-react'
import { useIndustryStore } from '@app/store/industry.store'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { SUPPORTED_LANGUAGES, setLanguage } from '@renderer/i18n'
import { cn } from '@shared/utils/cn'
import { useBusinessStore } from '@app/store/business.store'
import { useAuthStore } from '@app/store/auth.store'
import { useThemeStore } from '@app/store/theme.store'
import { useNotificationStore } from '@app/store/notification.store'
import { IndustrySettingsScreen } from '@modules/industry/ui/IndustrySettingsScreen'
import { Button } from '@shared/ui/atoms/Button'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { api } from '@renderer/services/ipc-client'
import { CURRENCIES } from '@shared/utils/currency.util'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { documentLogoUrl } from '@shared/ui/molecules/DocumentWatermark'

interface SettingsSection {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  permission?: string
  status?: 'available' | 'phase2' | 'phase7'
  linkTo?: string // navigates out instead of rendering an inline section (matches the existing Backup & Recovery pattern)
}

const SECTIONS: SettingsSection[] = [
  {
    id: 'business',
    label: 'Business Profile',
    description: 'Name, address, logo, contact details',
    icon: <Building2 size={18} />,
    status: 'available'
  },
  {
    id: 'users',
    label: 'Users & Roles',
    description: 'Manage staff accounts and role permissions',
    icon: <Users size={18} />,
    permission: 'users.view',
    status: 'available'
  },
  {
    id: 'tax',
    label: 'Tax Configuration',
    description: 'GST / VAT rates and tax models',
    icon: <Receipt size={18} />,
    permission: 'settings.modifyTax',
    status: 'available'
  },
  {
    id: 'currency',
    label: 'Currency & Locale',
    description: 'Currency symbol, date format, number format',
    icon: <BadgeDollarSign size={18} />,
    status: 'available'
  },
  {
    id: 'backup',
    label: 'Backup & Recovery',
    description: 'Backup schedule, restore, export data',
    icon: <HardDrive size={18} />,
    permission: 'backup.view',
    status: 'available'
  },
  {
    id: 'industry',
    label: 'Industry Template',
    description: 'Switch between Restaurant, Retail, Hardware, Distributor',
    icon: <Layers size={18} />,
    permission: 'settings.modify',
    status: 'available'
  },
  {
    id: 'language',
    label: 'Language',
    description: '13 languages: English, Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, Gujarati, Spanish, French, Arabic, Portuguese, Indonesian',
    icon: <Globe size={18} />,
    status: 'available'
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Dark mode and display preferences',
    icon: <Moon size={18} />,
    status: 'available'
  },
  {
    id: 'businessFeatures',
    label: 'Additional Business Features',
    description: 'Combine retail, wholesale, and trade workflows — turn on features from other business types',
    icon: <ToggleRight size={18} />,
    permission: 'settings.modify',
    status: 'available'
  },
  {
    id: 'barcode',
    label: 'Barcode & Loose Billing',
    description: 'Generate, scan, and print barcodes; sell products by weight',
    icon: <Barcode size={18} />,
    permission: 'settings.modify',
    status: 'available'
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Change your password',
    icon: <Shield size={18} />,
    status: 'available'
  },
  {
    id: 'about',
    label: 'About',
    description: 'Version info, transparency statement',
    icon: <Info size={18} />,
    status: 'available',
    linkTo: '/about' // consolidated onto the single About screen (Phase 39) — no separate inline section anymore
  }
]

function BackupLinkSection() {
  const navigate = useNavigate()
  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h3 className="text-base font-semibold text-dark">Backup &amp; Recovery</h3>
        <p className="text-sm text-slate-500 mt-1">Create, validate, and restore database backups with SHA-256 integrity verification.</p>
      </div>
      <button
        onClick={() => navigate('/backup')}
        className="flex items-center gap-3 px-6 py-4 rounded-xl bg-brand text-white font-semibold text-base hover:bg-brand/90 transition-colors"
      >
        <HardDrive size={20} />
        Open Backup &amp; Recovery
        <ChevronRight size={18} className="ml-auto" />
      </button>
    </div>
  )
}

export function SettingsScreen() {
  const [activeSection, setActiveSection] = useState('business')
  const profile = useBusinessStore((s) => s.profile)
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const navigate = useNavigate()

  function selectSection(section: SettingsSection, hasAccess: boolean) {
    if (!hasAccess) return
    if (section.linkTo) navigate(section.linkTo)
    else setActiveSection(section.id)
  }

  return (
    <div className="flex h-full">
      {/* Settings sidebar */}
      <div className="w-64 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0 overflow-y-auto">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-700 dark:text-slate-200">Settings</h2>
        </div>
        <nav className="p-2 space-y-0.5">
          {SECTIONS.map((section) => {
            const hasAccess = !section.permission || hasPermission(section.permission)
            return (
              <button
                key={section.id}
                disabled={!hasAccess}
                onClick={() => selectSection(section, hasAccess)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left text-base transition-colors',
                  activeSection === section.id
                    ? 'bg-brand text-white'
                    : hasAccess
                    ? 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                )}
              >
                <span className="shrink-0">{section.icon}</span>
                <span className="font-semibold">{section.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto p-6 dark:bg-slate-950">
        {activeSection === 'business' && <BusinessProfileSection profile={profile} />}
        {activeSection === 'users' && <UsersSection />}
        {activeSection === 'tax' && <TaxConfigurationSection />}
        {activeSection === 'currency' && <CurrencyLocaleSection />}
        {activeSection === 'backup' && <BackupLinkSection />}
        {activeSection === 'industry' && <IndustrySettingsScreen />}
        {activeSection === 'language' && <LanguageSection />}
        {activeSection === 'appearance' && <AppearanceSection />}
        {activeSection === 'businessFeatures' && <BusinessFeaturesSection />}
        {activeSection === 'barcode' && <BarcodeSection />}
        {activeSection === 'security' && <SecuritySection />}
      </div>
    </div>
  )
}

interface BPProfile {
  businessName?: string | null; businessType?: string | null; ownerName?: string | null
  country?: string | null; currencyCode?: string | null; currencySymbol?: string | null
  taxModel?: string | null; taxNumber?: string | null; upiId?: string | null
  phone?: string | null; email?: string | null; address?: string | null
  city?: string | null; state?: string | null; postalCode?: string | null; website?: string | null
  logoPath?: string | null
  showLogoOnDashboard?: boolean | null
  enableDocumentWatermark?: boolean | null
  clinicSpecialty?: string | null
}

function BusinessProfileSection({ profile }: { profile: BPProfile | null }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    businessName: profile?.businessName ?? '',
    ownerName: profile?.ownerName ?? '',
    phone: profile?.phone ?? '',
    email: profile?.email ?? '',
    taxNumber: profile?.taxNumber ?? '',
    upiId: profile?.upiId ?? '',
    address: profile?.address ?? '',
    city: profile?.city ?? '',
    state: profile?.state ?? '',
    postalCode: profile?.postalCode ?? '',
    website: profile?.website ?? '',
    logoPath: profile?.logoPath ?? '',
    showLogoOnDashboard: profile?.showLogoOnDashboard ?? false,
    enableDocumentWatermark: profile?.enableDocumentWatermark ?? false,
    clinicSpecialty: profile?.clinicSpecialty ?? ''
  })
  const setProfile = useBusinessStore((s) => s.setProfile)
  const { error: toastError, success: toastSuccess } = useNotificationStore()

  function startEdit() {
    setForm({
      businessName: profile?.businessName ?? '',
      ownerName: profile?.ownerName ?? '',
      phone: profile?.phone ?? '',
      email: profile?.email ?? '',
      taxNumber: profile?.taxNumber ?? '',
      upiId: profile?.upiId ?? '',
      address: profile?.address ?? '',
      city: profile?.city ?? '',
      state: profile?.state ?? '',
      postalCode: profile?.postalCode ?? '',
      website: profile?.website ?? '',
      logoPath: profile?.logoPath ?? '',
      showLogoOnDashboard: profile?.showLogoOnDashboard ?? false,
      enableDocumentWatermark: profile?.enableDocumentWatermark ?? false,
      clinicSpecialty: profile?.clinicSpecialty ?? ''
    })
    setError(null)
    setEditing(true)
  }

  async function pickLogo() {
    const res = await window.api.dialog.openFile({ title: 'Select Business Logo', accept: ['.jpg', '.jpeg', '.png', '.webp'], maxSizeBytes: 2 * 1024 * 1024 })
    if (res.success && res.data) {
      setForm(f => ({ ...f, logoPath: res.data as string }))
      setError(null)
    } else if (!res.success) {
      setError(res.error?.message ?? 'Could not select logo.')
    }
  }

  async function save() {
    if (!form.businessName.trim()) { setError('Business name is required.'); return }
    setSaving(true); setError(null)
    try {
      const res = await window.api.businessProfile.update({
        businessName: form.businessName.trim(),
        ownerName: form.ownerName.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        taxNumber: form.taxNumber.trim() || null,
        upiId: form.upiId.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        postalCode: form.postalCode.trim() || null,
        website: form.website.trim() || null,
        logoPath: form.logoPath || null,
        showLogoOnDashboard: form.showLogoOnDashboard,
        enableDocumentWatermark: form.enableDocumentWatermark,
        ...(profile?.businessType === 'SPECIALIST_CLINIC' ? { clinicSpecialty: form.clinicSpecialty.trim() || null } : {})
      })
      if (res.success) {
        const freshRes = await window.api.businessProfile.get()
        if (freshRes.success && freshRes.data) setProfile(freshRes.data as Parameters<typeof setProfile>[0])
        setEditing(false)
        toastSuccess('Saved', 'Business profile updated.')
      } else {
        setError(res.error?.message ?? 'Failed to save.')
        toastError('Error', res.error?.message ?? 'Failed to save.')
      }
    } catch {
      setError('Failed to save.')
      toastError('Error', 'Failed to save.')
    } finally { setSaving(false) }
  }

  const inputCls = 'w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand'

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-dark">Business Profile</h3>
          <p className="text-sm text-slate-500 mt-1">This information appears on all invoices and receipts.</p>
        </div>
        {!editing && (
          <Button size="sm" variant="outline" onClick={startEdit}>
            <Edit2 size={14} className="mr-1" /> Edit
          </Button>
        )}
      </div>

      {error && <div className="bg-danger/10 text-danger text-sm rounded-lg px-3 py-2">{error}</div>}

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Business Logo</label>
            <div className="flex items-center gap-3">
              {form.logoPath && (
                <img src={documentLogoUrl(form.logoPath)} alt="Logo preview" className="h-12 w-auto max-w-24 object-contain rounded border border-slate-200 dark:border-slate-700 bg-white p-1" />
              )}
              <Button type="button" size="sm" variant="outline" onClick={pickLogo}>{form.logoPath ? 'Change Logo' : 'Upload Logo'}</Button>
              {form.logoPath && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setForm(f => ({ ...f, logoPath: '' }))} className="text-danger">Remove</Button>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">JPG, PNG or WebP, under 2MB. Appears on all invoices and receipts.</p>
          </div>
          {form.logoPath && (
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.showLogoOnDashboard}
                  onChange={(e) => setForm((f) => ({ ...f, showLogoOnDashboard: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                Show logo on dashboard
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.enableDocumentWatermark}
                  onChange={(e) => setForm((f) => ({ ...f, enableDocumentWatermark: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                Show faint logo watermark on printed documents
              </label>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Business Name *</label>
              <input value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Owner Name</label>
              <input value={form.ownerName} onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))} className={inputCls} />
            </div>
            {profile?.businessType === 'SPECIALIST_CLINIC' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Specialty</label>
                <input value={form.clinicSpecialty} onChange={e => setForm(f => ({ ...f, clinicSpecialty: e.target.value }))}
                  placeholder="e.g. Pediatrics, Orthopedics, ENT, Ophthalmology" className={inputCls} />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">GST/VAT Number</label>
              <input value={form.taxNumber} onChange={e => setForm(f => ({ ...f, taxNumber: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">UPI ID</label>
              <input value={form.upiId} onChange={e => setForm(f => ({ ...f, upiId: e.target.value }))} placeholder="yourname@upi" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Website</label>
              <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://" className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">City</label>
              <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">State</label>
              <input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Postal Code</label>
              <input value={form.postalCode} onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
          </div>
        </div>
      ) : (
        <Card padding="none" className="divide-y divide-slate-100 dark:divide-slate-800">
          {profile?.logoPath && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">Business Logo</span>
              <img src={documentLogoUrl(profile.logoPath)} alt="Business logo" className="h-10 w-auto max-w-20 object-contain" />
            </div>
          )}
          {[
            { label: 'Business Name', value: profile?.businessName },
            { label: 'Business Type', value: profile?.businessType },
            { label: 'Owner Name', value: profile?.ownerName },
            ...(profile?.businessType === 'SPECIALIST_CLINIC' ? [{ label: 'Specialty', value: profile?.clinicSpecialty }] : []),
            { label: 'Country', value: profile?.country },
            { label: 'Currency', value: profile?.currencyCode ? `${profile.currencySymbol} (${profile.currencyCode})` : undefined },
            { label: 'Tax Model', value: profile?.taxModel },
            { label: 'GST/VAT Number', value: profile?.taxNumber },
            { label: 'UPI ID', value: profile?.upiId },
            { label: 'Phone', value: profile?.phone },
            { label: 'Email', value: profile?.email },
            { label: 'Address', value: [profile?.address, profile?.city, profile?.state, profile?.postalCode].filter(Boolean).join(', ') || null },
            { label: 'Website', value: profile?.website }
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{value || <span className="text-slate-300 dark:text-slate-600">—</span>}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}


function UsersSection() {
  const hasPermission = useAuthStore((s) => s.hasPermission)

  if (!hasPermission('users.view')) {
    return (
      <div className="flex items-center gap-3 p-4 bg-danger/10 border border-danger/20 rounded-lg">
        <Shield size={18} className="text-danger" />
        <p className="text-sm text-danger">You don't have permission to view users.</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h3 className="text-base font-semibold text-dark">Users & Roles</h3>
        <p className="text-sm text-slate-500 mt-1">Manage staff accounts and their access levels.</p>
      </div>
      <UsersManagementSection />
    </div>
  )
}

function ComingSoonSection({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h3 className="text-base font-semibold text-dark">{title}</h3>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
        <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center mx-auto mb-3">
          <span className="text-brand font-semibold text-sm">S</span>
        </div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Coming in {phase}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">This section will be fully functional in {phase}.</p>
      </div>
    </div>
  )
}

// ─── Tax Configuration ───────────────────────────────────────────────────────

interface TaxConfig {
  id: string; taxName: string; taxType: string; rate: number
  country?: string | null; isDefault: boolean; isActive: boolean
}

const TAX_TYPES = ['GST', 'VAT', 'SALES_TAX', 'CUSTOM', 'NONE'] as const

function TaxConfigurationSection() {
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [taxes, setTaxes] = useState<TaxConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TaxConfig | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ taxName: '', taxType: 'GST', rate: '', country: '', isDefault: false })

  const loadTaxes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.tax.list()
      if (res.success) setTaxes(res.data as TaxConfig[])
      else toastError('Error', res.error?.message ?? 'Failed to load tax rates.')
    } catch {
      toastError('Error', 'Failed to load tax rates.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { loadTaxes() }, [loadTaxes])

  function startEdit(tax: TaxConfig) {
    setEditId(tax.id)
    setForm({ taxName: tax.taxName, taxType: tax.taxType, rate: String(tax.rate), country: tax.country ?? '', isDefault: tax.isDefault })
    setShowForm(false)
  }

  function resetForm() {
    setEditId(null)
    setShowForm(false)
    setForm({ taxName: '', taxType: 'GST', rate: '', country: '', isDefault: false })
  }

  async function handleSave() {
    const rate = parseFloat(form.rate)
    if (!form.taxName.trim() || isNaN(rate) || rate < 0 || rate > 100) {
      toastError('Validation Error', 'Please enter a valid name and rate (0–100).')
      return
    }
    setSaving(true)
    try {
      const payload = { taxName: form.taxName.trim(), taxType: form.taxType, rate, country: form.country || undefined, isDefault: form.isDefault }
      const res = editId
        ? await window.api.tax.update({ id: editId, ...payload })
        : await window.api.tax.create(payload)
      if (res.success) {
        toastSuccess(editId ? 'Tax Updated' : 'Tax Created', `"${form.taxName.trim()}" has been saved.`)
        resetForm()
        loadTaxes()
      } else {
        toastError('Error', res.error?.message ?? 'Failed to save.')
      }
    } catch {
      toastError('Error', 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await window.api.tax.delete(deleteTarget.id)
      if (res.success) {
        toastSuccess('Tax Deleted', `"${deleteTarget.taxName}" has been removed.`)
        setDeleteTarget(null)
        loadTaxes()
      } else {
        toastError('Error', res.error?.message ?? 'Failed to delete.')
      }
    } catch {
      toastError('Error', 'Failed to delete.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-dark">Tax Configuration</h3>
          <p className="text-sm text-slate-500 mt-1">Configure GST, VAT and other tax rates used in billing.</p>
        </div>
        {!showForm && !editId && (
          <Button size="md" onClick={() => setShowForm(true)}>
            <Plus size={16} className="mr-1.5" /> Add Tax
          </Button>
        )}
      </div>

      {/* Add / Edit form */}
      {(showForm || editId) && (
        <div className="bg-brand/5 border border-brand/20 rounded-lg p-4 space-y-4">
          <p className="text-sm font-semibold text-brand">{editId ? 'Edit Tax Rate' : 'New Tax Rate'}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1.5">Name *</label>
              <input value={form.taxName} onChange={(e) => setForm(f => ({ ...f, taxName: e.target.value }))}
                placeholder="e.g. GST 18%" className="w-full h-11 px-4 rounded-lg border border-slate-200 text-base bg-white focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <Select label="Type" required value={form.taxType} onChange={(e) => setForm(f => ({ ...f, taxType: e.target.value }))}>
              {TAX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1.5">Rate (%) *</label>
              <input type="number" min="0" max="100" step="0.5" value={form.rate}
                onChange={(e) => setForm(f => ({ ...f, rate: e.target.value }))}
                placeholder="e.g. 18" className="w-full h-11 px-4 rounded-lg border border-slate-200 text-base bg-white focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1.5">Country</label>
              <input value={form.country} onChange={(e) => setForm(f => ({ ...f, country: e.target.value }))}
                placeholder="e.g. India" className="w-full h-11 px-4 rounded-lg border border-slate-200 text-base bg-white focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-base text-slate-700 cursor-pointer select-none">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm(f => ({ ...f, isDefault: e.target.checked }))}
              className="w-5 h-5 rounded border-slate-300 text-brand focus:ring-brand" />
            Set as default for this tax type
          </label>
          <div className="flex gap-2">
            <Button size="md" onClick={handleSave} loading={saving}>
              {editId ? 'Save Changes' : 'Add Tax Rate'}
            </Button>
            <Button variant="secondary" size="md" onClick={resetForm}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Tax list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
      ) : taxes.length === 0 ? (
        <Card padding="lg" className="text-center">
          <Receipt size={32} className="text-slate-200 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">No tax rates configured.</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Add your first tax rate above.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {taxes.map((tax) => (
            <Card key={tax.id} padding="none" hoverable className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold text-dark">{tax.taxName}</p>
                  {tax.isDefault && (
                    <span className="flex items-center gap-0.5 text-sm text-warning font-semibold">
                      <Star size={12} className="fill-warning" /> Default
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400">{tax.taxType}{tax.country ? ` · ${tax.country}` : ''}</p>
              </div>
              <span className="text-base font-bold text-dark shrink-0">{tax.rate}%</span>
              <button onClick={() => startEdit(tax)} className="p-2.5 rounded-lg text-slate-400 hover:text-brand hover:bg-brand/10 transition-colors" title="Edit">
                <Edit2 size={16} />
              </button>
              <button onClick={() => setDeleteTarget(tax)} className="p-2.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/10 transition-colors" title="Delete">
                <Trash2 size={16} />
              </button>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Tax Rate"
        message={`Delete "${deleteTarget?.taxName}"? This will deactivate the rate. Existing invoices are not affected.`}
        confirmLabel="Delete"
        confirmVariant="danger"
      />
    </div>
  )
}

// ─── Users Management ────────────────────────────────────────────────────────

interface User { id: string; fullName: string; username: string; email?: string | null; phone?: string | null; isActive: boolean; roleId?: string | null; role?: { id: string; roleName: string } | null }
interface Role { id: string; roleName: string }

const EMPTY_USER_FORM = { fullName: '', username: '', password: '', roleId: '', email: '', phone: '' }

function UsersManagementSection() {
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [form, setForm] = useState({ ...EMPTY_USER_FORM })
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [resetPwd, setResetPwd] = useState('')
  const [showResetPwd, setShowResetPwd] = useState(false)
  const [resetSaving, setResetSaving] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const currentUser = useAuthStore((s) => s.user)
  const { error: toastError } = useNotificationStore()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [uRes, rRes] = await Promise.all([window.api.users.list(), window.api.roles.list()])
      if (uRes.success) setUsers(uRes.data as User[])
      if (rRes.success) setRoles((rRes.data as Role[]))
      if (!uRes.success || !rRes.success) {
        toastError('Error', (uRes.error ?? rRes.error)?.message ?? 'Failed to load users.')
      }
    } catch {
      toastError('Error', 'Failed to load users.')
    } finally { setLoading(false) }
  }, [toastError])

  useEffect(() => { loadData() }, [loadData])

  const openAdd = () => {
    setEditUser(null)
    setForm({ ...EMPTY_USER_FORM, roleId: roles[0]?.id ?? '' })
    setShowPassword(false)
    setError(null)
    setShowModal(true)
  }

  const openEdit = (u: User) => {
    setEditUser(u)
    setForm({ fullName: u.fullName, username: u.username, password: '', roleId: u.role?.id ?? u.roleId ?? '', email: u.email ?? '', phone: u.phone ?? '' })
    setShowPassword(false)
    setError(null)
    setShowModal(true)
  }

  const save = async () => {
    if (!form.fullName.trim()) { setError('Full name is required.'); return }
    if (!editUser && !form.username.trim()) { setError('Username is required.'); return }
    if (!editUser && form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (!form.roleId) { setError('Please select a role.'); return }
    setSaving(true); setError(null)
    try {
      const res = editUser
        ? await window.api.users.update({ id: editUser.id, fullName: form.fullName.trim(), roleId: form.roleId, email: form.email || undefined, phone: form.phone || undefined })
        : await window.api.users.create({ fullName: form.fullName.trim(), username: form.username.trim(), password: form.password, roleId: form.roleId, email: form.email || undefined, phone: form.phone || undefined })
      if (res.success) { setShowModal(false); loadData() }
      else setError(res.error?.message ?? 'Failed to save user.')
    } catch {
      setError('Failed to save user.')
    } finally { setSaving(false) }
  }

  const deactivate = async (u: User) => {
    if (!confirm(`Deactivate "${u.fullName}"? They will no longer be able to log in.`)) return
    try {
      const res = await window.api.users.deactivate({ userId: u.id })
      if (res.success) loadData()
      else alert(res.error?.message ?? 'Failed to deactivate user.')
    } catch {
      alert('Failed to deactivate user.')
    }
  }

  const openResetPassword = (u: User) => {
    setResetTarget(u); setResetPwd(''); setShowResetPwd(false); setResetError(null)
  }

  const doResetPassword = async () => {
    if (!resetTarget) return
    if (resetPwd.length < 6) { setResetError('Password must be at least 6 characters.'); return }
    setResetSaving(true); setResetError(null)
    try {
      const res = await window.api.users.adminResetPassword({ userId: resetTarget.id, newPassword: resetPwd })
      if (res.success) { setResetTarget(null) }
      else { setResetError(res.error?.message ?? 'Failed to reset password.') }
    } catch {
      setResetError('Failed to reset password.')
    } finally {
      setResetSaving(false)
    }
  }

  const canCreate = hasPermission('users.create')
  const canUpdate = hasPermission('users.update')
  const canDisable = hasPermission('users.disable')

  if (loading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />)}</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{users.length} staff account{users.length !== 1 ? 's' : ''}</p>
        {canCreate && (
          <Button size="sm" onClick={openAdd}>
            <Plus size={14} className="mr-1" /> Add User
          </Button>
        )}
      </div>

      {users.length === 0 ? (
        <Card padding="lg" className="text-center">
          <Users size={32} className="text-slate-200 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No users found.</p>
        </Card>
      ) : (
        users.map((u) => (
          <Card key={u.id} padding="none" className={cn('flex items-center gap-3 px-4 py-3', !u.isActive && 'opacity-50')}>
            <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <span className="text-brand font-semibold text-xs">{u.fullName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-dark">{u.fullName}</p>
              <p className="text-xs text-slate-400">{u.username} · {u.role?.roleName ?? 'No Role'}</p>
            </div>
            <Badge variant={u.isActive ? 'success' : 'neutral'} size="sm">
              {u.isActive ? 'Active' : 'Inactive'}
            </Badge>
            <div className="flex items-center gap-1 shrink-0">
              {canUpdate && (
                <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-brand transition-colors" title="Edit user">
                  <Edit2 size={14} />
                </button>
              )}
              {canUpdate && u.id !== currentUser?.id && (
                <button onClick={() => openResetPassword(u)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-warning transition-colors" title="Reset password">
                  <Shield size={14} />
                </button>
              )}
              {canDisable && u.isActive && u.id !== currentUser?.id && (
                <button onClick={() => deactivate(u)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-danger transition-colors" title="Deactivate user">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </Card>
        ))
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-dark">{editUser ? 'Edit User' : 'Add User'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            {error && <div className="bg-danger/10 text-danger text-sm rounded-lg px-3 py-2">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              {!editUser && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username *</label>
                    <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                      autoComplete="off"
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password *</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        autoComplete="new-password"
                        className="w-full h-11 pl-3 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand" />
                      <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </>
              )}
              <Select label="Role" required value={form.roleId} onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))}>
                <option value="">Select role…</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.roleName}</option>)}
              </Select>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : editUser ? 'Save Changes' : 'Create User'}</Button>
            </div>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-dark">Reset Password</h2>
              <button onClick={() => setResetTarget(null)} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <p className="text-sm text-slate-500">Set a new password for <strong>{resetTarget.fullName}</strong>. Their active sessions will be invalidated.</p>
            {resetError && <div className="bg-danger/10 text-danger text-sm rounded-lg px-3 py-2">{resetError}</div>}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">New Password *</label>
              <div className="relative">
                <input type={showResetPwd ? 'text' : 'password'} value={resetPwd} onChange={e => setResetPwd(e.target.value)}
                  autoComplete="new-password" placeholder="Min. 6 characters"
                  className="w-full h-11 pl-3 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand" />
                <button type="button" onClick={() => setShowResetPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showResetPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setResetTarget(null)}>Cancel</Button>
              <Button size="sm" onClick={doResetPassword} disabled={resetSaving}>{resetSaving ? 'Resetting…' : 'Reset Password'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const DISK_ENCRYPTION_DISMISSED_KEY = 'sarang-disk-encryption-notice-dismissed'

const PLATFORM_ENCRYPTION_COPY: Record<string, { name: string; howTo: string }> = {
  win32: { name: 'BitLocker', howTo: 'Settings → Privacy & Security → Device Encryption (or search "BitLocker")' },
  darwin: { name: 'FileVault', howTo: 'System Settings → Privacy & Security → FileVault' },
  linux: { name: 'full-disk encryption (LUKS)', howTo: 'your distribution’s disk utility, or re-install with encryption enabled' },
}

// F.15.3 — this app has no database-level encryption at rest (a deliberate
// scope decision, see PHASE_54F_15_TECHNICAL_SPEC.md Section 3: adding one
// would be this project's first native dependency, a real ongoing build-
// pipeline cost). OS-level disk encryption is the actual, zero-cost mitigation
// for this app's real threat model (a lost/stolen powered-off machine) —
// this is a one-time educational nudge toward turning it on, not a recurring
// alert, so it lives here (dismissible, localStorage-backed) rather than on
// the Dashboard's alert list.
function DiskEncryptionNotice() {
  const [platform, setPlatform] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISK_ENCRYPTION_DISMISSED_KEY) === '1')

  useEffect(() => {
    window.api.app.getPlatform().then((res) => {
      if (res.success) setPlatform(res.data as string)
    })
  }, [])

  if (dismissed) return null
  const copy = platform ? PLATFORM_ENCRYPTION_COPY[platform] : null

  function dismiss() {
    localStorage.setItem(DISK_ENCRYPTION_DISMISSED_KEY, '1')
    setDismissed(true)
  }

  return (
    <Card padding="lg" className="bg-brand/5 border border-brand/20">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
          <HardDrive size={16} className="text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Protect your data if this device is lost or stolen</h4>
          <p className="text-xs text-slate-500 mt-1">
            Sarang stores all your business data in a local file on this computer. Turning on your operating system's built-in disk encryption
            {copy ? <> (<strong>{copy.name}</strong>, found under {copy.howTo})</> : ' (BitLocker on Windows, FileVault on Mac, or your Linux distribution’s disk encryption)'} protects
            that file if the device is ever lost, stolen, or disposed of — a one-time setup step outside of Sarang, at no extra cost.
          </p>
        </div>
        <button onClick={dismiss} className="text-slate-400 hover:text-slate-600 shrink-0" aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>
    </Card>
  )
}

function SecuritySection() {
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const currentUser = useAuthStore((s) => s.user)
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { settings, getSetting, setSettings } = useBusinessStore()
  const minLen = parseInt(getSetting('password_min_length', '10'), 10) || 10

  async function handleChangePassword() {
    setError(null); setSuccess(false)
    if (!oldPwd) { setError('Current password is required.'); return }
    if (newPwd.length < minLen) { setError(`New password must be at least ${minLen} characters.`); return }
    if (newPwd !== confirmPwd) { setError('New passwords do not match.'); return }
    if (!currentUser?.id) { setError('Session error. Please log in again.'); return }
    setSaving(true)
    try {
      const res = await window.api.auth.changePassword({ userId: currentUser.id, oldPassword: oldPwd, newPassword: newPwd })
      if (res.success) {
        setOldPwd(''); setNewPwd(''); setConfirmPwd('')
        setSuccess(true)
      } else {
        setError(res.error?.message ?? 'Failed to change password.')
      }
    } catch {
      setError('Failed to change password.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full h-11 pl-3 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand'

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h3 className="text-base font-semibold text-dark">Security</h3>
        <p className="text-sm text-slate-500 mt-1">Change your login password. You will need to log in again after changing it.</p>
      </div>
      <DiskEncryptionNotice />
      <Card padding="lg" className="space-y-4">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Change Password</h4>
        {error && <div className="bg-danger/10 text-danger text-sm rounded-lg px-3 py-2">{error}</div>}
        {success && <div className="bg-success/10 text-success text-sm rounded-lg px-3 py-2">Password changed successfully.</div>}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Current Password</label>
          <div className="relative">
            <input type={showOld ? 'text' : 'password'} value={oldPwd} onChange={e => setOldPwd(e.target.value)} className={inputCls} />
            <button type="button" onClick={() => setShowOld(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">New Password</label>
          <div className="relative">
            <input type={showNew ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)} className={inputCls} placeholder={`Min. ${minLen} characters`} />
            <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Confirm New Password</label>
          <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} autoComplete="new-password"
            className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div className="flex justify-end pt-1">
          <Button size="sm" onClick={handleChangePassword} disabled={saving}>{saving ? 'Saving…' : 'Change Password'}</Button>
        </div>
      </Card>

      {hasPermission('settings.modify') && (
        <PasswordPolicyCard minLen={minLen} onSaved={(value) => setSettings({ ...settings, password_min_length: value })} />
      )}
    </div>
  )
}

function PasswordPolicyCard({ minLen, onSaved }: { minLen: number; onSaved: (value: string) => void }) {
  const [value, setValue] = useState(String(minLen))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSave() {
    setError(null); setSuccess(false)
    const parsed = parseInt(value, 10)
    if (!Number.isFinite(parsed) || parsed < 4 || parsed > 64) {
      setError('Enter a number between 4 and 64.')
      return
    }
    setSaving(true)
    try {
      const res = await window.api.settings.set({ key: 'password_min_length', value: String(parsed) })
      if (res.success) {
        setSuccess(true)
        onSaved(String(parsed))
      } else {
        setError(res.error?.message ?? 'Failed to save.')
      }
    } catch {
      setError('Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card padding="lg" className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Password Policy</h4>
        <p className="text-xs text-slate-500 mt-1">The minimum password length required for every user account — applies the next time a password is created or changed. Existing passwords are not affected retroactively.</p>
      </div>
      {error && <div className="bg-danger/10 text-danger text-sm rounded-lg px-3 py-2">{error}</div>}
      {success && <div className="bg-success/10 text-success text-sm rounded-lg px-3 py-2">Password policy updated.</div>}
      <div className="max-w-[200px]">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Minimum Length</label>
        <input type="number" min={4} max={64} value={value} onChange={e => setValue(e.target.value)}
          className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand" />
      </div>
      <div className="flex justify-end pt-1">
        <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
    </Card>
  )
}

// ─── Currency & Locale ──────────────────────────────────────────────────────

const NUMBER_FORMATS = [
  { value: 'IN', label: 'Indian (1,00,000.00)', locale: 'en-IN' },
  { value: 'US', label: 'US/International (100,000.00)', locale: 'en-US' },
  { value: 'EU', label: 'European (100.000,00)', locale: 'de-DE' },
  { value: 'UK', label: 'British (100,000.00)', locale: 'en-GB' },
  { value: 'AR', label: 'Arabic', locale: 'ar-SA' },
  { value: 'ID', label: 'Indonesian', locale: 'id-ID' }
]

function CurrencyLocaleSection() {
  const { profile, getSetting } = useBusinessStore()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [currencyCode, setCurrencyCode] = useState(profile?.currencyCode ?? 'INR')
  const [numberFormat, setNumberFormat] = useState(getSetting('number_format', 'IN'))
  const [decimalPlaces, setDecimalPlaces] = useState(getSetting('decimal_places', '2'))
  const [saving, setSaving] = useState(false)

  const selected = CURRENCIES.find(c => c.code === currencyCode)

  async function handleSave() {
    setSaving(true)
    try {
      const [profileRes, fmtRes, decRes] = await Promise.all([
        api.businessProfile.update({ currencyCode, currencySymbol: selected?.symbol ?? currencyCode }),
        api.settings.set({ key: 'number_format', value: numberFormat }),
        api.settings.set({ key: 'decimal_places', value: decimalPlaces })
      ])
      if (profileRes.success && fmtRes.success && decRes.success) toastSuccess('Currency & locale settings saved')
      else toastError('Failed to save settings')
    } catch {
      toastError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h3 className="text-base font-semibold text-dark">Currency & Locale</h3>
        <p className="text-sm text-slate-500 mt-1">Configure how money and dates appear throughout the app.</p>
      </div>

      <div className="space-y-4">
        <Select
          label="Currency"
          value={currencyCode}
          onChange={e => setCurrencyCode(e.target.value)}
        >
          {CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>{c.symbol} — {c.name} ({c.code})</option>
          ))}
        </Select>

        <Select
          label="Number Format"
          value={numberFormat}
          onChange={e => setNumberFormat(e.target.value)}
        >
          {NUMBER_FORMATS.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </Select>

        <Select
          label="Decimal Places"
          value={decimalPlaces}
          onChange={e => setDecimalPlaces(e.target.value)}
        >
          <option value="0">0 (e.g. {selected?.symbol}1,000)</option>
          <option value="2">2 (e.g. {selected?.symbol}1,000.00)</option>
          <option value="3">3 (e.g. {selected?.symbol}1,000.000)</option>
        </Select>
      </div>

      <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
        <p className="text-xs text-slate-500">Preview: <span className="font-semibold text-dark">{selected?.symbol ?? currencyCode}1{numberFormat === 'IN' ? ',00,' : ',00'}000{decimalPlaces !== '0' ? '.' + '0'.repeat(parseInt(decimalPlaces)) : ''}</span></p>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50"
      >
        {saving ? <RefreshCw size={14} className="animate-spin" /> : null}
        Save Settings
      </button>
    </div>
  )
}

function LanguageSection() {
  const { i18n } = useTranslation()
  const [selected, setSelected] = useState(i18n.language)

  function handleChange(code: string) {
    setSelected(code)
    setLanguage(code as Parameters<typeof setLanguage>[0])
  }

  const indian = SUPPORTED_LANGUAGES.filter(l => l.flag === '🇮🇳')
  const international = SUPPORTED_LANGUAGES.filter(l => l.flag !== '🇮🇳' && l.code !== 'en')
  const english = SUPPORTED_LANGUAGES.find(l => l.code === 'en')!

  function LangRow({ lang }: { lang: typeof SUPPORTED_LANGUAGES[number] }) {
    return (
      <button
        key={lang.code}
        onClick={() => handleChange(lang.code)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{lang.flag}</span>
          <div>
            <p className="text-sm font-semibold text-dark">{lang.nativeName}</p>
            <p className="text-xs text-slate-400">{lang.name}{lang.rtl ? ' · RTL' : ''}</p>
          </div>
        </div>
        {selected === lang.code && (
          <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center shrink-0">
            <Check size={12} className="text-white" />
          </div>
        )}
      </button>
    )
  }

  return (
    <div className="max-w-md space-y-5">
      <div>
        <h3 className="text-base font-semibold text-dark">Language / भाषा / ভাষা</h3>
        <p className="text-sm text-slate-500 mt-1">13 languages supported. Changes take effect immediately.</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 px-1">Global</p>
        <Card padding="none" className="divide-y divide-slate-100">
          <LangRow lang={english} />
          {international.map(lang => <LangRow key={lang.code} lang={lang} />)}
        </Card>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 px-1">Indian Languages</p>
        <Card padding="none" className="divide-y divide-slate-100">
          {indian.map(lang => <LangRow key={lang.code} lang={lang} />)}
        </Card>
      </div>

      <p className="text-xs text-slate-400">
        Arabic switches the interface to right-to-left layout automatically.
      </p>
    </div>
  )
}

function AppearanceSection() {
  const { isDark, toggleTheme } = useThemeStore()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const getSetting = useBusinessStore(s => s.getSetting)
  // getSetting() already returns its own default ('') when the key is missing,
  // so a trailing `?? 'A4'` here never fires — the empty string isn't nullish.
  // Pass the fallback straight into getSetting instead.
  const [printType, setPrintType] = useState<string>(() => getSetting('print_type', 'A4'))

  async function savePrintType(value: string) {
    const previous = printType
    setPrintType(value)
    try {
      const res = await window.api.settings.set({ key: 'print_type', value })
      if (res.success) {
        toastSuccess('Print type saved')
      } else {
        setPrintType(previous)
        toastError('Error', res.error?.message ?? 'Failed to save print type.')
      }
    } catch {
      setPrintType(previous)
      toastError('Error', 'Failed to save print type.')
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h3 className="text-base font-semibold text-dark dark:text-slate-100">Appearance</h3>
        <p className="text-sm text-slate-500 mt-1">Control how Sarang looks on your screen.</p>
      </div>
      <Card padding="none" className="divide-y divide-slate-100 dark:divide-slate-800">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <Moon size={18} className="text-slate-400" />
            <div>
              <p className="text-sm font-semibold text-dark dark:text-slate-100">Dark Mode</p>
              <p className="text-xs text-slate-400 mt-0.5">Switch to a dark colour scheme to reduce eye strain</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
              isDark ? 'bg-brand' : 'bg-slate-200'
            )}
            role="switch" aria-checked={isDark}
          >
            <span className={cn(
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
              isDark ? 'translate-x-5' : 'translate-x-0'
            )} />
          </button>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Printer size={18} className="text-slate-400" />
            <div>
              <p className="text-sm font-semibold text-dark dark:text-slate-100">Print Type</p>
              <p className="text-xs text-slate-400 mt-0.5">Choose between A4 invoice or thermal receipt printer</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'A4', label: 'A4 Invoice', desc: 'Full-page, colour' },
              { value: 'THERMAL_80MM', label: 'Thermal 80mm', desc: 'Standard POS receipt' },
              { value: 'THERMAL_58MM', label: 'Thermal 58mm', desc: 'Narrow POS receipt' }
            ].map(opt => (
              <button key={opt.value} onClick={() => savePrintType(opt.value)}
                className={cn('px-3 py-2.5 rounded-xl border text-left transition-colors',
                  printType === opt.value
                    ? 'border-brand bg-brand/5'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                )}>
                <p className={cn('text-sm font-semibold', printType === opt.value ? 'text-brand' : 'text-dark dark:text-slate-100')}>{opt.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </Card>
      <p className="text-xs text-slate-400">Your preference is saved automatically and will be remembered next time you open Sarang.</p>
    </div>
  )
}

// Hybrid Business Operations phase — the Industry Template picker
// (IndustrySettingsScreen.tsx) is a single-select radio button: choosing
// "Distributor / Wholesale" replaces a Retail business's module set rather
// than adding to it, so a shop that does both walk-in retail AND wholesale/
// trade sales had no way to get both feature sets at once. This section lets
// any business individually opt into another business type's modules —
// exactly the same `updateEnabledModules` mechanism BarcodeSection already
// uses for barcode_generation/loose_billing, just extended to 5 more modules.
// All 5 are confirmed safe to combine with any business type: credit limit
// enforcement only applies to a customer who actually has a credit limit set
// (Customer.creditLimit > 0) — a walk-in retail customer defaults to 0 and is
// never affected; Bulk Orders is a separate screen staff opt into per sale,
// never applied to a normal Billing Screen transaction; Returns/Area
// Pricing/Outstanding Analytics are purely additive UI, unused unless a
// product or workflow actually needs them.
function BusinessFeaturesSection() {
  const { enabledModules, updateEnabledModules } = useIndustryStore()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [saving, setSaving] = useState<string | null>(null)

  const MODULES: Array<{ key: 'returns' | 'area_pricing' | 'credit_limit_enforcement' | 'bulk_orders' | 'outstanding_analytics'; label: string; desc: string }> = [
    { key: 'returns', label: 'Returns Workflow', desc: 'Accept product returns with automatic inventory and ledger reversal (Retail default)' },
    { key: 'area_pricing', label: 'Area Pricing Calculator', desc: 'Price by area (sq ft / sq m) for products like glass, plywood, or tiles (Hardware default)' },
    { key: 'credit_limit_enforcement', label: 'Credit Limit Enforcement', desc: "Block a credit sale once a customer's outstanding balance would exceed their credit limit. Only applies to customers who have a credit limit set — walk-in customers are never affected (Hardware/Distributor default)" },
    { key: 'bulk_orders', label: 'Bulk Order Workflow', desc: 'A separate bulk-order screen with volume-based discount tiers for wholesale/dealer customers (Distributor default)' },
    { key: 'outstanding_analytics', label: 'Outstanding Analytics', desc: 'Extra reporting on customer outstanding balances and aging (Distributor default)' },
  ]

  // Fresh-audit fix (2026-07-12): LOGISTICS_MODULES (Fleet/Carriers/
  // Shipments/GRN/Challan/Freight/Analytics) used to be appended by default
  // to nearly every business template including pure-service ones with no
  // goods movement (SERVICE/CONSULTANT/REPAIR) and RESTAURANT — removed from
  // those defaults in industry-template.service.ts. This bundle toggle is
  // what restores it for anyone who actually does need it (e.g. a
  // restaurant that wants to track supplier deliveries via GRN), same
  // "layer on any feature regardless of business type" mechanism as the 5
  // single-flag toggles above, just applied to all 7 logistics flags at once
  // since they're always meaningful together, never individually.
  const LOGISTICS_BUNDLE = [
    'logistics_fleet', 'logistics_carriers', 'logistics_shipments',
    'logistics_grn', 'logistics_challan', 'logistics_freight', 'logistics_analytics',
  ] as const

  async function toggle(key: string, on: boolean) {
    setSaving(key)
    try {
      const next = on ? [...enabledModules, key as never] : enabledModules.filter(m => m !== key)
      const res = await updateEnabledModules(next as typeof enabledModules)
      if (res.success) toastSuccess(on ? 'Enabled' : 'Disabled', on ? 'Feature turned on.' : 'Feature turned off. Existing data is unaffected.')
      else toastError('Error', res.error?.message ?? 'Could not update.')
    } catch {
      toastError('Error', 'Could not update.')
    } finally {
      setSaving(null)
    }
  }

  async function toggleLogistics(on: boolean) {
    setSaving('logistics_bundle')
    try {
      const next = on
        ? [...enabledModules, ...LOGISTICS_BUNDLE.filter(k => !enabledModules.includes(k as never))] as never[]
        : enabledModules.filter(m => !(LOGISTICS_BUNDLE as readonly string[]).includes(m))
      const res = await updateEnabledModules(next as typeof enabledModules)
      if (res.success) toastSuccess(on ? 'Enabled' : 'Disabled', on ? 'Logistics & Supply Chain turned on.' : 'Logistics & Supply Chain turned off. Existing data is unaffected.')
      else toastError('Error', res.error?.message ?? 'Could not update.')
    } catch {
      toastError('Error', 'Could not update.')
    } finally {
      setSaving(null)
    }
  }

  const logisticsOn = LOGISTICS_BUNDLE.every(k => enabledModules.includes(k as never))

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h3 className="text-base font-semibold text-dark dark:text-slate-100">Additional Business Features</h3>
        <p className="text-sm text-slate-500 mt-1">Your Industry Template sets a default feature set, but you can layer on any of these regardless of business type — e.g. a Retail shop that also sells wholesale to dealers.</p>
      </div>

      <Card padding="none" className="divide-y divide-slate-100 dark:divide-slate-800">
        {MODULES.map(m => {
          const on = enabledModules.includes(m.key)
          return (
            <div key={m.key} className="flex items-center justify-between px-5 py-4">
              <div className="pr-4">
                <p className="text-sm font-semibold text-dark dark:text-slate-100">{m.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{m.desc}</p>
              </div>
              <button
                onClick={() => toggle(m.key, !on)}
                disabled={saving === m.key}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50',
                  on ? 'bg-brand' : 'bg-slate-200'
                )}
                role="switch" aria-checked={on}
              >
                <span className={cn(
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
                  on ? 'translate-x-5' : 'translate-x-0'
                )} />
              </button>
            </div>
          )
        })}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="pr-4">
            <p className="text-sm font-semibold text-dark dark:text-slate-100">Logistics &amp; Supply Chain</p>
            <p className="text-xs text-slate-400 mt-0.5">Fleet, carriers, shipments, goods receipt (GRN), delivery challans, and freight tracking — for any business that moves goods via its own vehicles or receives supplier deliveries it wants to track formally (Retail/Distributor/Pharmacy/Manufacturing and similar goods-based types default on)</p>
          </div>
          <button
            onClick={() => toggleLogistics(!logisticsOn)}
            disabled={saving === 'logistics_bundle'}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50',
              logisticsOn ? 'bg-brand' : 'bg-slate-200'
            )}
            role="switch" aria-checked={logisticsOn}
          >
            <span className={cn(
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
              logisticsOn ? 'translate-x-5' : 'translate-x-0'
            )} />
          </button>
        </div>
      </Card>
    </div>
  )
}

// Phase 38: Barcode System + Loose/Weight Billing settings. Every toggle here
// defaults OFF for every business type (see TEMPLATE_DEFAULTS in
// industry-template.service.ts) — this section is how an owner opts in; nothing
// here changes anyone's workflow until they turn it on themselves.
function BarcodeSection() {
  const { enabledModules, updateEnabledModules } = useIndustryStore()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const getSetting = useBusinessStore(s => s.getSetting)
  const [saving, setSaving] = useState<string | null>(null)
  const [labelWidth, setLabelWidth] = useState<string>(() => getSetting('label_width_mm', '40'))
  const [labelHeight, setLabelHeight] = useState<string>(() => getSetting('label_height_mm', '30'))
  const [backfilling, setBackfilling] = useState(false)
  const [backfillResult, setBackfillResult] = useState<string | null>(null)

  const MODULES: Array<{ key: 'barcode_generation' | 'barcode_printing' | 'loose_billing'; label: string; desc: string }> = [
    { key: 'barcode_generation', label: 'Barcode Generation & Scanning', desc: 'Auto-generate barcodes for products, and scan barcodes at checkout and stock lookup' },
    { key: 'barcode_printing', label: 'Barcode Label Printing', desc: 'Print barcode + price labels — thermal label printer or a regular A4/letter printer' },
    { key: 'loose_billing', label: 'Loose / Weight-Based Billing', desc: 'Sell products loose by weight (e.g. per kg) instead of, or alongside, fixed packs' }
  ]

  async function toggle(key: string, on: boolean) {
    setSaving(key)
    try {
      const next = on ? [...enabledModules, key as never] : enabledModules.filter(m => m !== key)
      const res = await updateEnabledModules(next as typeof enabledModules)
      if (res.success) toastSuccess(on ? 'Enabled' : 'Disabled', on ? 'Feature turned on.' : 'Feature turned off. Your existing barcodes and loose-billed products are unaffected.')
      else toastError('Error', res.error?.message ?? 'Could not update.')
    } catch {
      toastError('Error', 'Could not update.')
    } finally {
      setSaving(null)
    }
  }

  async function saveLabelSize() {
    try {
      const [widthRes, heightRes] = await Promise.all([
        window.api.settings.set({ key: 'label_width_mm', value: labelWidth }),
        window.api.settings.set({ key: 'label_height_mm', value: labelHeight })
      ])
      if (widthRes.success && heightRes.success) {
        toastSuccess('Label size saved')
      } else {
        toastError('Error', (widthRes.error ?? heightRes.error)?.message ?? 'Failed to save label size.')
      }
    } catch {
      toastError('Error', 'Failed to save label size.')
    }
  }

  async function runBackfill() {
    setBackfilling(true)
    setBackfillResult(null)
    try {
      const res = await window.api.products.bulkGenerateMissingBarcodes()
      if (res.success) {
        const { generated, totalMissing } = res.data as { generated: number; totalMissing: number }
        setBackfillResult(`Generated ${generated} of ${totalMissing} missing barcodes.`)
        toastSuccess('Barcodes Generated', `${generated} product${generated === 1 ? '' : 's'} updated.`)
      } else {
        toastError('Error', res.error?.message ?? 'Could not generate barcodes.')
      }
    } catch {
      toastError('Error', 'Could not generate barcodes.')
    } finally {
      setBackfilling(false)
    }
  }

  const barcodeGenOn = enabledModules.includes('barcode_generation')
  const barcodePrintOn = enabledModules.includes('barcode_printing')

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h3 className="text-base font-semibold text-dark dark:text-slate-100">Barcode & Loose Billing</h3>
        <p className="text-sm text-slate-500 mt-1">Optional features — nothing here changes how Sarang works until you turn it on.</p>
      </div>

      <Card padding="none" className="divide-y divide-slate-100 dark:divide-slate-800">
        {MODULES.map(m => {
          const on = enabledModules.includes(m.key)
          return (
            <div key={m.key} className="flex items-center justify-between px-5 py-4">
              <div className="pr-4">
                <p className="text-sm font-semibold text-dark dark:text-slate-100">{m.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{m.desc}</p>
              </div>
              <button
                onClick={() => toggle(m.key, !on)}
                disabled={saving === m.key}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50',
                  on ? 'bg-brand' : 'bg-slate-200'
                )}
                role="switch" aria-checked={on}
              >
                <span className={cn(
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
                  on ? 'translate-x-5' : 'translate-x-0'
                )} />
              </button>
            </div>
          )
        })}
      </Card>

      {barcodePrintOn && (
        <Card padding="none" className="px-5 py-4">
          <p className="text-sm font-semibold text-dark dark:text-slate-100 mb-1">Thermal Label Size</p>
          <p className="text-xs text-slate-400 mb-3">Set this to match your label printer's sticker size. Doesn't affect A4/sheet printing.</p>
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Width (mm)</label>
              <input type="number" min="10" max="200" value={labelWidth} onChange={e => setLabelWidth(e.target.value)}
                className="w-24 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Height (mm)</label>
              <input type="number" min="10" max="200" value={labelHeight} onChange={e => setLabelHeight(e.target.value)}
                className="w-24 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800" />
            </div>
            <Button size="sm" onClick={saveLabelSize}>Save</Button>
          </div>
        </Card>
      )}

      {barcodeGenOn && (
        <Card padding="none" className="px-5 py-4">
          <p className="text-sm font-semibold text-dark dark:text-slate-100 mb-1">Generate Missing Barcodes</p>
          <p className="text-xs text-slate-400 mb-3">Products added before this feature was turned on may not have a barcode yet. This assigns one to every product that's missing one — safe to run more than once, existing barcodes are never changed.</p>
          <Button size="sm" variant="secondary" onClick={runBackfill} loading={backfilling}>Generate Missing Barcodes</Button>
          {backfillResult && <p className="text-xs text-success mt-2">{backfillResult}</p>}
        </Card>
      )}
    </div>
  )
}

