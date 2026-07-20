import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Lock, Printer, CheckCircle2, AlertTriangle, Plus, Trash2, Mail } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { useIndustryStore } from '@app/store/industry.store'
import { Button } from '@shared/ui/atoms/Button'
import { Badge } from '@shared/ui/atoms/Badge'
import { cn } from '@shared/utils/cn'
import { AszurexMark } from '@shared/ui/atoms/Brand'
import { DocumentWatermark, documentLogoUrl } from '@shared/ui/molecules/DocumentWatermark'
import { DocumentPanel } from '@modules/documents/ui/DocumentPanel'

interface Appointment {
  id: string
  appointmentNumber: string
  scheduledDate: string
  scheduledTime: string
  serviceTitle: string
  customerName: string | null
  customer: { id: string; customerName: string; phone: string | null } | null
  provider: { id: string; fullName: string; specialization: string | null } | null
  // Phase 58 §2 — Vet Clinic: the PATIENT for a vet visit is the pet, not
  // the customer (who is the owner) — null for every non-vet appointment.
  pet: { id: string; petName: string; species: string; breed: string | null; dateOfBirth: string | null; gender: string | null } | null
}

// Phase 58 §2 — "6 years" / "8 months" from a pet's dateOfBirth, matching
// the free-text style patientAge already uses for human patients ("35
// years", "6 months") rather than introducing a second age representation.
function petAgeFromDob(dob: string | null): string {
  if (!dob) return ''
  const months = Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 30.4375))
  if (months < 1) return 'Under 1 month'
  if (months < 24) return `${months} month${months === 1 ? '' : 's'}`
  return `${Math.floor(months / 12)} years`
}

interface VisitNote {
  id: string
  appointmentId: string
  patientName: string
  patientAge: string | null
  chiefComplaint: string | null
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  followUpDate: string | null
  followUpNotes: string | null
  referredBy: string | null
  referralDate: string | null
  referralReason: string | null
  treatmentDone: string | null
  painScore: number | null
  functionalScore: number | null
  treatmentGiven: string | null
  bpSystolic: number | null
  bpDiastolic: number | null
  pulseRate: number | null
  temperatureF: number | null
  heightCm: number | null
  weightKg: number | null
  vitalsFlags: string | null
  isFinalized: boolean
  finalizedAt: string | null
  createdAt: string
  appointment: Appointment | null
}

interface ReferralAppointment {
  id: string
  appointmentNumber: string
  scheduledDate: string
  scheduledTime: string
  status: string
  serviceTitle: string
  notes: string | null
  provider: { id: string; fullName: string; specialization: string | null } | null
}

// Phase 58 §2 — GP/Specialist Clinic: structured prescription line
interface PrescriptionItem {
  id: string
  drugName: string
  dosage: string | null
  frequency: string | null
  duration: string | null
  instructions: string | null
}

interface VitalsTrendPoint {
  date: string
  bpSystolic: number | null
  bpDiastolic: number | null
  pulseRate: number | null
  temperatureF: number | null
  weightKg: number | null
  // Phase 58 §2 — Physio Clinic: outcome measures, trended the same way as vitals.
  painScore: number | null
  functionalScore: number | null
}

interface FormData {
  patientName: string
  patientAge: string
  chiefComplaint: string
  subjective: string
  objective: string
  assessment: string
  plan: string
  followUpDate: string
  followUpNotes: string
  referredBy: string
  referralDate: string
  referralReason: string
  treatmentDone: string
  painScore: string
  functionalScore: string
  treatmentGiven: string
  bpSystolic: string
  bpDiastolic: string
  pulseRate: string
  temperatureF: string
  heightCm: string
  weightKg: string
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function VisitNoteScreen() {
  const { appointmentId } = useParams<{ appointmentId: string }>()
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const profile = useBusinessStore((s) => s.profile)
  const isSpecialist = useIndustryStore((s) => s.isModuleEnabled('specialist_referral'))
  const isDental = useIndustryStore((s) => s.isModuleEnabled('dental_chart'))
  const isPhysio = useIndustryStore((s) => s.isModuleEnabled('physio_notes'))
  // Phase 58 §2 — Vet Clinic
  const isVet = useIndustryStore((s) => s.isModuleEnabled('vet_patients'))
  const [apptPet, setApptPet] = useState<Appointment['pet']>(null)
  const [apptOwnerName, setApptOwnerName] = useState('')
  const canWrite = hasPermission('clinicalNotes.write')

  const [note, setNote] = useState<VisitNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [showPrint, setShowPrint] = useState(false)

  // Real in-app referral routing (F.11) — separate from the referredBy/
  // referralReason fields above, which record an INBOUND referral from an
  // outside doctor. This is the OUTBOUND case: sending the patient on to
  // another provider in this same clinic, as a real booked appointment.
  const [providers, setProviders] = useState<Array<{ id: string; fullName: string; specialization: string | null }>>([])
  const [referrals, setReferrals] = useState<ReferralAppointment[]>([])
  const [showReferralForm, setShowReferralForm] = useState(false)
  const [referring, setReferring] = useState(false)
  const [referralError, setReferralError] = useState<string | null>(null)
  const [referralForm, setReferralForm] = useState({ providerId: '', scheduledDate: '', scheduledTime: '', reason: '' })
  const [printReferral, setPrintReferral] = useState<ReferralAppointment | null>(null)

  // Phase 58 §2 — GP/Specialist Clinic: structured prescription, distinct
  // from the free-text `plan` field — one row per drug so it can print as a
  // real itemized prescription.
  const [rxItems, setRxItems] = useState<PrescriptionItem[]>([])
  const [rxSaving, setRxSaving] = useState(false)
  const [rxDirty, setRxDirty] = useState(false)
  const [showPrintRx, setShowPrintRx] = useState(false)

  // Vitals trend across this patient's prior visits (reuses the pet-weight
  // chart pattern from PetProfileScreen.tsx).
  const [vitalsTrend, setVitalsTrend] = useState<VitalsTrendPoint[]>([])

  const [form, setForm] = useState<FormData>({
    patientName: '',
    patientAge: '',
    chiefComplaint: '',
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    followUpDate: '',
    followUpNotes: '',
    referredBy: '',
    referralDate: '',
    referralReason: '',
    treatmentDone: '',
    painScore: '',
    functionalScore: '',
    treatmentGiven: '',
    bpSystolic: '',
    bpDiastolic: '',
    pulseRate: '',
    temperatureF: '',
    heightCm: '',
    weightKg: '',
  })

  const load = useCallback(async () => {
    if (!appointmentId) return
    setLoading(true)
    setError(null)
    try {
    const res = await api.visitNotes.get({ appointmentId })
    if (res.success) {
      const n = res.data as VisitNote | null
      setNote(n)
      if (n) {
        setForm({
          patientName: n.patientName,
          patientAge: n.patientAge ?? '',
          chiefComplaint: n.chiefComplaint ?? '',
          subjective: n.subjective ?? '',
          objective: n.objective ?? '',
          assessment: n.assessment ?? '',
          plan: n.plan ?? '',
          followUpDate: n.followUpDate ? n.followUpDate.slice(0, 10) : '',
          followUpNotes: n.followUpNotes ?? '',
          referredBy: n.referredBy ?? '',
          referralDate: n.referralDate ? n.referralDate.slice(0, 10) : '',
          referralReason: n.referralReason ?? '',
          treatmentDone: n.treatmentDone ?? '',
          painScore: n.painScore !== null && n.painScore !== undefined ? String(n.painScore) : '',
          functionalScore: n.functionalScore !== null && n.functionalScore !== undefined ? String(n.functionalScore) : '',
          treatmentGiven: n.treatmentGiven ?? '',
          bpSystolic: n.bpSystolic !== null && n.bpSystolic !== undefined ? String(n.bpSystolic) : '',
          bpDiastolic: n.bpDiastolic !== null && n.bpDiastolic !== undefined ? String(n.bpDiastolic) : '',
          pulseRate: n.pulseRate !== null && n.pulseRate !== undefined ? String(n.pulseRate) : '',
          temperatureF: n.temperatureF !== null && n.temperatureF !== undefined ? String(n.temperatureF) : '',
          heightCm: n.heightCm !== null && n.heightCm !== undefined ? String(n.heightCm) : '',
          weightKg: n.weightKg !== null && n.weightKg !== undefined ? String(n.weightKg) : '',
        })
        // Pet/owner context for display only — patientName/Age above are
        // already the saved values, never overwritten here.
        setApptPet(n.appointment?.pet ?? null)
        setApptOwnerName(n.appointment?.customerName ?? n.appointment?.customer?.customerName ?? '')
      } else if (res.data === null) {
        // No note yet — prefill from the appointment. A vet visit's PATIENT
        // is the pet (name + computed age from dateOfBirth), not the owner
        // — every other vertical still prefills from the customer, exactly
        // as before.
        const apptRes = await api.appointments.get({ id: appointmentId })
        if (apptRes.success && apptRes.data) {
          const appt = apptRes.data as Appointment
          setApptPet(appt.pet ?? null)
          const ownerName = appt.customerName ?? appt.customer?.customerName ?? ''
          setApptOwnerName(ownerName)
          if (isVet && appt.pet) {
            setForm((f) => ({ ...f, patientName: appt.pet!.petName, patientAge: petAgeFromDob(appt.pet!.dateOfBirth) }))
          } else {
            setForm((f) => ({ ...f, patientName: ownerName }))
          }
        }
      }
    } else {
      setError(res.error?.message ?? 'Could not load visit note.')
    }
    } catch {
      setError('Could not load visit note.')
    } finally {
      setLoading(false)
    }
  }, [appointmentId])

  useEffect(() => { load() }, [load])

  const loadReferrals = useCallback(async (visitNoteId: string) => {
    const res = await api.visitNotes.listReferrals({ visitNoteId })
    if (res.success) setReferrals((res.data as ReferralAppointment[]) ?? [])
  }, [])

  useEffect(() => {
    if (!isSpecialist) return
    if (note) loadReferrals(note.id)
    api.hr.listEmployees({ isActive: true }).then((r: { success: boolean; data?: unknown }) => {
      if (!r.success) return
      const d = r.data as { employees?: typeof providers } | typeof providers
      setProviders(Array.isArray(d) ? d : (d.employees ?? []))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpecialist, note?.id])

  // Phase 58 §2 — structured prescription: loaded whenever the note itself
  // (re)loads, since items belong to the visitNoteId, not the appointment.
  useEffect(() => {
    if (!note) { setRxItems([]); return }
    api.visitNotes.listPrescriptionItems({ visitNoteId: note.id }).then((res) => {
      if (res.success) setRxItems((res.data as PrescriptionItem[]) ?? [])
    })
    setRxDirty(false)
  }, [note?.id])

  // Phase 58 §2 — vitals trend across this same patient's prior visits.
  useEffect(() => {
    if (!appointmentId) return
    api.visitNotes.getVitalsTrend({ appointmentId }).then((res) => {
      if (res.success) setVitalsTrend((res.data as VitalsTrendPoint[]) ?? [])
    })
  }, [appointmentId, note?.id])

  function addRxRow() {
    setRxItems((items) => [...items, { id: `draft-${Date.now()}-${items.length}`, drugName: '', dosage: null, frequency: null, duration: null, instructions: null }])
    setRxDirty(true)
  }

  function updateRxRow(id: string, field: keyof PrescriptionItem, value: string) {
    setRxItems((items) => items.map((it) => (it.id === id ? { ...it, [field]: value } : it)))
    setRxDirty(true)
  }

  function removeRxRow(id: string) {
    setRxItems((items) => items.filter((it) => it.id !== id))
    setRxDirty(true)
  }

  async function saveRx() {
    if (!note) return
    setRxSaving(true)
    const res = await api.visitNotes.savePrescriptionItems({
      visitNoteId: note.id,
      items: rxItems
        .filter((it) => it.drugName.trim())
        .map((it) => ({
          drugName: it.drugName.trim(),
          dosage: it.dosage?.trim() || undefined,
          frequency: it.frequency?.trim() || undefined,
          duration: it.duration?.trim() || undefined,
          instructions: it.instructions?.trim() || undefined,
        })),
    })
    setRxSaving(false)
    if (res.success) {
      setRxItems((res.data as PrescriptionItem[]) ?? [])
      setRxDirty(false)
    } else {
      setError((res.error as { message?: string })?.message ?? 'Could not save prescription.')
    }
  }

  async function handleRefer() {
    if (!note) return
    if (!referralForm.providerId || !referralForm.scheduledDate || !referralForm.scheduledTime) {
      setReferralError('Select a provider, date, and time.')
      return
    }
    setReferring(true)
    setReferralError(null)
    const res = await api.visitNotes.referToProvider({
      visitNoteId: note.id,
      providerId: referralForm.providerId,
      scheduledDate: referralForm.scheduledDate,
      scheduledTime: referralForm.scheduledTime,
      reason: referralForm.reason.trim() || undefined,
    })
    setReferring(false)
    if (res.success) {
      setShowReferralForm(false)
      setReferralForm({ providerId: '', scheduledDate: '', scheduledTime: '', reason: '' })
      await loadReferrals(note.id)
    } else {
      setReferralError((res.error as { message?: string })?.message ?? 'Could not create the referral appointment.')
    }
  }

  function setField(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setSaved(false)
  }

  async function handleSave(): Promise<boolean> {
    if (!appointmentId) return false
    if (!form.patientName.trim()) { setError('Patient name is required.'); return false }
    setSaving(true)
    setError(null)
    const fields = {
      patientName: form.patientName.trim(),
      patientAge: form.patientAge.trim() || undefined,
      chiefComplaint: form.chiefComplaint.trim() || undefined,
      subjective: form.subjective.trim() || undefined,
      objective: form.objective.trim() || undefined,
      assessment: form.assessment.trim() || undefined,
      plan: form.plan.trim() || undefined,
      followUpDate: form.followUpDate || undefined,
      followUpNotes: form.followUpNotes.trim() || undefined,
      referredBy: form.referredBy.trim() || undefined,
      referralDate: form.referralDate || undefined,
      referralReason: form.referralReason.trim() || undefined,
      treatmentDone: form.treatmentDone.trim() || undefined,
      painScore: form.painScore !== '' ? parseInt(form.painScore, 10) : null,
      functionalScore: form.functionalScore !== '' ? parseInt(form.functionalScore, 10) : null,
      treatmentGiven: form.treatmentGiven.trim() || undefined,
      bpSystolic: form.bpSystolic !== '' ? parseInt(form.bpSystolic, 10) : null,
      bpDiastolic: form.bpDiastolic !== '' ? parseInt(form.bpDiastolic, 10) : null,
      pulseRate: form.pulseRate !== '' ? parseInt(form.pulseRate, 10) : null,
      temperatureF: form.temperatureF !== '' ? parseFloat(form.temperatureF) : null,
      heightCm: form.heightCm !== '' ? parseFloat(form.heightCm) : null,
      weightKg: form.weightKg !== '' ? parseFloat(form.weightKg) : null,
    }

    let res
    if (note) {
      res = await api.visitNotes.update({ id: note.id, ...fields })
    } else {
      res = await api.visitNotes.create({ appointmentId, ...fields })
    }
    setSaving(false)
    if (!res.success) { setError(res.error?.message ?? 'Could not save note.'); return false }
    setSaved(true)
    load()
    return true
  }

  async function handleFinalize() {
    if (!note) return
    setError(null)
    if (!saved) {
      const ok = await handleSave()
      if (!ok) return
    }
    setFinalizing(true)
    const res = await api.visitNotes.finalize({ id: note.id })
    setFinalizing(false)
    if (!res.success) { setError(res.error?.message ?? 'Could not finalize note.'); return }
    load()
  }

  const isFinalized = note?.isFinalized ?? false
  const appointment = note?.appointment ?? null

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/appointments')} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-dark dark:text-slate-100">Consultation Note</h1>
              {isFinalized && (
                <Badge variant="success" size="sm" icon={<Lock size={10} />}>Finalized</Badge>
              )}
            </div>
            {appointment && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {appointment.appointmentNumber} · {appointment.serviceTitle} · {fmt(appointment.scheduledDate)} @ {appointment.scheduledTime}
                {appointment.provider && ` · ${appointment.provider.fullName}`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {note && (
            <button
              onClick={() => setShowPrint(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <Printer size={14} /> Print Summary
            </button>
          )}
          {canWrite && !isFinalized && (
            <>
              <Button size="sm" variant="secondary" onClick={handleSave} loading={saving} icon={saved ? <CheckCircle2 size={14} className="text-success" /> : <Save size={14} />}>
                {saved ? 'Saved' : 'Save Note'}
              </Button>
              {note && (
                <Button size="sm" onClick={handleFinalize} loading={finalizing} icon={<Lock size={14} />}>
                  Finalize
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {error && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-danger/5 border border-danger/20 rounded-xl text-sm text-danger">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {isFinalized && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-success/5 border border-success/20 rounded-xl text-sm text-success">
            <Lock size={14} /> This note was finalized on {fmt(note?.finalizedAt ?? null)} and is read-only.
          </div>
        )}

        <div className="max-w-3xl mx-auto space-y-6">
          {/* Patient info */}
          <Section title="Patient Information">
            {/* Phase 58 §2 — Vet Clinic: species/breed/owner context, since
                "Patient Name" alone (the pet's name) doesn't tell a vet
                what animal or whose pet they're looking at. */}
            {isVet && apptPet && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2">
                <span><span className="font-semibold text-slate-700 dark:text-slate-300">Species:</span> {apptPet.species}</span>
                {apptPet.breed && <span><span className="font-semibold text-slate-700 dark:text-slate-300">Breed:</span> {apptPet.breed}</span>}
                {apptPet.gender && <span><span className="font-semibold text-slate-700 dark:text-slate-300">Sex:</span> {apptPet.gender}</span>}
                {apptOwnerName && <span><span className="font-semibold text-slate-700 dark:text-slate-300">Owner:</span> {apptOwnerName}</span>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Patient Name" required>
                <input
                  value={form.patientName}
                  onChange={(e) => setField('patientName', e.target.value)}
                  disabled={isFinalized || !canWrite}
                  placeholder="Full name"
                  className={inputCls(isFinalized || !canWrite)}
                />
              </Field>
              <Field label="Age">
                <input
                  value={form.patientAge}
                  onChange={(e) => setField('patientAge', e.target.value)}
                  disabled={isFinalized || !canWrite}
                  placeholder="e.g. 35 years"
                  className={inputCls(isFinalized || !canWrite)}
                />
              </Field>
            </div>
            <Field label="Chief Complaint">
              <input
                value={form.chiefComplaint}
                onChange={(e) => setField('chiefComplaint', e.target.value)}
                disabled={isFinalized || !canWrite}
                placeholder="Reason for visit"
                className={inputCls(isFinalized || !canWrite)}
              />
            </Field>
          </Section>

          {/* SOAP */}
          <Section title="S — Subjective">
            <TextArea
              value={form.subjective}
              onChange={(v) => setField('subjective', v)}
              disabled={isFinalized || !canWrite}
              placeholder="Patient-reported history, symptoms, duration, onset, aggravating/relieving factors..."
              rows={4}
            />
          </Section>

          <Section title="Vitals">
            <VitalsGrid form={form} setField={setField} disabled={isFinalized || !canWrite} vitalsFlags={note?.vitalsFlags ?? null} />
          </Section>

          {/* Phase 58 §2 — vitals trend across this patient's prior visits,
              same single-series line-chart pattern as PetProfileScreen.tsx's
              weight chart. Only shown once there's something to trend. */}
          {vitalsTrend.length >= 2 && (
            <Section title="Vitals Trend">
              <VitalsTrendSection trend={vitalsTrend} />
            </Section>
          )}

          <Section title="O — Objective">
            <TextArea
              value={form.objective}
              onChange={(v) => setField('objective', v)}
              disabled={isFinalized || !canWrite}
              placeholder="Additional physical examination findings not covered by the vitals above..."
              rows={4}
            />
          </Section>

          <Section title="A — Assessment">
            <TextArea
              value={form.assessment}
              onChange={(v) => setField('assessment', v)}
              disabled={isFinalized || !canWrite}
              placeholder="Diagnosis, differential diagnoses, clinical impression..."
              rows={3}
            />
          </Section>

          <Section title="P — Plan">
            <TextArea
              value={form.plan}
              onChange={(v) => setField('plan', v)}
              disabled={isFinalized || !canWrite}
              placeholder="Treatment plan, medications prescribed, dosage, investigations ordered, procedures..."
              rows={5}
            />
          </Section>

          {/* Phase 58 §2 — GP/Specialist Clinic: structured prescription,
              distinct from the free-text Plan above — one row per drug so
              it can print as a real itemized prescription a pharmacist can
              read without parsing a paragraph. Only reachable once the note
              itself has been saved (needs a real visitNoteId). */}
          {note && (
            <Section title="Prescription">
              <PrescriptionTable
                items={rxItems}
                disabled={isFinalized || !canWrite}
                onAdd={addRxRow}
                onChange={updateRxRow}
                onRemove={removeRxRow}
              />
              <div className="flex items-center gap-2 pt-1">
                {canWrite && !isFinalized && (
                  <Button size="sm" variant="secondary" onClick={saveRx} loading={rxSaving} disabled={!rxDirty} icon={<Save size={14} />}>
                    Save Prescription
                  </Button>
                )}
                {rxItems.length > 0 && (
                  <button
                    onClick={() => setShowPrintRx(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Printer size={14} /> Print Prescription
                  </button>
                )}
              </div>
            </Section>
          )}

          {/* Follow-up */}
          <Section title="Follow-up">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Follow-up Date">
                <input
                  type="date"
                  value={form.followUpDate}
                  onChange={(e) => setField('followUpDate', e.target.value)}
                  disabled={isFinalized || !canWrite}
                  className={inputCls(isFinalized || !canWrite)}
                />
              </Field>
              <Field label="Follow-up Instructions">
                <input
                  value={form.followUpNotes}
                  onChange={(e) => setField('followUpNotes', e.target.value)}
                  disabled={isFinalized || !canWrite}
                  placeholder="e.g. Review after 1 week"
                  className={inputCls(isFinalized || !canWrite)}
                />
              </Field>
            </div>
          </Section>

          {/* Treatment Done — Dental Clinic only */}
          {isDental && (
            <Section title="Treatment Done This Session">
              <TextArea
                value={form.treatmentDone}
                onChange={(v) => setField('treatmentDone', v)}
                disabled={isFinalized || !canWrite}
                placeholder="Describe the procedures performed this visit, teeth treated, materials used..."
                rows={4}
              />
            </Section>
          )}

          {/* Physio-specific fields */}
          {isPhysio && (
            <>
              <Section title="Pain & Treatment">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Pain Score (0 = none, 10 = worst)">
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={form.painScore}
                      onChange={(e) => setField('painScore', e.target.value)}
                      disabled={isFinalized || !canWrite}
                      placeholder="0–10"
                      className={inputCls(isFinalized || !canWrite)}
                    />
                  </Field>
                  <div className="flex items-end pb-0.5">
                    <div className="flex gap-1 flex-wrap">
                      {[0,1,2,3,4,5,6,7,8,9,10].map((v) => (
                        <button
                          key={v}
                          type="button"
                          disabled={isFinalized || !canWrite}
                          onClick={() => setField('painScore', String(v))}
                          className={cn(
                            'w-7 h-7 rounded text-xs font-bold transition-colors',
                            String(v) === form.painScore
                              ? v <= 3 ? 'bg-success text-white' : v <= 6 ? 'bg-warning text-white' : 'bg-danger text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200'
                          )}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Phase 58 §2 — structured functional outcome measure,
                    trended across sessions alongside pain score (see the
                    new Vitals Trend section above). */}
                <Field label="Functional Score (0 = worst function, 100 = normal function)">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.functionalScore}
                    onChange={(e) => setField('functionalScore', e.target.value)}
                    disabled={isFinalized || !canWrite}
                    placeholder="0–100"
                    className={inputCls(isFinalized || !canWrite)}
                  />
                </Field>
              </Section>
              <Section title="Treatment Given This Session">
                <TextArea
                  value={form.treatmentGiven}
                  onChange={(v) => setField('treatmentGiven', v)}
                  disabled={isFinalized || !canWrite}
                  placeholder="e.g. Ultrasound therapy to L4-L5, TENS 20 min, manual therapy — lumbar mobilisation, ice pack, Kinesio taping..."
                  rows={4}
                />
              </Section>
            </>
          )}

          {/* Referral — Specialist only */}
          {isSpecialist && (
            <Section title="Referral Details">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Referred By">
                  <input
                    value={form.referredBy}
                    onChange={(e) => setField('referredBy', e.target.value)}
                    disabled={isFinalized || !canWrite}
                    placeholder="Referring practitioner / clinic"
                    className={inputCls(isFinalized || !canWrite)}
                  />
                </Field>
                <Field label="Referral Date">
                  <input
                    type="date"
                    value={form.referralDate}
                    onChange={(e) => setField('referralDate', e.target.value)}
                    disabled={isFinalized || !canWrite}
                    className={inputCls(isFinalized || !canWrite)}
                  />
                </Field>
              </div>
              <Field label="Referral Reason">
                <input
                  value={form.referralReason}
                  onChange={(e) => setField('referralReason', e.target.value)}
                  disabled={isFinalized || !canWrite}
                  placeholder="Reason for referral"
                  className={inputCls(isFinalized || !canWrite)}
                />
              </Field>
            </Section>
          )}

          {/* Refer to Another Provider — real in-app routing, distinct from the
              free-text "Referred By" fields above (those record an inbound
              referral from an outside doctor; this books a real appointment
              with another provider in this clinic). Only available once the
              note itself has been saved (needs a real visitNoteId to link to). */}
          {isSpecialist && note && (
            <Section title="Refer to Another Provider">
              {referrals.length > 0 && (
                <div className="space-y-2 mb-3">
                  {referrals.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 text-xs bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
                      <div>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{r.provider?.fullName ?? 'Unassigned'}</span>
                        {r.provider?.specialization && <span className="text-slate-400"> · {r.provider.specialization}</span>}
                        <span className="text-slate-400"> — {new Date(r.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at {r.scheduledTime}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={r.status === 'COMPLETED' ? 'success' : r.status === 'CANCELLED' || r.status === 'NO_SHOW' ? 'danger' : 'info'} size="sm">{r.status}</Badge>
                        {/* Phase 58 §2 — short formal referral letter, distinct
                            from the full SOAP visit summary print. */}
                        <button
                          onClick={() => setPrintReferral(r)}
                          title="Print Referral Letter"
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                        >
                          <Mail size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!showReferralForm ? (
                canWrite && (
                  <Button size="sm" variant="secondary" onClick={() => setShowReferralForm(true)}>
                    + Refer to Provider
                  </Button>
                )
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Provider" required>
                      <select
                        value={referralForm.providerId}
                        onChange={(e) => setReferralForm((f) => ({ ...f, providerId: e.target.value }))}
                        className={inputCls(false)}
                      >
                        <option value="">Select…</option>
                        {providers.map((p) => (
                          <option key={p.id} value={p.id}>{p.fullName}{p.specialization ? ` (${p.specialization})` : ''}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Date" required>
                      <input type="date" value={referralForm.scheduledDate} onChange={(e) => setReferralForm((f) => ({ ...f, scheduledDate: e.target.value }))} className={inputCls(false)} />
                    </Field>
                    <Field label="Time" required>
                      <input type="time" value={referralForm.scheduledTime} onChange={(e) => setReferralForm((f) => ({ ...f, scheduledTime: e.target.value }))} className={inputCls(false)} />
                    </Field>
                  </div>
                  <Field label="Reason">
                    <input
                      value={referralForm.reason}
                      onChange={(e) => setReferralForm((f) => ({ ...f, reason: e.target.value }))}
                      placeholder="Carried over to the new appointment's notes"
                      className={inputCls(false)}
                    />
                  </Field>
                  {referralError && <p className="text-xs text-danger">{referralError}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleRefer} loading={referring}>Book Referral</Button>
                    <Button size="sm" variant="secondary" onClick={() => { setShowReferralForm(false); setReferralError(null) }}>Cancel</Button>
                  </div>
                </div>
              )}
            </Section>
          )}

          {note && (
            <Section title="Documents">
              <DocumentPanel entityType="VISIT_NOTE" entityId={note.id} compact />
            </Section>
          )}
        </div>
      </div>

      {/* Print modal */}
      {showPrint && note && (
        <VisitSummaryPrint
          note={{ ...note, ...form, painScore: form.painScore !== '' ? parseInt(form.painScore, 10) : null, functionalScore: form.functionalScore !== '' ? parseInt(form.functionalScore, 10) : null }}
          profile={profile}
          isSpecialist={isSpecialist}
          isDental={isDental}
          isPhysio={isPhysio}
          onClose={() => setShowPrint(false)}
        />
      )}

      {/* Phase 58 §2 — real itemized prescription print, distinct from the
          "not a validated medical record" visit summary above. */}
      {showPrintRx && note && (
        <PrescriptionPrint
          patientName={form.patientName}
          patientAge={form.patientAge}
          appointment={note.appointment}
          items={rxItems}
          profile={profile}
          onClose={() => setShowPrintRx(false)}
        />
      )}

      {/* Phase 58 §2 — short formal referral letter, distinct from the full SOAP note. */}
      {printReferral && note && (
        <ReferralLetterPrint
          referral={printReferral}
          patientName={form.patientName}
          patientAge={form.patientAge}
          chiefComplaint={form.chiefComplaint}
          assessment={form.assessment}
          referringProvider={note.appointment?.provider ?? null}
          profile={profile}
          onClose={() => setPrintReferral(null)}
        />
      )}
    </div>
  )
}

// ─── Section / Field helpers ─────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
      <p className="text-xs font-bold uppercase tracking-widest text-brand border-b border-slate-100 dark:border-slate-800 pb-2">{title}</p>
      {children}
    </motion.div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
    </div>
  )
}

function TextArea({ value, onChange, disabled, placeholder, rows }: {
  value: string
  onChange: (v: string) => void
  disabled: boolean
  placeholder: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      rows={rows ?? 3}
      className={cn(
        'w-full px-3 py-2.5 rounded-xl border text-sm text-dark dark:text-slate-100 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-colors',
        disabled ? 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-default' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
      )}
    />
  )
}

// Phase 54B — structured vitals with auto-flagging against a saved
// NormalRangeReference (computed server-side on save, shown here read-only
// as a badge next to the field it belongs to — never computed client-side,
// so it always reflects the one saved definition of "normal" for that test).
// Phase 58 §2 — CRITICAL must never fall through to the 'success' default
// (a life-threatening reading rendered in a green badge would be a real
// patient-safety bug, not just a cosmetic one) — mapped to 'danger', same as
// HIGH, since this Badge component has no more-severe variant than danger.
const FLAG_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = { NORMAL: 'success', LOW: 'warning', HIGH: 'danger', CRITICAL: 'danger' }

function VitalsGrid({ form, setField, disabled, vitalsFlags }: {
  form: FormData; setField: (field: keyof FormData, value: string) => void; disabled: boolean
  vitalsFlags: string | null
}) {
  const flags: Record<string, string> = vitalsFlags ? JSON.parse(vitalsFlags) : {}
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <Field label="BP Systolic (mmHg)">
        <div className="flex items-center gap-2">
          <input type="number" value={form.bpSystolic} onChange={(e) => setField('bpSystolic', e.target.value)}
            disabled={disabled} placeholder="120" className={inputCls(disabled)} />
          {flags.bpSystolic && <Badge variant={FLAG_VARIANT[flags.bpSystolic] ?? 'success'} size="sm">{flags.bpSystolic}</Badge>}
        </div>
      </Field>
      <Field label="BP Diastolic (mmHg)">
        <div className="flex items-center gap-2">
          <input type="number" value={form.bpDiastolic} onChange={(e) => setField('bpDiastolic', e.target.value)}
            disabled={disabled} placeholder="80" className={inputCls(disabled)} />
          {flags.bpDiastolic && <Badge variant={FLAG_VARIANT[flags.bpDiastolic] ?? 'success'} size="sm">{flags.bpDiastolic}</Badge>}
        </div>
      </Field>
      <Field label="Pulse (bpm)">
        <div className="flex items-center gap-2">
          <input type="number" value={form.pulseRate} onChange={(e) => setField('pulseRate', e.target.value)}
            disabled={disabled} placeholder="72" className={inputCls(disabled)} />
          {flags.pulseRate && <Badge variant={FLAG_VARIANT[flags.pulseRate] ?? 'success'} size="sm">{flags.pulseRate}</Badge>}
        </div>
      </Field>
      <Field label="Temperature (°F)">
        <div className="flex items-center gap-2">
          <input type="number" step="0.1" value={form.temperatureF} onChange={(e) => setField('temperatureF', e.target.value)}
            disabled={disabled} placeholder="98.6" className={inputCls(disabled)} />
          {flags.temperatureF && <Badge variant={FLAG_VARIANT[flags.temperatureF] ?? 'success'} size="sm">{flags.temperatureF}</Badge>}
        </div>
      </Field>
      <Field label="Height (cm)">
        <input type="number" step="0.1" value={form.heightCm} onChange={(e) => setField('heightCm', e.target.value)}
          disabled={disabled} placeholder="170" className={inputCls(disabled)} />
      </Field>
      <Field label="Weight (kg)">
        <input type="number" step="0.1" value={form.weightKg} onChange={(e) => setField('weightKg', e.target.value)}
          disabled={disabled} placeholder="65" className={inputCls(disabled)} />
      </Field>
    </div>
  )
}

function inputCls(disabled: boolean): string {
  return cn(
    'w-full h-11 px-3 rounded-xl border text-sm text-dark dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-colors',
    disabled ? 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-default' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
  )
}

// ─── Visit Summary Print ──────────────────────────────────────────────────────

interface PrintNote extends Omit<FormData, 'painScore' | 'functionalScore'> {
  id: string
  finalizedAt: string | null
  appointment: Appointment | null
  painScore: number | null
  functionalScore: number | null
}

interface BusinessProfile {
  businessName: string
  address?: string | null
  city?: string | null
  state?: string | null
  phone?: string | null
  email?: string | null
  logoPath?: string | null
  enableDocumentWatermark?: boolean | null
  clinicSpecialty?: string | null
}

function VisitSummaryPrint({ note, profile, isSpecialist, isDental, isPhysio, onClose }: {
  note: PrintNote & { painScore?: number | null }
  profile: BusinessProfile | null
  isSpecialist: boolean
  isDental: boolean
  isPhysio: boolean
  onClose: () => void
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handlePrint() {
    window.print()
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:hidden">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between print:hidden">
            <p className="text-sm font-semibold text-dark dark:text-slate-100">Visit Summary — Preview</p>
            <div className="flex items-center gap-2">
              <button onClick={handlePrint} className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90 transition-colors">
                <Printer size={14} /> Print
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-dark dark:hover:text-slate-100 transition-colors">
                ✕
              </button>
            </div>
          </div>
          <div className="p-8">
            <SummaryBody note={note} profile={profile} isSpecialist={isSpecialist} isDental={isDental} isPhysio={isPhysio} />
          </div>
        </div>
      </div>

      <div className="hidden print:block fixed inset-0 bg-white dark:bg-slate-900 z-[9999] p-12">
        <SummaryBody note={note} profile={profile} isSpecialist={isSpecialist} isDental={isDental} isPhysio={isPhysio} />
      </div>
    </>
  )
}

function SummaryBody({ note, profile, isSpecialist, isDental, isPhysio }: {
  note: PrintNote & { painScore?: number | null }
  profile: BusinessProfile | null
  isSpecialist: boolean
  isDental: boolean
  isPhysio: boolean
}) {
  const appt = note.appointment
  return (
    <div style={{ fontFamily: 'Georgia, serif' }} className="relative text-dark dark:text-slate-100 text-sm">
      <DocumentWatermark logoPath={profile?.logoPath} enabled={profile?.enableDocumentWatermark} />
      {/* Clinic header */}
      <div className="text-center border-b-2 border-dark pb-4 mb-6">
        <p className="text-[10px] font-bold tracking-[0.3em] text-slate-500 dark:text-slate-400 uppercase mb-1">Consultation Summary</p>
        {profile?.logoPath && (
          <img src={documentLogoUrl(profile.logoPath)} alt="" className="mx-auto mb-2" style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain' }} />
        )}
        <h1 className="text-2xl font-bold">{profile?.businessName ?? 'Medical Clinic'}</h1>
        {profile?.clinicSpecialty && <p className="text-xs font-semibold text-brand uppercase tracking-wide mt-0.5">{profile.clinicSpecialty}</p>}
        {(profile?.address || profile?.city) && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{[profile?.address, profile?.city, profile?.state].filter(Boolean).join(', ')}</p>
        )}
        {(profile?.phone || profile?.email) && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {profile?.phone ? `Tel: ${profile.phone}` : ''}
            {profile?.phone && profile?.email ? '  ·  ' : ''}
            {profile?.email ?? ''}
          </p>
        )}
      </div>

      {/* Appointment meta */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">Patient</p>
          <p className="font-semibold">{note.patientName}</p>
          {note.patientAge && <p className="text-xs text-slate-500 dark:text-slate-400">{note.patientAge}</p>}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">Consultation</p>
          {appt && <p className="text-xs text-slate-600 dark:text-slate-300">{appt.appointmentNumber} · {new Date(appt.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} @ {appt.scheduledTime}</p>}
          {appt?.provider && <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{appt.provider.fullName}{appt.provider.specialization ? ` (${appt.provider.specialization})` : ''}</p>}
        </div>
      </div>

      {/* Chief Complaint */}
      {note.chiefComplaint && <SoapSection title="Chief Complaint" text={note.chiefComplaint} />}
      {note.subjective   && <SoapSection title="Subjective (History)" text={note.subjective} />}
      {(note.bpSystolic || note.bpDiastolic || note.pulseRate || note.temperatureF || note.heightCm || note.weightKg) && (
        <SoapSection title="Vitals" text={[
          note.bpSystolic && note.bpDiastolic ? `BP: ${note.bpSystolic}/${note.bpDiastolic} mmHg` : null,
          note.pulseRate ? `Pulse: ${note.pulseRate} bpm` : null,
          note.temperatureF ? `Temp: ${note.temperatureF} °F` : null,
          note.heightCm ? `Height: ${note.heightCm} cm` : null,
          note.weightKg ? `Weight: ${note.weightKg} kg` : null,
        ].filter(Boolean).join('   ·   ')} />
      )}
      {note.objective    && <SoapSection title="Objective (Examination)" text={note.objective} />}
      {note.assessment   && <SoapSection title="Assessment (Diagnosis)" text={note.assessment} />}
      {note.plan         && <SoapSection title="Plan (Treatment)" text={note.plan} />}
      {isDental && note.treatmentDone && <SoapSection title="Treatment Done This Session" text={note.treatmentDone} />}
      {isPhysio && note.painScore !== null && note.painScore !== undefined && (
        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 border-b border-slate-100 dark:border-slate-800 pb-1">Pain Score</p>
          <p className="text-xs text-slate-700 dark:text-slate-300">{note.painScore} / 10</p>
        </div>
      )}
      {isPhysio && note.functionalScore !== null && note.functionalScore !== undefined && (
        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 border-b border-slate-100 dark:border-slate-800 pb-1">Functional Score</p>
          <p className="text-xs text-slate-700 dark:text-slate-300">{note.functionalScore} / 100</p>
        </div>
      )}
      {isPhysio && note.treatmentGiven && <SoapSection title="Treatment Given This Session" text={note.treatmentGiven} />}

      {/* Follow-up */}
      {(note.followUpDate || note.followUpNotes) && (
        <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Follow-up</p>
          {note.followUpDate && <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">Date: {new Date(note.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
          {note.followUpNotes && <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">{note.followUpNotes}</p>}
        </div>
      )}

      {/* Referral (Specialist only) */}
      {isSpecialist && (note.referredBy || note.referralReason) && (
        <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Referral</p>
          {note.referredBy   && <p className="text-xs text-slate-700 dark:text-slate-300">Referred by: {note.referredBy}{note.referralDate ? ` on ${new Date(note.referralDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</p>}
          {note.referralReason && <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">Reason: {note.referralReason}</p>}
        </div>
      )}

      {/* Signature */}
      <div className="grid grid-cols-2 gap-16 mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
        <div className="text-center">
          <div className="border-b border-dark h-8 mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Practitioner Signature</p>
          {appt?.provider && <p className="text-xs font-semibold text-dark dark:text-slate-100 mt-0.5">{appt.provider.fullName}</p>}
        </div>
        <div className="text-center">
          <div className="border-b border-dark h-8 mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Clinic Stamp</p>
        </div>
      </div>

      {/* Clinical disclaimer */}
      <div className="mt-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
        <p className="text-[8px] text-slate-500 dark:text-slate-400 leading-relaxed">
          <strong>Disclaimer:</strong> This document was generated by Sarang Business OS Lite, a convenience tool.
          It is NOT a validated medical record, prescription, or clinical report. All content was entered by the
          practitioner. Verify all information before clinical use.
        </p>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
        <p className="text-[9px] text-slate-400">Issued on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · {profile?.businessName ?? 'Medical Clinic'}</p>
        <p className="text-[9px] text-slate-300 mt-0.5 inline-flex items-center gap-1">
          Generated by Sarang Business OS Lite | Aszurex <AszurexMark width={10} /> | www.aszurex.com
        </p>
      </div>
    </div>
  )
}

function SoapSection({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 border-b border-slate-100 dark:border-slate-800 pb-1">{title}</p>
      <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{text}</p>
    </div>
  )
}

// ─── Structured Prescription (Phase 58 §2) ──────────────────────────────────

function PrescriptionTable({ items, disabled, onAdd, onChange, onRemove }: {
  items: PrescriptionItem[]
  disabled: boolean
  onAdd: () => void
  onChange: (id: string, field: keyof PrescriptionItem, value: string) => void
  onRemove: (id: string) => void
}) {
  const cellCls = 'w-full h-9 px-2 rounded-lg border text-xs text-dark dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-colors bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500'
  return (
    <div className="space-y-2">
      {items.length === 0 && <p className="text-xs text-slate-400">No drugs added yet.</p>}
      {items.length > 0 && (
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.5fr_auto] gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">
          <span>Drug</span><span>Dosage</span><span>Frequency</span><span>Duration</span><span>Instructions</span><span />
        </div>
      )}
      {items.map((it) => (
        <div key={it.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1.5fr_auto] gap-2 items-center">
          <input value={it.drugName} onChange={(e) => onChange(it.id, 'drugName', e.target.value)} disabled={disabled} placeholder="e.g. Amoxicillin" className={cellCls} />
          <input value={it.dosage ?? ''} onChange={(e) => onChange(it.id, 'dosage', e.target.value)} disabled={disabled} placeholder="500mg" className={cellCls} />
          <input value={it.frequency ?? ''} onChange={(e) => onChange(it.id, 'frequency', e.target.value)} disabled={disabled} placeholder="1-0-1" className={cellCls} />
          <input value={it.duration ?? ''} onChange={(e) => onChange(it.id, 'duration', e.target.value)} disabled={disabled} placeholder="5 days" className={cellCls} />
          <input value={it.instructions ?? ''} onChange={(e) => onChange(it.id, 'instructions', e.target.value)} disabled={disabled} placeholder="After food" className={cellCls} />
          {!disabled && (
            <button onClick={() => onRemove(it.id)} className="p-1.5 rounded hover:bg-danger/10 text-slate-400 hover:text-danger transition-colors">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button onClick={onAdd} className="flex items-center gap-1 text-xs font-medium text-brand hover:underline pt-1">
          <Plus size={13} /> Add Drug
        </button>
      )}
    </div>
  )
}

// ─── Vitals Trend (Phase 58 §2) ─────────────────────────────────────────────

const TREND_METRICS: Array<{ key: keyof VitalsTrendPoint; label: string; unit: string; color: string }> = [
  { key: 'bpSystolic', label: 'BP Systolic', unit: 'mmHg', color: '#dc2626' },
  { key: 'bpDiastolic', label: 'BP Diastolic', unit: 'mmHg', color: '#ea580c' },
  { key: 'pulseRate', label: 'Pulse', unit: 'bpm', color: '#2563eb' },
  { key: 'temperatureF', label: 'Temperature', unit: '°F', color: '#059669' },
  { key: 'weightKg', label: 'Weight', unit: 'kg', color: '#7c3aed' },
  // Phase 58 §2 — Physio Clinic outcome measures. No isPhysio gate needed
  // here: these only ever have data when the Physio-only form section
  // actually saved a value, so they naturally never appear as an
  // "available" chip for any other vertical's visits.
  { key: 'painScore', label: 'Pain Score', unit: '/10', color: '#e11d48' },
  { key: 'functionalScore', label: 'Functional Score', unit: '/100', color: '#0d9488' },
]

function VitalsTrendSection({ trend }: { trend: VitalsTrendPoint[] }) {
  const availableMetrics = TREND_METRICS.filter((m) => trend.filter((p) => p[m.key] != null).length >= 2)
  const [metricKey, setMetricKey] = useState<string>(availableMetrics[0]?.key ?? 'bpSystolic')
  const metric = TREND_METRICS.find((m) => m.key === metricKey) ?? availableMetrics[0]

  if (availableMetrics.length === 0) {
    return <p className="text-xs text-slate-400 text-center py-3">Not enough history yet — record vitals across at least 2 visits to see a trend.</p>
  }

  const points = trend.filter((p) => p[metric!.key] != null) as Array<VitalsTrendPoint & Record<string, number>>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {availableMetrics.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetricKey(m.key)}
            className={cn(
              'px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors',
              metricKey === m.key ? 'bg-brand text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200'
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <TrendLineChart points={points} valueKey={metric!.key as string} unit={metric!.unit} color={metric!.color} />
    </div>
  )
}

// Single-series SVG line chart — same construction as PetProfileScreen.tsx's
// WeightChart, generalized to any numeric field/date pair.
function TrendLineChart({ points, valueKey, unit, color }: {
  points: Array<VitalsTrendPoint & Record<string, unknown>>
  valueKey: string
  unit: string
  color: string
}) {
  const W = 560, H = 100
  const PL = 44, PR = 16, PT = 12, PB = 28
  const iW = W - PL - PR
  const iH = H - PT - PB

  const values = points.map((d) => Number(d[valueKey]))
  const times = points.map((d) => new Date(d.date).getTime())
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const minT = Math.min(...times)
  const vRange = maxV - minV || 1
  const tRange = Math.max(...times) - minT || 1

  const cx = (i: number) => PL + ((times[i] - minT) / tRange) * iW
  const cy = (i: number) => PT + iH - ((values[i] - minV) / vRange) * iH

  const linePoints = points.map((_, i) => `${cx(i).toFixed(1)},${cy(i).toFixed(1)}`).join(' ')
  const areaPoints = [`${PL},${PT + iH}`, ...points.map((_, i) => `${cx(i).toFixed(1)},${cy(i).toFixed(1)}`), `${cx(points.length - 1).toFixed(1)},${PT + iH}`].join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }}>
      <text x={PL - 4} y={PT + 4} textAnchor="end" fontSize={9} fill="#94a3b8">{maxV.toFixed(1)}</text>
      <text x={PL - 4} y={PT + iH + 4} textAnchor="end" fontSize={9} fill="#94a3b8">{minV.toFixed(1)}</text>
      <text x={PL - 4} y={PT + iH / 2 + 4} textAnchor="end" fontSize={9} fill="#94a3b8">{unit}</text>
      <line x1={PL} y1={PT} x2={PL + iW} y2={PT} stroke="#f1f5f9" strokeWidth={1} />
      <line x1={PL} y1={PT + iH} x2={PL + iW} y2={PT + iH} stroke="#e2e8f0" strokeWidth={1} />
      <polygon points={areaPoints} fill={color} fillOpacity={0.08} />
      <polyline points={linePoints} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((d, i) => (
        <circle key={i} cx={cx(i)} cy={cy(i)} r={3.5} fill={color}>
          <title>{`${values[i]} ${unit} · ${new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}</title>
        </circle>
      ))}
      <text x={PL} y={H - 4} textAnchor="start" fontSize={9} fill="#94a3b8">
        {new Date(points[0].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
      </text>
      <text x={PL + iW} y={H - 4} textAnchor="end" fontSize={9} fill="#94a3b8">
        {new Date(points[points.length - 1].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
      </text>
    </svg>
  )
}

// ─── Prescription Print (Phase 58 §2) ───────────────────────────────────────

function PrescriptionPrint({ patientName, patientAge, appointment, items, profile, onClose }: {
  patientName: string
  patientAge: string
  appointment: Appointment | null
  items: PrescriptionItem[]
  profile: BusinessProfile | null
  onClose: () => void
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const body = (
    <div style={{ fontFamily: 'Georgia, serif' }} className="relative text-dark dark:text-slate-100 text-sm">
      <DocumentWatermark logoPath={profile?.logoPath} enabled={profile?.enableDocumentWatermark} />
      <div className="text-center border-b-2 border-dark pb-4 mb-6">
        <p className="text-[10px] font-bold tracking-[0.3em] text-slate-500 dark:text-slate-400 uppercase mb-1">Prescription</p>
        {profile?.logoPath && (
          <img src={documentLogoUrl(profile.logoPath)} alt="" className="mx-auto mb-2" style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain' }} />
        )}
        <h1 className="text-2xl font-bold">{profile?.businessName ?? 'Medical Clinic'}</h1>
        {profile?.clinicSpecialty && <p className="text-xs font-semibold text-brand uppercase tracking-wide mt-0.5">{profile.clinicSpecialty}</p>}
        {(profile?.address || profile?.city) && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{[profile?.address, profile?.city, profile?.state].filter(Boolean).join(', ')}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">Patient</p>
          <p className="font-semibold">{patientName}</p>
          {patientAge && <p className="text-xs text-slate-500 dark:text-slate-400">{patientAge}</p>}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">Date</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          {appointment?.provider && <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{appointment.provider.fullName}{appointment.provider.specialization ? ` (${appointment.provider.specialization})` : ''}</p>}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-3xl font-bold mb-3" style={{ fontFamily: 'Georgia, serif' }}>℞</p>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-dark text-left">
              <th className="py-1.5 pr-2 font-bold">Drug</th>
              <th className="py-1.5 pr-2 font-bold">Dosage</th>
              <th className="py-1.5 pr-2 font-bold">Frequency</th>
              <th className="py-1.5 pr-2 font-bold">Duration</th>
              <th className="py-1.5 font-bold">Instructions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-2 font-semibold">{it.drugName}</td>
                <td className="py-2 pr-2 text-slate-600 dark:text-slate-300">{it.dosage || '—'}</td>
                <td className="py-2 pr-2 text-slate-600 dark:text-slate-300">{it.frequency || '—'}</td>
                <td className="py-2 pr-2 text-slate-600 dark:text-slate-300">{it.duration || '—'}</td>
                <td className="py-2 text-slate-600 dark:text-slate-300">{it.instructions || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-16 mt-16 pt-8 border-t border-slate-200 dark:border-slate-700">
        <div className="text-center">
          <div className="border-b border-dark h-8 mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Practitioner Signature</p>
          {appointment?.provider && <p className="text-xs font-semibold text-dark dark:text-slate-100 mt-0.5">{appointment.provider.fullName}</p>}
        </div>
        <div className="text-center">
          <div className="border-b border-dark h-8 mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Clinic Stamp</p>
        </div>
      </div>

      <div className="mt-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
        <p className="text-[8px] text-slate-500 dark:text-slate-400 leading-relaxed">
          <strong>Note:</strong> This prescription was generated electronically via Sarang Business OS Lite and requires the
          practitioner's signature and clinic stamp to be valid. All content was entered by the practitioner.
        </p>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
        <p className="text-[9px] text-slate-400">Issued on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · {profile?.businessName ?? 'Medical Clinic'}</p>
        <p className="text-[9px] text-slate-300 mt-0.5 inline-flex items-center gap-1">
          Generated by Sarang Business OS Lite | Aszurex <AszurexMark width={10} /> | www.aszurex.com
        </p>
      </div>
    </div>
  )

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:hidden">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between print:hidden">
            <p className="text-sm font-semibold text-dark dark:text-slate-100">Prescription — Preview</p>
            <div className="flex items-center gap-2">
              <button onClick={() => window.print()} className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90 transition-colors">
                <Printer size={14} /> Print
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-dark dark:hover:text-slate-100 transition-colors">✕</button>
            </div>
          </div>
          <div className="p-8">{body}</div>
        </div>
      </div>
      <div className="hidden print:block fixed inset-0 bg-white dark:bg-slate-900 z-[9999] p-12">{body}</div>
    </>
  )
}

// ─── Referral Letter Print (Phase 58 §2) ────────────────────────────────────

function ReferralLetterPrint({ referral, patientName, patientAge, chiefComplaint, assessment, referringProvider, profile, onClose }: {
  referral: ReferralAppointment
  patientName: string
  patientAge: string
  chiefComplaint: string
  assessment: string
  referringProvider: { id: string; fullName: string; specialization: string | null } | null
  profile: BusinessProfile | null
  onClose: () => void
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const body = (
    <div style={{ fontFamily: 'Georgia, serif' }} className="relative text-dark dark:text-slate-100 text-sm">
      <DocumentWatermark logoPath={profile?.logoPath} enabled={profile?.enableDocumentWatermark} />
      <div className="text-center border-b-2 border-dark pb-4 mb-6">
        <p className="text-[10px] font-bold tracking-[0.3em] text-slate-500 dark:text-slate-400 uppercase mb-1">Referral Letter</p>
        {profile?.logoPath && (
          <img src={documentLogoUrl(profile.logoPath)} alt="" className="mx-auto mb-2" style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain' }} />
        )}
        <h1 className="text-2xl font-bold">{profile?.businessName ?? 'Medical Clinic'}</h1>
        {(profile?.address || profile?.city) && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{[profile?.address, profile?.city, profile?.state].filter(Boolean).join(', ')}</p>
        )}
        {(profile?.phone || profile?.email) && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{profile?.phone ? `Tel: ${profile.phone}` : ''}{profile?.phone && profile?.email ? '  ·  ' : ''}{profile?.email ?? ''}</p>
        )}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

      <p className="mb-1">To,</p>
      <p className="font-semibold mb-1">{referral.provider?.fullName ?? 'Referring Provider'}</p>
      {referral.provider?.specialization && <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{referral.provider.specialization}</p>}

      <p className="mb-4"><strong>Re: {patientName}</strong>{patientAge ? `, ${patientAge}` : ''}</p>

      <p className="leading-relaxed mb-4">
        Dear Dr. {referral.provider?.fullName?.split(' ').slice(-1)[0] ?? ''},
      </p>
      <p className="leading-relaxed mb-4">
        I am referring the above-named patient to your care, with an appointment scheduled for{' '}
        {new Date(referral.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} at {referral.scheduledTime}
        {referral.notes ? `, for the following reason: ${referral.notes}` : ' for further evaluation and management'}.
      </p>
      {(chiefComplaint || assessment) && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-800 mb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Clinical Summary</p>
          {chiefComplaint && <p className="text-xs text-slate-700 dark:text-slate-300">Chief Complaint: {chiefComplaint}</p>}
          {assessment && <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">Assessment: {assessment}</p>}
        </div>
      )}
      <p className="leading-relaxed mb-8">
        Please do not hesitate to contact me should you require any further information regarding this patient.
      </p>
      <p className="mb-1">Sincerely,</p>
      <div className="mt-8 pt-2 border-t border-dark w-56">
        <p className="text-xs font-semibold mt-1">{referringProvider?.fullName ?? profile?.businessName ?? ''}</p>
        {referringProvider?.specialization && <p className="text-xs text-slate-500 dark:text-slate-400">{referringProvider.specialization}</p>}
      </div>

      <div className="mt-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
        <p className="text-[8px] text-slate-500 dark:text-slate-400 leading-relaxed">
          <strong>Note:</strong> This letter was generated electronically via Sarang Business OS Lite and requires the
          practitioner's signature and clinic stamp to be valid.
        </p>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
        <p className="text-[9px] text-slate-300 inline-flex items-center gap-1">
          Generated by Sarang Business OS Lite | Aszurex <AszurexMark width={10} /> | www.aszurex.com
        </p>
      </div>
    </div>
  )

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:hidden">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between print:hidden">
            <p className="text-sm font-semibold text-dark dark:text-slate-100">Referral Letter — Preview</p>
            <div className="flex items-center gap-2">
              <button onClick={() => window.print()} className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90 transition-colors">
                <Printer size={14} /> Print
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-dark dark:hover:text-slate-100 transition-colors">✕</button>
            </div>
          </div>
          <div className="p-8">{body}</div>
        </div>
      </div>
      <div className="hidden print:block fixed inset-0 bg-white dark:bg-slate-900 z-[9999] p-12">{body}</div>
    </>
  )
}
