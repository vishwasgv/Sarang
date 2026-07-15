import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PawPrint, Plus, Search, X, Syringe, Calendar, Archive } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useAuthStore } from '@app/store/auth.store'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { cn } from '@shared/utils/cn'
import { useNotificationStore } from '@app/store/notification.store'

interface CustomerRef { id: string; customerName: string; phone: string | null }
interface VaccinationRef { id: string; vaccineName: string; nextDueDate: string | null }
interface AppointmentRef { id: string; scheduledDate: string; serviceTitle: string; status: string }
interface Pet {
  id: string
  petName: string
  species: string
  breed: string | null
  gender: string | null
  color: string | null
  weight: number | null
  microchipId: string | null
  dateOfBirth: string | null
  isActive: boolean
  customer: CustomerRef | null
  vaccinations: VaccinationRef[]
  appointments: AppointmentRef[]
}

interface UpcomingVac {
  id: string
  vaccineName: string
  nextDueDate: string
  pet: { id: string; petName: string; customer: { customerName: string } | null }
}

const SPECIES = ['All', 'Dog', 'Cat', 'Bird', 'Rabbit', 'Reptile', 'Other']
const SPECIES_EMOJI: Record<string, string> = {
  Dog: '🐶', Cat: '🐱', Bird: '🐦', Rabbit: '🐰', Reptile: '🦎', Other: '🐾',
}

interface PetFormData {
  customerId: string
  petName: string
  species: string
  breed: string
  dateOfBirth: string
  gender: string
  color: string
  weight: string
  microchipId: string
  notes: string
}

const EMPTY_FORM: PetFormData = {
  customerId: '', petName: '', species: 'Dog', breed: '', dateOfBirth: '',
  gender: '', color: '', weight: '', microchipId: '', notes: '',
}

function vaccinationStatus(vaccinations: VaccinationRef[]): { label: string; variant: 'neutral' | 'danger' | 'warning' | 'success' } {
  if (vaccinations.length === 0) return { label: 'No Records', variant: 'neutral' }
  const overdue = vaccinations.some((v) => v.nextDueDate && new Date(v.nextDueDate) < new Date())
  if (overdue) return { label: 'Overdue', variant: 'danger' }
  const dueSoon = vaccinations.some((v) => {
    if (!v.nextDueDate) return false
    const days = (new Date(v.nextDueDate).getTime() - Date.now()) / 86400000
    return days >= 0 && days <= 30
  })
  if (dueSoon) return { label: 'Due Soon', variant: 'warning' }
  return { label: 'Up to Date', variant: 'success' }
}

function petAge(dob: string | null): string {
  if (!dob) return ''
  const months = Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  if (months < 12) return `${months}mo`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem ? `${years}y ${rem}mo` : `${years}y`
}

export function PetListScreen() {
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const { error: toastError } = useNotificationStore()
  const canCreate = hasPermission('billing.createInvoice')

  const [pets, setPets] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [speciesFilter, setSpeciesFilter] = useState('All')
  const [showInactive, setShowInactive] = useState(false)
  const [upcomingVacs, setUpcomingVacs] = useState<UpcomingVac[]>([])
  const [showUpcoming, setShowUpcoming] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<PetFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [customers, setCustomers] = useState<{ id: string; customerName: string }[]>([])

  // Debounce search by 200ms to avoid hammering the API on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const filters: Record<string, unknown> = { isActive: !showInactive }
      if (debouncedSearch.trim()) filters.search = debouncedSearch.trim()
      if (speciesFilter !== 'All') filters.species = speciesFilter
      const res = await api.pets.list(filters)
      if (res.success && res.data) setPets(res.data as Pet[])
      else toastError('Error', res.error?.message ?? 'Could not load pets.')
    } catch {
      toastError('Error', 'Could not load pets.')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, speciesFilter, showInactive, toastError])

  useEffect(() => { load() }, [load])

  // Load upcoming vaccinations once on mount — independent of list filters
  useEffect(() => {
    api.vaccinations.upcoming({ daysAhead: 30 }).then((res) => {
      if (res.success && res.data) {
        setUpcomingVacs((res.data as UpcomingVac[]).slice(0, 6))
      }
    })
  }, [])

  // Load owners for create modal
  useEffect(() => {
    api.customers.list({ limit: 200 }).then((res) => {
      if (res.success && res.data) {
        // customer.service.ts's listCustomers() returns { customers, total,
        // page, limit, pages } — the array key is "customers", not "items".
        // The old fallback (`d.items ?? res.data`) always resolved to the
        // whole response object (never a real array) since `items` never
        // existed, crashing this screen's Owner <select> with
        // "customers.map is not a function" every time the Add Patient
        // modal opened.
        const d = res.data as { customers: { id: string; customerName: string }[] }
        setCustomers(d.customers ?? [])
      }
    })
  }, [])

  async function handleCreate() {
    if (!form.petName.trim()) { setFormError('Pet name is required.'); return }
    setSaving(true)
    setFormError(null)
    const res = await api.pets.create({
      customerId: form.customerId || undefined,
      petName: form.petName.trim(),
      species: form.species,
      breed: form.breed.trim() || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
      gender: form.gender || undefined,
      color: form.color.trim() || undefined,
      weight: form.weight ? parseFloat(form.weight) : undefined,
      microchipId: form.microchipId.trim() || undefined,
      notes: form.notes.trim() || undefined,
    })
    setSaving(false)
    if (res.success && res.data) {
      setShowModal(false)
      setForm(EMPTY_FORM)
      const newPet = res.data as { id: string }
      navigate(`/vet/pets/${newPet.id}`)
    } else {
      setFormError(res.error?.message ?? 'Could not create patient.')
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center">
            <PawPrint size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-dark dark:text-slate-100">Patients</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {showInactive ? `${pets.length} archived patient${pets.length !== 1 ? 's' : ''}` : `${pets.length} active patient${pets.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        {canCreate && !showInactive && (
          <Button size="sm" icon={<Plus size={14} />} onClick={() => { setForm(EMPTY_FORM); setFormError(null); setShowModal(true) }}>
            Add Patient
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-52 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient or owner..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand bg-white dark:bg-slate-900"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-dark dark:hover:text-slate-100"><X size={13} /></button>}
        </div>
        <div className="flex gap-1 flex-wrap">
          {SPECIES.map((s) => (
            <button
              key={s}
              onClick={() => setSpeciesFilter(s)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors', speciesFilter === s ? 'bg-brand text-white border-brand' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand/50')}
            >
              {s !== 'All' ? `${SPECIES_EMOJI[s] ?? '🐾'} ` : ''}{s}
            </button>
          ))}
        </div>
        {/* Active / Archived toggle */}
        <button
          onClick={() => setShowInactive(!showInactive)}
          className={cn('ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors', showInactive ? 'bg-slate-600 text-white border-slate-600' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-400')}
        >
          <Archive size={12} />
          {showInactive ? 'Showing Archived' : 'Archived'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">

        {/* Upcoming Vaccinations panel */}
        {!showInactive && upcomingVacs.length > 0 && showUpcoming && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Syringe size={13} className="text-amber-600" />
                <p className="text-xs font-semibold text-amber-800">Upcoming Vaccinations — next 30 days</p>
              </div>
              <button onClick={() => setShowUpcoming(false)} className="text-amber-400 hover:text-amber-700 transition-colors">
                <X size={13} />
              </button>
            </div>
            <div className="space-y-0.5">
              {upcomingVacs.map((v) => {
                const days = Math.ceil((new Date(v.nextDueDate).getTime() - Date.now()) / 86400000)
                return (
                  <button
                    key={v.id}
                    onClick={() => navigate(`/vet/pets/${v.pet.id}`)}
                    className="w-full flex items-center justify-between text-xs text-amber-900 hover:bg-amber-100 px-2 py-1.5 rounded-lg transition-colors text-left"
                  >
                    <span>
                      <span className="font-semibold">{v.pet.petName}</span>
                      <span className="text-amber-600"> · </span>
                      <span>{v.vaccineName}</span>
                      {v.pet.customer && <span className="text-amber-500"> · {v.pet.customer.customerName}</span>}
                    </span>
                    <span className={cn('font-semibold shrink-0 ml-3', days <= 7 ? 'text-danger' : 'text-amber-700')}>
                      {days === 0 ? 'Today' : days < 0 ? 'Overdue' : `in ${days}d`}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Pet Grid — uses pets directly from API (no redundant client-side filter) */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading patients...</div>
        ) : pets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <PawPrint size={40} className="text-slate-200 mb-3" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {showInactive ? 'No archived patients' : (search || speciesFilter !== 'All') ? 'No patients match your filter' : 'No patients yet'}
            </p>
            {!showInactive && !search && speciesFilter === 'All' && canCreate && (
              <p className="text-xs text-slate-400 mt-1">Click "Add Patient" to register your first patient.</p>
            )}
            {showInactive && (
              <button onClick={() => setShowInactive(false)} className="mt-2 text-xs text-brand hover:underline">Back to active patients</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pets.map((pet) => {
              const vacStatus = vaccinationStatus(pet.vaccinations)
              const lastAppt = pet.appointments[0]
              return (
                <button
                  key={pet.id}
                  onClick={() => navigate(`/vet/pets/${pet.id}`)}
                  className={cn('text-left bg-white dark:bg-slate-900 border rounded-xl p-4 hover:shadow-sm transition-all', pet.isActive ? 'border-slate-200 dark:border-slate-700 hover:border-brand/40' : 'border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-80')}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-brand/10 flex items-center justify-center text-xl shrink-0">
                      {SPECIES_EMOJI[pet.species] ?? '🐾'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-dark dark:text-slate-100 text-sm truncate">{pet.petName}</p>
                        {!pet.isActive && <Badge variant="neutral" size="sm">Archived</Badge>}
                        <Badge variant={vacStatus.variant} size="sm" className="shrink-0">{vacStatus.label}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}{pet.gender ? ` · ${pet.gender}` : ''}
                      </p>
                      {pet.dateOfBirth && <p className="text-xs text-slate-400">{petAge(pet.dateOfBirth)} old</p>}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                    {pet.customer && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <span className="text-slate-300">Owner:</span>
                        <span className="font-medium text-dark dark:text-slate-100 truncate">{pet.customer.customerName}</span>
                      </div>
                    )}
                    {pet.weight && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">Weight: <span className="font-medium">{pet.weight} kg</span></p>
                    )}
                    {lastAppt && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Calendar size={11} />
                        <span>Last: {new Date(lastAppt.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Syringe size={11} />
                      <span>{pet.vaccinations.length} vaccination record{pet.vaccinations.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Patient Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-semibold text-dark dark:text-slate-100">Add New Patient</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-dark dark:hover:text-slate-100"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {formError && <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">{formError}</p>}

              <div className="grid grid-cols-2 gap-3">
                <Input label="Pet Name *" value={form.petName} onChange={(e) => setForm((f) => ({ ...f, petName: e.target.value }))} placeholder="e.g. Buddy" />
                <Select label="Species *" value={form.species} onChange={(e) => setForm((f) => ({ ...f, species: e.target.value }))}>
                  {['Dog', 'Cat', 'Bird', 'Rabbit', 'Reptile', 'Other'].map((s) => <option key={s}>{s}</option>)}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input label="Breed" value={form.breed} onChange={(e) => setForm((f) => ({ ...f, breed: e.target.value }))} placeholder="e.g. Labrador" />
                <Select label="Gender" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
                  <option value="">Unknown</option>
                  <option>Male</option>
                  <option>Female</option>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} />
                <Input label="Weight (kg)" type="number" value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} placeholder="e.g. 12.5" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input label="Color / Markings" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} placeholder="e.g. Golden" />
                <Input label="Microchip ID" value={form.microchipId} onChange={(e) => setForm((f) => ({ ...f, microchipId: e.target.value }))} placeholder="15-digit ID" />
              </div>

              <Select label="Owner (optional)" value={form.customerId} onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}>
                <option value="">— Not linked / Walk-in —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.customerName}</option>)}
              </Select>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Allergies, chronic conditions, etc." className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-dark dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button size="sm" loading={saving} onClick={handleCreate}>Register Patient</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
