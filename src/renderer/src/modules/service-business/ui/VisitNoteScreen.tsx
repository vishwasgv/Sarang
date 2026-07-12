import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Lock, Printer, CheckCircle2, AlertTriangle } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { useIndustryStore } from '@app/store/industry.store'
import { Button } from '@shared/ui/atoms/Button'
import { Badge } from '@shared/ui/atoms/Badge'
import { cn } from '@shared/utils/cn'
import { AszurexMark } from '@shared/ui/atoms/Brand'
import { DocumentWatermark, documentLogoUrl } from '@shared/ui/molecules/DocumentWatermark'

interface Appointment {
  id: string
  appointmentNumber: string
  scheduledDate: string
  scheduledTime: string
  serviceTitle: string
  customerName: string | null
  customer: { id: string; customerName: string; phone: string | null } | null
  provider: { id: string; fullName: string; specialization: string | null } | null
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
  provider: { id: string; fullName: string; specialization: string | null } | null
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
          treatmentGiven: n.treatmentGiven ?? '',
          bpSystolic: n.bpSystolic !== null && n.bpSystolic !== undefined ? String(n.bpSystolic) : '',
          bpDiastolic: n.bpDiastolic !== null && n.bpDiastolic !== undefined ? String(n.bpDiastolic) : '',
          pulseRate: n.pulseRate !== null && n.pulseRate !== undefined ? String(n.pulseRate) : '',
          temperatureF: n.temperatureF !== null && n.temperatureF !== undefined ? String(n.temperatureF) : '',
          heightCm: n.heightCm !== null && n.heightCm !== undefined ? String(n.heightCm) : '',
          weightKg: n.weightKg !== null && n.weightKg !== undefined ? String(n.weightKg) : '',
        })
      } else if (res.data === null) {
        // No note yet — prefill patient name from appointment
        const apptRes = await api.appointments.get({ id: appointmentId })
        if (apptRes.success && apptRes.data) {
          const appt = apptRes.data as Appointment
          const name = appt.customerName ?? appt.customer?.customerName ?? ''
          setForm((f) => ({ ...f, patientName: name }))
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
                      <Badge variant={r.status === 'COMPLETED' ? 'success' : r.status === 'CANCELLED' || r.status === 'NO_SHOW' ? 'danger' : 'info'} size="sm">{r.status}</Badge>
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
        </div>
      </div>

      {/* Print modal */}
      {showPrint && note && (
        <VisitSummaryPrint
          note={{ ...note, ...form, painScore: form.painScore !== '' ? parseInt(form.painScore, 10) : null }}
          profile={profile}
          isSpecialist={isSpecialist}
          isDental={isDental}
          isPhysio={isPhysio}
          onClose={() => setShowPrint(false)}
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
const FLAG_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = { NORMAL: 'success', LOW: 'warning', HIGH: 'danger' }

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

interface PrintNote extends Omit<FormData, 'painScore'> {
  id: string
  finalizedAt: string | null
  appointment: Appointment | null
  painScore: number | null
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
