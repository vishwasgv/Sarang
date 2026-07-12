import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Syringe, Plus, Trash2, Edit2, Printer, Send, Scale, X, AlertCircle, Edit } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useAuthStore } from '@app/store/auth.store'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { cn } from '@shared/utils/cn'
import { VaccinationCertificate } from './VaccinationCertificate'
import { useNotificationStore } from '@app/store/notification.store'

interface CustomerRef { id: string; customerName: string; phone: string | null; email: string | null }
interface WeightEntry { id: string; weightKg: number; recordedAt: string; notes: string | null }
interface VaccinationRecord {
  id: string
  vaccineName: string
  vaccineType: string | null
  batchNumber: string | null
  manufacturer: string | null
  administeredAt: string
  administeredBy: string | null
  nextDueDate: string | null
  notes: string | null
  certificatePrinted: boolean
}
interface AppointmentRef {
  id: string
  scheduledDate: string
  scheduledTime: string
  serviceTitle: string
  status: string
  provider?: { fullName: string } | null
}
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
  notes: string | null
  customer: CustomerRef | null
  weightHistory: WeightEntry[]
  vaccinations: VaccinationRecord[]
  appointments: AppointmentRef[]
}

interface PetEditFormData {
  petName: string
  species: string
  breed: string
  gender: string
  dateOfBirth: string
  color: string
  microchipId: string
  customerId: string
  notes: string
  weight: string
}

type Tab = 'overview' | 'vaccinations' | 'appointments'

const SPECIES_EMOJI: Record<string, string> = { Dog: '🐶', Cat: '🐱', Bird: '🐦', Rabbit: '🐰', Reptile: '🦎', Other: '🐾' }

// Verified exhaustive against the Appointment.status literal union in
// src/main/services/appointment.service.ts ('SCHEDULED' | 'CONFIRMED' |
// 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW') and the matching
// schema.prisma comment on Appointment.status.
const STATUS_VARIANT: Record<string, 'info' | 'brand' | 'warning' | 'success' | 'neutral' | 'danger'> = {
  SCHEDULED: 'info',
  CONFIRMED: 'brand',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
  NO_SHOW: 'danger',
}

const BRAND = '#00AEEF'

function petAge(dob: string | null): string {
  if (!dob) return 'Age unknown'
  const months = Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} old`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem
    ? `${years} year${years !== 1 ? 's' : ''} ${rem} month${rem !== 1 ? 's' : ''} old`
    : `${years} year${years !== 1 ? 's' : ''} old`
}

function vaccineStatus(record: VaccinationRecord): { label: string; variant: 'neutral' | 'danger' | 'warning' | 'success' } {
  if (!record.nextDueDate) return { label: 'No follow-up', variant: 'neutral' }
  const daysLeft = (new Date(record.nextDueDate).getTime() - Date.now()) / 86400000
  if (daysLeft < 0) return { label: 'Overdue', variant: 'danger' }
  if (daysLeft <= 30) return { label: `Due in ${Math.ceil(daysLeft)}d`, variant: 'warning' }
  return {
    label: `Due ${new Date(record.nextDueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    variant: 'success',
  }
}

function WeightChart({ data }: { data: WeightEntry[] }) {
  if (data.length < 2) return (
    <p className="text-xs text-slate-400 text-center py-3">Add at least 2 entries to see the weight trend chart.</p>
  )

  const W = 560, H = 100
  const PL = 44, PR = 16, PT = 12, PB = 28
  const iW = W - PL - PR
  const iH = H - PT - PB

  const weights = data.map((d) => d.weightKg)
  const times = data.map((d) => new Date(d.recordedAt).getTime())
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const minT = Math.min(...times)
  const wRange = maxW - minW || 1
  const tRange = Math.max(...times) - minT || 1

  const cx = (d: WeightEntry) => PL + ((new Date(d.recordedAt).getTime() - minT) / tRange) * iW
  const cy = (d: WeightEntry) => PT + iH - ((d.weightKg - minW) / wRange) * iH

  const linePoints = data.map((d) => `${cx(d).toFixed(1)},${cy(d).toFixed(1)}`).join(' ')
  const areaPoints = [
    `${PL},${PT + iH}`,
    ...data.map((d) => `${cx(d).toFixed(1)},${cy(d).toFixed(1)}`),
    `${cx(data[data.length - 1]).toFixed(1)},${PT + iH}`,
  ].join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }}>
      <text x={PL - 4} y={PT + 4} textAnchor="end" fontSize={9} fill="#94a3b8">{maxW.toFixed(1)}</text>
      <text x={PL - 4} y={PT + iH + 4} textAnchor="end" fontSize={9} fill="#94a3b8">{minW.toFixed(1)}</text>
      <text x={PL - 4} y={PT + iH / 2 + 4} textAnchor="end" fontSize={9} fill="#94a3b8">kg</text>
      <line x1={PL} y1={PT} x2={PL + iW} y2={PT} stroke="#f1f5f9" strokeWidth={1} />
      <line x1={PL} y1={PT + iH} x2={PL + iW} y2={PT + iH} stroke="#e2e8f0" strokeWidth={1} />
      <polygon points={areaPoints} fill={BRAND} fillOpacity={0.08} />
      <polyline points={linePoints} fill="none" stroke={BRAND} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={i} cx={cx(d)} cy={cy(d)} r={3.5} fill={BRAND}>
          <title>{`${d.weightKg} kg · ${new Date(d.recordedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}</title>
        </circle>
      ))}
      <text x={PL} y={H - 4} textAnchor="start" fontSize={9} fill="#94a3b8">
        {new Date(data[0].recordedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
      </text>
      <text x={PL + iW} y={H - 4} textAnchor="end" fontSize={9} fill="#94a3b8">
        {new Date(data[data.length - 1].recordedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
      </text>
    </svg>
  )
}

interface VaccinationFormData {
  vaccineName: string
  vaccineType: string
  batchNumber: string
  manufacturer: string
  administeredAt: string
  administeredBy: string
  nextDueDate: string
  notes: string
}

const EMPTY_VAC_FORM: VaccinationFormData = {
  vaccineName: '', vaccineType: '', batchNumber: '', manufacturer: '',
  administeredAt: new Date().toISOString().slice(0, 10), administeredBy: '', nextDueDate: '', notes: '',
}

export function PetProfileScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const { error: toastError } = useNotificationStore()
  const canEdit = hasPermission('billing.createInvoice')

  const [pet, setPet] = useState<Pet | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [printRecord, setPrintRecord] = useState<VaccinationRecord | null>(null)

  // Owner list for edit modal
  const [customers, setCustomers] = useState<{ id: string; customerName: string }[]>([])

  // Edit patient
  const [showEditPet, setShowEditPet] = useState(false)
  const [editPetForm, setEditPetForm] = useState<PetEditFormData | null>(null)
  const [savingEditPet, setSavingEditPet] = useState(false)
  const [editPetError, setEditPetError] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [archiving, setArchiving] = useState(false)

  // Weight entry
  const [showWeightForm, setShowWeightForm] = useState(false)
  const [weightInput, setWeightInput] = useState('')
  const [weightNotes, setWeightNotes] = useState('')
  const [savingWeight, setSavingWeight] = useState(false)
  const [weightError, setWeightError] = useState<string | null>(null)

  // Vaccination CRUD
  const [showVacForm, setShowVacForm] = useState(false)
  const [editVacId, setEditVacId] = useState<string | null>(null)
  const [vacForm, setVacForm] = useState<VaccinationFormData>(EMPTY_VAC_FORM)
  const [savingVac, setSavingVac] = useState(false)
  const [vacError, setVacError] = useState<string | null>(null)
  const [confirmDeleteVacId, setConfirmDeleteVacId] = useState<string | null>(null)
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null)
  const [reminderSentId, setReminderSentId] = useState<string | null>(null)
  const [reminderNoPhoneId, setReminderNoPhoneId] = useState<string | null>(null)
  const [reminderFailId, setReminderFailId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await api.pets.get({ id })
      if (res.success && res.data) setPet(res.data as Pet)
      else toastError('Error', res.error?.message ?? 'Could not load pet profile.')
    } catch {
      toastError('Error', 'Could not load pet profile.')
    } finally {
      setLoading(false)
    }
  }, [id, toastError])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.customers.list({ limit: 200 }).then((res) => {
      if (res.success && res.data) {
        const d = res.data as { items: { id: string; customerName: string }[] }
        setCustomers(d.items ?? (res.data as { id: string; customerName: string }[]))
      }
    })
  }, [])

  // ── Edit Pet ──────────────────────────────────────────────────────────────

  function openEditPet() {
    if (!pet) return
    setEditPetForm({
      petName: pet.petName,
      species: pet.species,
      breed: pet.breed ?? '',
      gender: pet.gender ?? '',
      dateOfBirth: pet.dateOfBirth ? pet.dateOfBirth.slice(0, 10) : '',
      color: pet.color ?? '',
      microchipId: pet.microchipId ?? '',
      customerId: pet.customer?.id ?? '',
      notes: pet.notes ?? '',
      weight: pet.weight != null ? String(pet.weight) : '',
    })
    setEditPetError(null)
    setConfirmArchive(false)
    setShowEditPet(true)
  }

  async function handleSaveEditPet() {
    if (!id || !editPetForm) return
    if (!editPetForm.petName.trim()) { setEditPetError('Pet name is required.'); return }
    setSavingEditPet(true)
    setEditPetError(null)
    const res = await api.pets.update({
      id,
      petName: editPetForm.petName.trim(),
      species: editPetForm.species,
      breed: editPetForm.breed.trim() || null,
      gender: editPetForm.gender || null,
      dateOfBirth: editPetForm.dateOfBirth || null,
      color: editPetForm.color.trim() || null,
      microchipId: editPetForm.microchipId.trim() || null,
      customerId: editPetForm.customerId || null,
      notes: editPetForm.notes.trim() || null,
      weight: editPetForm.weight ? parseFloat(editPetForm.weight) : null,
    })
    setSavingEditPet(false)
    if (!res.success) { setEditPetError(res.error?.message ?? 'Could not update patient.'); return }
    setShowEditPet(false)
    load()
  }

  async function handleArchivePet() {
    if (!id) return
    setArchiving(true)
    const res = await api.pets.update({ id, isActive: false })
    setArchiving(false)
    if (!res.success) { setEditPetError(res.error?.message ?? 'Could not archive patient.'); return }
    setShowEditPet(false)
    navigate('/vet/pets')
  }

  async function handleRestorePet() {
    if (!id) return
    setArchiving(true)
    const res = await api.pets.update({ id, isActive: true })
    setArchiving(false)
    if (!res.success) { setEditPetError(res.error?.message ?? 'Could not restore patient.'); return }
    setShowEditPet(false)
    load()
  }

  // ── Weight Entry ──────────────────────────────────────────────────────────

  async function handleAddWeight() {
    if (!id || !weightInput) return
    setSavingWeight(true)
    setWeightError(null)
    const res = await api.pets.addWeight({ petId: id, weightKg: parseFloat(weightInput), notes: weightNotes || undefined })
    setSavingWeight(false)
    if (!res.success) {
      setWeightError(res.error?.message ?? 'Could not save weight entry.')
      return
    }
    setWeightInput('')
    setWeightNotes('')
    setShowWeightForm(false)
    load()
  }

  // ── Vaccination CRUD ──────────────────────────────────────────────────────

  function openNewVac() {
    setVacForm({ ...EMPTY_VAC_FORM, administeredAt: new Date().toISOString().slice(0, 10) })
    setEditVacId(null)
    setVacError(null)
    setShowVacForm(true)
  }

  function openEditVac(v: VaccinationRecord) {
    setVacForm({
      vaccineName: v.vaccineName,
      vaccineType: v.vaccineType ?? '',
      batchNumber: v.batchNumber ?? '',
      manufacturer: v.manufacturer ?? '',
      administeredAt: v.administeredAt.slice(0, 10),
      administeredBy: v.administeredBy ?? '',
      nextDueDate: v.nextDueDate ? v.nextDueDate.slice(0, 10) : '',
      notes: v.notes ?? '',
    })
    setEditVacId(v.id)
    setVacError(null)
    setShowVacForm(true)
  }

  async function handleSaveVac() {
    if (!id || !vacForm.vaccineName.trim()) { setVacError('Vaccine name is required.'); return }
    setSavingVac(true)
    setVacError(null)
    if (editVacId) {
      const res = await api.vaccinations.update({
        id: editVacId,
        vaccineName: vacForm.vaccineName.trim(),
        vaccineType: vacForm.vaccineType || null,
        batchNumber: vacForm.batchNumber || null,
        manufacturer: vacForm.manufacturer || null,
        administeredAt: vacForm.administeredAt,
        administeredBy: vacForm.administeredBy || null,
        nextDueDate: vacForm.nextDueDate || null,
        notes: vacForm.notes || null,
      })
      if (!res.success) { setVacError(res.error?.message ?? 'Could not update record.'); setSavingVac(false); return }
    } else {
      const res = await api.vaccinations.create({
        petId: id,
        vaccineName: vacForm.vaccineName.trim(),
        vaccineType: vacForm.vaccineType || undefined,
        batchNumber: vacForm.batchNumber || undefined,
        manufacturer: vacForm.manufacturer || undefined,
        administeredAt: vacForm.administeredAt,
        administeredBy: vacForm.administeredBy || undefined,
        nextDueDate: vacForm.nextDueDate || undefined,
        notes: vacForm.notes || undefined,
      })
      if (!res.success) { setVacError(res.error?.message ?? 'Could not save record.'); setSavingVac(false); return }
    }
    setSavingVac(false)
    setShowVacForm(false)
    load()
  }

  async function handleDeleteVac(vacId: string) {
    setConfirmDeleteVacId(null)
    const res = await api.vaccinations.delete({ id: vacId })
    if (!res.success) { setVacError(res.error?.message ?? 'Could not delete record.'); return }
    load()
  }

  async function handleSendReminder(vacId: string) {
    setSendingReminderId(vacId)
    setReminderFailId(null)
    const res = await api.vaccinations.createReminder({ vaccinationRecordId: vacId })
    setSendingReminderId(null)
    if (res.success && res.data !== null && res.data !== undefined) {
      setReminderSentId(vacId)
      setTimeout(() => setReminderSentId(null), 2500)
    } else if (res.success && (res.data === null || res.data === undefined)) {
      // Owner has no phone — reminder skipped
      setReminderNoPhoneId(vacId)
      setTimeout(() => setReminderNoPhoneId(null), 2500)
    } else {
      // IPC / service error — show failure flash
      setReminderFailId(vacId)
      setTimeout(() => setReminderFailId(null), 3000)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading patient...</div>
  )
  if (!pet) return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-3">
      <AlertCircle size={32} className="text-slate-300" />
      <p className="text-sm text-slate-500 dark:text-slate-400">Patient not found.</p>
      <Button size="sm" variant="ghost" onClick={() => navigate('/vet/pets')}>Back to Patients</Button>
    </div>
  )

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'vaccinations', label: `Vaccinations (${pet.vaccinations.length})` },
    { key: 'appointments', label: `Appointments (${pet.appointments.length})` },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Print overlay — onClose calls load() so "Cert Issued" badge appears immediately */}
      {printRecord && (
        <VaccinationCertificate
          record={printRecord}
          pet={pet}
          onClose={() => { setPrintRecord(null); load() }}
        />
      )}

      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center gap-4 shrink-0">
        <button onClick={() => navigate('/vet/pets')} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-xl shrink-0">
          {SPECIES_EMOJI[pet.species] ?? '🐾'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-dark dark:text-slate-100 truncate">{pet.petName}</h1>
            {!pet.isActive && <Badge variant="neutral" size="sm">Archived</Badge>}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{pet.species}{pet.breed ? ` · ${pet.breed}` : ''} {pet.dateOfBirth ? `· ${petAge(pet.dateOfBirth)}` : ''}</p>
        </div>
        {canEdit && (
          <button
            onClick={openEditPet}
            title="Edit patient details"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-brand/50 hover:text-brand transition-colors shrink-0"
          >
            <Edit size={13} />
            Edit
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="px-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex gap-1 shrink-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn('px-4 py-3 text-xs font-medium border-b-2 transition-colors -mb-px', tab === t.key ? 'border-brand text-brand' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-dark dark:hover:text-slate-100')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

        {/* === OVERVIEW TAB === */}
        {tab === 'overview' && (
          <>
            {/* Pet details grid */}
            <Card padding="md" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Species', value: pet.species },
                { label: 'Breed', value: pet.breed ?? '—' },
                { label: 'Gender', value: pet.gender ?? '—' },
                { label: 'Date of Birth', value: pet.dateOfBirth ? new Date(pet.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
                { label: 'Color / Markings', value: pet.color ?? '—' },
                { label: 'Microchip ID', value: pet.microchipId ?? '—' },
              ].map((row) => (
                <div key={row.label}>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{row.label}</p>
                  <p className="text-sm font-medium text-dark dark:text-slate-100 mt-0.5">{row.value}</p>
                </div>
              ))}
            </Card>

            {/* Owner */}
            {pet.customer && (
              <Card padding="md">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-2">Owner</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center text-sm font-semibold text-brand">
                    {pet.customer.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-dark dark:text-slate-100">{pet.customer.customerName}</p>
                    {pet.customer.phone && <p className="text-xs text-slate-500 dark:text-slate-400">{pet.customer.phone}</p>}
                    {pet.customer.email && <p className="text-xs text-slate-400">{pet.customer.email}</p>}
                  </div>
                </div>
              </Card>
            )}

            {/* Notes */}
            {pet.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-[10px] font-medium text-amber-600 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-amber-900">{pet.notes}</p>
              </div>
            )}

            {/* Weight History */}
            <Card padding="none">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Scale size={15} className="text-brand" />
                  <p className="text-sm font-semibold text-dark dark:text-slate-100">Weight History</p>
                  {pet.weight != null && (
                    <span className="text-xs font-medium text-brand bg-brand/10 px-2 py-0.5 rounded-full">{pet.weight} kg</span>
                  )}
                </div>
                {canEdit && (
                  <button
                    onClick={() => { setShowWeightForm(!showWeightForm); setWeightError(null) }}
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    {showWeightForm ? 'Cancel' : '+ Add Entry'}
                  </button>
                )}
              </div>

              {showWeightForm && (
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-end gap-2">
                    <div className="w-32">
                      <Input label="Weight (kg)" type="number" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} placeholder="e.g. 13.2" />
                    </div>
                    <div className="flex-1">
                      <Input label="Notes (optional)" value={weightNotes} onChange={(e) => setWeightNotes(e.target.value)} placeholder="e.g. Pre-surgery weigh-in" />
                    </div>
                    <Button size="sm" loading={savingWeight} onClick={handleAddWeight}>Save</Button>
                  </div>
                  {weightError && <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">{weightError}</p>}
                </div>
              )}

              {pet.weightHistory.length >= 2 && (
                <div className="px-4 pt-3 pb-1 border-b border-slate-100 dark:border-slate-800">
                  <WeightChart data={pet.weightHistory} />
                </div>
              )}

              {pet.weightHistory.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No weight entries recorded.</p>
              ) : pet.weightHistory.length === 1 ? (
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-dark dark:text-slate-100">{pet.weightHistory[0].weightKg} kg</span>
                    {pet.weightHistory[0].notes && <span className="text-xs text-slate-500 dark:text-slate-400">{pet.weightHistory[0].notes}</span>}
                  </div>
                  <span className="text-xs text-slate-400">{new Date(pet.weightHistory[0].recordedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {[...pet.weightHistory].reverse().map((w) => (
                    <div key={w.id} className="px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-dark dark:text-slate-100">{w.weightKg} kg</span>
                        {w.notes && <span className="text-xs text-slate-500 dark:text-slate-400">{w.notes}</span>}
                      </div>
                      <span className="text-xs text-slate-400">{new Date(w.recordedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {/* === VACCINATIONS TAB === */}
        {tab === 'vaccinations' && (
          <Card padding="none">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Syringe size={15} className="text-brand" />
                <p className="text-sm font-semibold text-dark dark:text-slate-100">Vaccination Records</p>
              </div>
              {canEdit && (
                <Button size="sm" icon={<Plus size={13} />} onClick={openNewVac}>Add Record</Button>
              )}
            </div>

            {vacError && !showVacForm && (
              <p className="text-xs text-danger bg-danger/5 border-b border-danger/20 px-4 py-2">{vacError}</p>
            )}

            {pet.vaccinations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Syringe size={32} className="text-slate-200 mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400">No vaccination records yet.</p>
                {canEdit && <p className="text-xs text-slate-400 mt-1">Click "Add Record" to log the first vaccination.</p>}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pet.vaccinations.map((v) => {
                  const vs = vaccineStatus(v)
                  return (
                    <div key={v.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-dark dark:text-slate-100 text-sm">{v.vaccineName}</p>
                            {v.vaccineType && <Badge variant="neutral" size="sm">{v.vaccineType}</Badge>}
                            <Badge variant={vs.variant} size="sm">{vs.label}</Badge>
                            {v.certificatePrinted && <Badge variant="brand" size="sm">Cert Issued</Badge>}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Administered: {new Date(v.administeredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                            {v.administeredBy ? ` · ${v.administeredBy}` : ''}
                          </p>
                          {(v.batchNumber || v.manufacturer) && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {v.batchNumber ? `Batch: ${v.batchNumber}` : ''}
                              {v.batchNumber && v.manufacturer ? ' · ' : ''}
                              {v.manufacturer ?? ''}
                            </p>
                          )}
                          {v.notes && <p className="text-xs text-slate-400 mt-0.5 italic">{v.notes}</p>}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {v.nextDueDate && canEdit && (
                            confirmDeleteVacId === v.id ? null : (
                              reminderSentId === v.id ? (
                                <span className="text-xs text-success font-medium">Queued!</span>
                              ) : reminderNoPhoneId === v.id ? (
                                <span className="text-xs text-warning font-medium">No phone</span>
                              ) : reminderFailId === v.id ? (
                                <span className="text-xs text-danger font-medium">Failed</span>
                              ) : (
                                <button
                                  onClick={() => handleSendReminder(v.id)}
                                  disabled={sendingReminderId === v.id}
                                  title="Queue WhatsApp reminder"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-brand hover:bg-brand/5 transition-colors"
                                >
                                  <Send size={13} />
                                </button>
                              )
                            )
                          )}
                          <button
                            onClick={() => setPrintRecord(v)}
                            title="Print certificate"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand hover:bg-brand/5 transition-colors"
                          >
                            <Printer size={13} />
                          </button>
                          {canEdit && (
                            <>
                              <button onClick={() => openEditVac(v)} className="p-1.5 rounded-lg text-slate-400 hover:text-brand hover:bg-brand/5 transition-colors"><Edit2 size={13} /></button>
                              {confirmDeleteVacId === v.id ? (
                                <div className="flex items-center gap-1 ml-1">
                                  <span className="text-xs text-danger font-medium">Delete?</span>
                                  <button onClick={() => handleDeleteVac(v.id)} className="px-2 py-0.5 text-xs bg-danger text-white rounded-lg">Yes</button>
                                  <button onClick={() => setConfirmDeleteVacId(null)} className="px-2 py-0.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300">No</button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmDeleteVacId(v.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/5 transition-colors"><Trash2 size={13} /></button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )}

        {/* === APPOINTMENTS TAB === */}
        {tab === 'appointments' && (
          <Card padding="none">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <p className="text-sm font-semibold text-dark dark:text-slate-100">Appointment History</p>
            </div>
            {pet.appointments.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No appointments linked to this patient.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {pet.appointments.map((a) => (
                  <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-dark dark:text-slate-100">{a.serviceTitle}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {new Date(a.scheduledDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        {a.scheduledTime ? ` · ${a.scheduledTime}` : ''}
                        {a.provider?.fullName ? ` · ${a.provider.fullName}` : ''}
                      </p>
                    </div>
                    <Badge variant={STATUS_VARIANT[a.status] ?? 'neutral'} size="sm" className="shrink-0">
                      {a.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* ── Edit Patient Modal ─────────────────────────────────────────────── */}
      {showEditPet && editPetForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowEditPet(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-semibold text-dark dark:text-slate-100">Edit Patient — {pet.petName}</h2>
              <button onClick={() => setShowEditPet(false)} className="text-slate-400 hover:text-dark dark:hover:text-slate-100"><X size={18} /></button>
            </div>

            <div className="px-6 py-4 space-y-3">
              {editPetError && <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">{editPetError}</p>}

              <div className="grid grid-cols-2 gap-3">
                <Input label="Pet Name *" value={editPetForm.petName} onChange={(e) => setEditPetForm((f) => f ? { ...f, petName: e.target.value } : f)} placeholder="e.g. Buddy" />
                <Select label="Species *" value={editPetForm.species} onChange={(e) => setEditPetForm((f) => f ? { ...f, species: e.target.value } : f)}>
                  {['Dog', 'Cat', 'Bird', 'Rabbit', 'Reptile', 'Other'].map((s) => <option key={s}>{s}</option>)}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input label="Breed" value={editPetForm.breed} onChange={(e) => setEditPetForm((f) => f ? { ...f, breed: e.target.value } : f)} placeholder="e.g. Labrador" />
                <Select label="Gender" value={editPetForm.gender} onChange={(e) => setEditPetForm((f) => f ? { ...f, gender: e.target.value } : f)}>
                  <option value="">Unknown</option>
                  <option>Male</option>
                  <option>Female</option>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input label="Date of Birth" type="date" value={editPetForm.dateOfBirth} onChange={(e) => setEditPetForm((f) => f ? { ...f, dateOfBirth: e.target.value } : f)} />
                <Input label="Weight (kg)" type="number" value={editPetForm.weight} onChange={(e) => setEditPetForm((f) => f ? { ...f, weight: e.target.value } : f)} placeholder="e.g. 12.5" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input label="Color / Markings" value={editPetForm.color} onChange={(e) => setEditPetForm((f) => f ? { ...f, color: e.target.value } : f)} placeholder="e.g. Golden" />
                <Input label="Microchip ID" value={editPetForm.microchipId} onChange={(e) => setEditPetForm((f) => f ? { ...f, microchipId: e.target.value } : f)} placeholder="15-digit ID" />
              </div>

              <Select label="Owner" value={editPetForm.customerId} onChange={(e) => setEditPetForm((f) => f ? { ...f, customerId: e.target.value } : f)}>
                <option value="">— Not linked / Walk-in —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.customerName}</option>)}
              </Select>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Notes</label>
                <textarea value={editPetForm.notes} onChange={(e) => setEditPetForm((f) => f ? { ...f, notes: e.target.value } : f)} rows={2} placeholder="Allergies, chronic conditions, etc." className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-dark dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
              </div>

              {/* Danger zone */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 mt-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Danger Zone</p>
                {pet.isActive ? (
                  confirmArchive ? (
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-slate-600 dark:text-slate-300 flex-1">Archive this patient? They will be hidden from the active list.</p>
                      <button onClick={handleArchivePet} disabled={archiving} className="px-3 py-1.5 text-xs font-medium bg-danger text-white rounded-lg disabled:opacity-50">
                        {archiving ? 'Archiving...' : 'Confirm'}
                      </button>
                      <button onClick={() => setConfirmArchive(false)} className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmArchive(true)} className="text-xs font-medium text-danger border border-danger/30 px-3 py-1.5 rounded-lg hover:bg-danger/5 transition-colors">
                      Archive Patient
                    </button>
                  )
                ) : (
                  <button onClick={handleRestorePet} disabled={archiving} className="text-xs font-medium text-success border border-success/30 px-3 py-1.5 rounded-lg hover:bg-success/5 transition-colors disabled:opacity-50">
                    {archiving ? 'Restoring...' : 'Restore Patient'}
                  </button>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowEditPet(false)}>Cancel</Button>
              <Button size="sm" loading={savingEditPet} onClick={handleSaveEditPet}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Vaccination Form Modal ─────────────────────────────────────────── */}
      {showVacForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowVacForm(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-semibold text-dark dark:text-slate-100">{editVacId ? 'Edit Vaccination Record' : 'Add Vaccination Record'}</h2>
              <button onClick={() => setShowVacForm(false)} className="text-slate-400 hover:text-dark dark:hover:text-slate-100"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {vacError && <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">{vacError}</p>}

              <div className="grid grid-cols-2 gap-3">
                <Input label="Vaccine Name *" value={vacForm.vaccineName} onChange={(e) => setVacForm((f) => ({ ...f, vaccineName: e.target.value }))} placeholder="e.g. Rabies" />
                <Select label="Type" value={vacForm.vaccineType} onChange={(e) => setVacForm((f) => ({ ...f, vaccineType: e.target.value }))}>
                  <option value="">—</option>
                  <option>Core</option>
                  <option>Non-core</option>
                  <option>Optional</option>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input label="Administered On *" type="date" value={vacForm.administeredAt} onChange={(e) => setVacForm((f) => ({ ...f, administeredAt: e.target.value }))} />
                <Input label="Next Due Date" type="date" value={vacForm.nextDueDate} onChange={(e) => setVacForm((f) => ({ ...f, nextDueDate: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input label="Batch Number" value={vacForm.batchNumber} onChange={(e) => setVacForm((f) => ({ ...f, batchNumber: e.target.value }))} placeholder="e.g. BT20240101" />
                <Input label="Manufacturer" value={vacForm.manufacturer} onChange={(e) => setVacForm((f) => ({ ...f, manufacturer: e.target.value }))} placeholder="e.g. Zoetis" />
              </div>

              <Input label="Administered By (Vet)" value={vacForm.administeredBy} onChange={(e) => setVacForm((f) => ({ ...f, administeredBy: e.target.value }))} placeholder="Vet name" />

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Notes</label>
                <textarea value={vacForm.notes} onChange={(e) => setVacForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Reactions, dosage notes, etc." className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-dark dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowVacForm(false)}>Cancel</Button>
              <Button size="sm" loading={savingVac} onClick={handleSaveVac}>{editVacId ? 'Update' : 'Save Record'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
