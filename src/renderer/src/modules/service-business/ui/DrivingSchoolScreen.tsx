import React, { useEffect, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { Plus, Car, User, ClipboardList, X, Search, Receipt, Package as PackageIcon, Trash2 } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { Card } from '@shared/ui/molecules/Card'
import { Tabs } from '@shared/ui/molecules/Tabs'
import { Badge } from '@shared/ui/atoms/Badge'
import { CustomerPicker } from '@shared/ui/molecules/CustomerPicker'
import { useNotificationStore } from '@app/store/notification.store'
import { toLocalISODate } from '@shared/utils/locale.util'

interface LearnerProfile {
  id: string
  customerId: string
  dlApplicationNumber: string | null
  learnerLicenseNumber: string | null
  learnerLicenseDate: string | null
  permanentLicenseNumber: string | null
  permanentLicenseDate: string | null
  licenseClass: string
  vehicleClassPreference: string | null
  customer: { id: string; customerName: string; phone: string | null; email: string | null }
}

interface DrivingVehicle {
  id: string
  registrationNumber: string
  make: string
  model: string
  vehicleClass: string
  status: string
  instructor: { id: string; fullName: string } | null
  odometerKm: number
  serviceIntervalKm: number
  serviceIntervalSessions: number
  lastServiceOdometerKm: number
  lastServiceDate: string | null
  sessionsSinceService: number
  dueForService: boolean
}

interface MaintenanceLog {
  id: string
  vehicleId: string
  serviceDate: string
  odometerKm: number
  serviceType: string
  cost: number | null
  notes: string | null
}

interface DrivingSession {
  id: string
  learnerId: string
  sessionDate: string
  sessionTime: string
  durationMinutes: number
  pickupPoint: string | null
  sessionNumber: number
  status: string
  instructorNotes: string | null
  sessionFee: number | null
  packageEnrollmentId: string | null
  invoiceId: string | null
  learner: { id: string; customerName: string; phone: string | null }
  instructor: { id: string; fullName: string }
  vehicle: { id: string; registrationNumber: string; make: string; model: string }
}

interface DrivingPackage {
  id: string
  packageName: string
  totalSessions: number
  price: number
  vehicleClass: string
  isActive: boolean
}

interface DrivingPackageEnrollment {
  id: string
  learnerId: string
  packageId: string
  sessionsUsed: number
  purchaseDate: string
  invoiceId: string | null
  notes: string | null
  learner: { id: string; customerName: string; phone: string | null }
  package: DrivingPackage
  _count?: { sessions: number }
}

interface DrivingTest {
  id: string
  learnerId: string
  testType: string
  testDate: string
  testCenter: string
  result: string
  retestDate: string | null
  notes: string | null
  learner: { id: string; customerName: string; phone: string | null }
  instructor: { id: string; fullName: string } | null
}

interface Employee { id: string; fullName: string }
interface Customer { id: string; customerName: string; phone: string | null }
interface InstructorPassRate { instructorId: string; instructorName: string; passed: number; failed: number; total: number; passRate: number }

const SESSION_STATUS_VARIANT: Record<string, 'info' | 'success' | 'neutral' | 'danger'> = {
  SCHEDULED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
  NO_SHOW: 'danger',
}

const TEST_RESULT_VARIANT: Record<string, 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  PASSED: 'success',
  FAILED: 'danger',
}

const VEHICLE_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'neutral'> = {
  ACTIVE: 'success',
  MAINTENANCE: 'warning',
  RETIRED: 'neutral',
}

const LICENSE_CLASSES = ['LMV', 'HMV', 'TWO_WHEELER', 'LMV_AND_TWO_WHEELER']
const VEHICLE_CLASSES = ['LMV', 'TWO_WHEELER', 'HMV']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function DrivingSchoolScreen() {
  const { error: toastError } = useNotificationStore()
  const location = useLocation()
  const [tab, setTab] = useState<'learners' | 'sessions' | 'vehicles' | 'tests' | 'packages'>(
    location.pathname === '/driving/sessions' ? 'sessions' : 'learners'
  )

  // Learners
  const [learnerSearch, setLearnerSearch] = useState('')
  const [selectedLearner, setSelectedLearner] = useState<LearnerProfile | null>(null)
  const [learnerForm, setLearnerForm] = useState({ dlApplicationNumber: '', learnerLicenseNumber: '', learnerLicenseDate: '', permanentLicenseNumber: '', permanentLicenseDate: '', licenseClass: 'LMV', vehicleClassPreference: '' })
  const [savingLearner, setSavingLearner] = useState(false)
  const [learnerError, setLearnerError] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])

  // Sessions
  const [sessions, setSessions] = useState<DrivingSession[]>([])
  const [sessionFilter, setSessionFilter] = useState<'all' | 'today' | 'SCHEDULED' | 'COMPLETED'>('today')
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [sessionForm, setSessionForm] = useState({ learnerId: '', instructorId: '', vehicleId: '', sessionDate: new Date().toISOString().slice(0, 10), sessionTime: '09:00', durationMinutes: 60, pickupPoint: '', sessionFee: '', packageEnrollmentId: '' })
  const [pickedSessionLearner, setPickedSessionLearner] = useState<Customer | null>(null)
  const [savingSession, setSavingSession] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [updatingSession, setUpdatingSession] = useState<string | null>(null)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [feeDrafts, setFeeDrafts] = useState<Record<string, string>>({})

  // Packages (Phase 41)
  const [packages, setPackages] = useState<DrivingPackage[]>([])
  const [enrollments, setEnrollments] = useState<DrivingPackageEnrollment[]>([])
  const [showPackageForm, setShowPackageForm] = useState(false)
  const [editPackage, setEditPackage] = useState<DrivingPackage | null>(null)
  const [packageForm, setPackageForm] = useState({ packageName: '', totalSessions: 10, price: 0, vehicleClass: 'LMV', isActive: true })
  const [savingPackage, setSavingPackage] = useState(false)
  const [packageError, setPackageError] = useState<string | null>(null)
  const [showEnrollForm, setShowEnrollForm] = useState(false)
  const [enrollForm, setEnrollForm] = useState({ learnerId: '', packageId: '' })
  const [pickedEnrollLearner, setPickedEnrollLearner] = useState<Customer | null>(null)
  const [savingEnroll, setSavingEnroll] = useState(false)
  const [enrollError, setEnrollError] = useState<string | null>(null)

  // Vehicles
  const [vehicles, setVehicles] = useState<DrivingVehicle[]>([])
  const [showVehicleForm, setShowVehicleForm] = useState(false)
  const [editVehicle, setEditVehicle] = useState<DrivingVehicle | null>(null)
  const [vehicleForm, setVehicleForm] = useState({ registrationNumber: '', make: '', model: '', vehicleClass: 'LMV', instructorId: '', status: 'ACTIVE', odometerKm: 0, serviceIntervalKm: 5000, serviceIntervalSessions: 30 })
  const [savingVehicle, setSavingVehicle] = useState(false)
  const [vehicleError, setVehicleError] = useState<string | null>(null)

  // Vehicle maintenance (Phase 58 §2)
  const [maintenanceVehicle, setMaintenanceVehicle] = useState<DrivingVehicle | null>(null)
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([])
  const [maintenanceForm, setMaintenanceForm] = useState({ serviceDate: new Date().toISOString().slice(0, 10), odometerKm: 0, serviceType: '', cost: '', notes: '' })
  const [savingMaintenance, setSavingMaintenance] = useState(false)
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null)

  // Tests
  const [tests, setTests] = useState<DrivingTest[]>([])
  const [passRates, setPassRates] = useState<InstructorPassRate[]>([])
  const [showTestForm, setShowTestForm] = useState(false)
  const [testForm, setTestForm] = useState({ learnerId: '', testType: 'LL_TEST', testDate: new Date().toISOString().slice(0, 10), testCenter: '', notes: '', instructorId: '' })
  const [pickedTestLearner, setPickedTestLearner] = useState<Customer | null>(null)
  const [savingTest, setSavingTest] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadEmployees = useCallback(async () => {
    try {
      const res = await api.hr.listEmployees({ isActive: true })
      if (res.success) setEmployees((res.data as { employees: Employee[] }).employees ?? (res.data as Employee[]))
      else toastError('Error', res.error?.message ?? 'Could not load instructors.')
    } catch { toastError('Error', 'Could not load instructors.') }
  }, [toastError])

  const loadCustomers = useCallback(async () => {
    try {
      const res = await api.customers.list({ limit: 1000 })
      if (res.success) setCustomers((res.data as { customers: Customer[] }).customers ?? [])
      else toastError('Error', res.error?.message ?? 'Could not load customers.')
    } catch { toastError('Error', 'Could not load customers.') }
  }, [toastError])

  const loadLearners = useCallback(async () => {
    // Learner profiles are loaded via customer list + per-customer fetch
    // For the list view, we show all customers and let user click to see profile
    await loadCustomers()
  }, [loadCustomers])

  const loadSessions = useCallback(async () => {
    setLoading(true)
    setError(null)
    const filters: Record<string, unknown> = {}
    // Real bug found live 2026-07-22: toISOString() extracts the UTC calendar
    // date, wrongly querying "yesterday" during the ~5.5h window after local
    // midnight in IST. See src/main/utils/date.util.ts for the full writeup.
    if (sessionFilter === 'today') filters.date = toLocalISODate(new Date())
    else if (sessionFilter !== 'all') filters.status = sessionFilter
    const res = await api.drivingSession.list(filters)
    if (res.success) setSessions(res.data as DrivingSession[])
    else setError(res.error?.message ?? 'Could not load sessions.')
    setLoading(false)
  }, [sessionFilter])

  const loadVehicles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.drivingVehicle.list()
      if (res.success) setVehicles(res.data as DrivingVehicle[])
      else toastError('Error', res.error?.message ?? 'Could not load vehicles.')
    } catch {
      toastError('Error', 'Could not load vehicles.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  const loadTests = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.drivingSession.listTests()
      if (res.success) setTests(res.data as DrivingTest[])
      else toastError('Error', res.error?.message ?? 'Could not load tests.')
    } catch {
      toastError('Error', 'Could not load tests.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  const loadPassRates = useCallback(async () => {
    const res = await api.drivingSession.instructorPassRates()
    if (res.success) setPassRates(res.data as InstructorPassRate[])
  }, [])

  const loadPackages = useCallback(async () => {
    try {
      const res = await api.drivingPackage.list()
      if (res.success) setPackages(res.data as DrivingPackage[])
      else toastError('Error', res.error?.message ?? 'Could not load packages.')
    } catch { toastError('Error', 'Could not load packages.') }
  }, [toastError])

  const loadEnrollments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.drivingPackageEnrollment.list()
      if (res.success) setEnrollments(res.data as DrivingPackageEnrollment[])
      else toastError('Error', res.error?.message ?? 'Could not load enrollments.')
    } catch {
      toastError('Error', 'Could not load enrollments.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => {
    if (tab === 'learners') loadLearners()
    else if (tab === 'sessions') { loadSessions(); loadEmployees(); loadVehicles(); loadCustomers(); loadPackages(); loadEnrollments() }
    else if (tab === 'vehicles') { loadVehicles(); loadEmployees() }
    else if (tab === 'tests') { loadTests(); loadCustomers(); loadEmployees(); loadPassRates() }
    else if (tab === 'packages') { loadPackages(); loadEnrollments(); loadCustomers() }
  }, [tab, loadLearners, loadSessions, loadVehicles, loadTests, loadEmployees, loadCustomers, loadPackages, loadEnrollments])

  // Keep session-fee draft inputs in sync with the loaded sessions whenever
  // they reload — mirrors the selection-staleness fix applied to other
  // multi-input lists this phase.
  useEffect(() => {
    setFeeDrafts((prev) => {
      const next: Record<string, string> = {}
      for (const s of sessions) {
        next[s.id] = prev[s.id] ?? (s.sessionFee != null ? String(s.sessionFee) : '')
      }
      return next
    })
  }, [sessions])

  async function handleSelectLearner(customerId: string) {
    const res = await api.learnerProfile.get({ customerId })
    const c = customers.find((cu) => cu.id === customerId)
    if (res.success && res.data) {
      setSelectedLearner(res.data as LearnerProfile)
      const p = res.data as LearnerProfile
      setLearnerForm({
        dlApplicationNumber: p.dlApplicationNumber ?? '',
        learnerLicenseNumber: p.learnerLicenseNumber ?? '',
        learnerLicenseDate: p.learnerLicenseDate ? p.learnerLicenseDate.slice(0, 10) : '',
        permanentLicenseNumber: p.permanentLicenseNumber ?? '',
        permanentLicenseDate: p.permanentLicenseDate ? p.permanentLicenseDate.slice(0, 10) : '',
        licenseClass: p.licenseClass,
        vehicleClassPreference: p.vehicleClassPreference ?? '',
      })
    } else if (c) {
      setSelectedLearner({ id: '', customerId, dlApplicationNumber: null, learnerLicenseNumber: null, learnerLicenseDate: null, permanentLicenseNumber: null, permanentLicenseDate: null, licenseClass: 'LMV', vehicleClassPreference: null, customer: { id: c.id, customerName: c.customerName, phone: c.phone, email: null } })
      setLearnerForm({ dlApplicationNumber: '', learnerLicenseNumber: '', learnerLicenseDate: '', permanentLicenseNumber: '', permanentLicenseDate: '', licenseClass: 'LMV', vehicleClassPreference: '' })
    }
    setLearnerError(null)
  }

  async function handleSaveLearner() {
    if (!selectedLearner) return
    setSavingLearner(true)
    setLearnerError(null)
    const res = await api.learnerProfile.upsert({
      customerId: selectedLearner.customerId,
      dlApplicationNumber: learnerForm.dlApplicationNumber || null,
      learnerLicenseNumber: learnerForm.learnerLicenseNumber || null,
      learnerLicenseDate: learnerForm.learnerLicenseDate || null,
      permanentLicenseNumber: learnerForm.permanentLicenseNumber || null,
      permanentLicenseDate: learnerForm.permanentLicenseDate || null,
      licenseClass: learnerForm.licenseClass,
      vehicleClassPreference: learnerForm.vehicleClassPreference || null,
    })
    setSavingLearner(false)
    if (res.success) {
      setSelectedLearner(res.data as LearnerProfile)
    } else {
      setLearnerError(res.error?.message ?? 'Could not save learner profile.')
    }
  }

  async function handleCreateSession() {
    if (!sessionForm.learnerId || !sessionForm.instructorId || !sessionForm.vehicleId) {
      setSessionError('Learner, instructor, and vehicle are required.')
      return
    }
    setSavingSession(true)
    setSessionError(null)
    const res = await api.drivingSession.create({
      learnerId: sessionForm.learnerId,
      instructorId: sessionForm.instructorId,
      vehicleId: sessionForm.vehicleId,
      sessionDate: sessionForm.sessionDate,
      sessionTime: sessionForm.sessionTime,
      durationMinutes: Number(sessionForm.durationMinutes),
      pickupPoint: sessionForm.pickupPoint || undefined,
      sessionFee: sessionForm.packageEnrollmentId ? undefined : (sessionForm.sessionFee ? Number(sessionForm.sessionFee) : undefined),
      packageEnrollmentId: sessionForm.packageEnrollmentId || undefined,
    })
    setSavingSession(false)
    if (res.success) {
      setShowSessionForm(false)
      setSessionForm((f) => ({ ...f, sessionFee: '', packageEnrollmentId: '' }))
      loadSessions()
    } else {
      setSessionError(res.error?.message ?? 'Could not create session.')
    }
  }

  async function handleSessionStatus(id: string, status: string) {
    setUpdatingSession(id)
    try {
      const res = await api.drivingSession.update({ id, status })
      if (res.success) loadSessions()
      else toastError('Error', res.error?.message ?? 'Could not update session status.')
    } catch {
      toastError('Error', 'Could not update session status.')
    } finally {
      setUpdatingSession(null)
    }
  }

  async function handleSaveSessionFee(id: string) {
    const draft = feeDrafts[id]
    const fee = draft ? Number(draft) : null
    setInvoiceError(null)
    const res = await api.drivingSession.update({ id, sessionFee: fee })
    if (!res.success) setInvoiceError(res.error?.message ?? 'Could not save session fee.')
    else loadSessions()
  }

  async function handleGenerateSessionInvoice(id: string) {
    setInvoiceError(null)
    setGeneratingId(id)
    const res = await api.drivingSession.generateInvoice({ id })
    if (res.success) loadSessions()
    else setInvoiceError(res.error?.message ?? 'Could not generate invoice.')
    setGeneratingId(null)
  }

  async function handleSaveVehicle() {
    if (!vehicleForm.registrationNumber || !vehicleForm.make || !vehicleForm.model) {
      setVehicleError('Registration, make, and model are required.')
      return
    }
    setSavingVehicle(true)
    setVehicleError(null)
    const payload = {
      registrationNumber: vehicleForm.registrationNumber, make: vehicleForm.make, model: vehicleForm.model,
      vehicleClass: vehicleForm.vehicleClass, instructorId: vehicleForm.instructorId || undefined, status: vehicleForm.status,
      odometerKm: vehicleForm.odometerKm, serviceIntervalKm: vehicleForm.serviceIntervalKm, serviceIntervalSessions: vehicleForm.serviceIntervalSessions,
    }
    const res = editVehicle
      ? await api.drivingVehicle.update({ id: editVehicle.id, ...payload })
      : await api.drivingVehicle.create(payload)
    setSavingVehicle(false)
    if (res.success) {
      setShowVehicleForm(false)
      loadVehicles()
    } else {
      setVehicleError(res.error?.message ?? 'Could not save vehicle.')
    }
  }

  // ── Vehicle Maintenance (Phase 58 §2) ───────────────────────────────────────

  async function openMaintenance(v: DrivingVehicle) {
    setMaintenanceVehicle(v)
    setMaintenanceForm({ serviceDate: new Date().toISOString().slice(0, 10), odometerKm: v.odometerKm, serviceType: '', cost: '', notes: '' })
    setMaintenanceError(null)
    const res = await api.drivingVehicle.listMaintenanceLogs({ vehicleId: v.id })
    if (res.success) setMaintenanceLogs(res.data as MaintenanceLog[])
    else setMaintenanceLogs([])
  }

  async function handleLogMaintenance() {
    if (!maintenanceVehicle) return
    if (!maintenanceForm.serviceType.trim()) { setMaintenanceError('Service type is required.'); return }
    setSavingMaintenance(true)
    setMaintenanceError(null)
    const res = await api.drivingVehicle.logMaintenance({
      vehicleId: maintenanceVehicle.id,
      serviceDate: maintenanceForm.serviceDate,
      odometerKm: maintenanceForm.odometerKm,
      serviceType: maintenanceForm.serviceType,
      cost: maintenanceForm.cost ? Number(maintenanceForm.cost) : undefined,
      notes: maintenanceForm.notes || undefined,
    })
    setSavingMaintenance(false)
    if (res.success) {
      loadVehicles()
      const logsRes = await api.drivingVehicle.listMaintenanceLogs({ vehicleId: maintenanceVehicle.id })
      if (logsRes.success) setMaintenanceLogs(logsRes.data as MaintenanceLog[])
      setMaintenanceForm({ serviceDate: new Date().toISOString().slice(0, 10), odometerKm: maintenanceForm.odometerKm, serviceType: '', cost: '', notes: '' })
    } else {
      setMaintenanceError(res.error?.message ?? 'Could not log maintenance.')
    }
  }

  async function handleCreateTest() {
    if (!testForm.learnerId || !testForm.testDate || !testForm.testCenter) {
      setTestError('Learner, date, and test center are required.')
      return
    }
    setSavingTest(true)
    setTestError(null)
    const res = await api.drivingSession.createTest({
      learnerId: testForm.learnerId,
      testType: testForm.testType,
      testDate: testForm.testDate,
      testCenter: testForm.testCenter,
      notes: testForm.notes || undefined,
      instructorId: testForm.instructorId || undefined,
    })
    setSavingTest(false)
    if (res.success) {
      setShowTestForm(false)
      loadTests()
    } else {
      setTestError(res.error?.message ?? 'Could not schedule test.')
    }
  }

  async function handleUpdateTestResult(id: string, result: string) {
    try {
      const res = await api.drivingSession.updateTest({ id, result })
      if (res.success) { loadTests(); loadPassRates() }
      else toastError('Error', res.error?.message ?? 'Could not update test result.')
    } catch {
      toastError('Error', 'Could not update test result.')
    }
  }

  // ── Packages (Phase 41) ─────────────────────────────────────────────────────

  function openPackageForm(pkg?: DrivingPackage) {
    setEditPackage(pkg ?? null)
    setPackageForm({
      packageName: pkg?.packageName ?? '',
      totalSessions: pkg?.totalSessions ?? 10,
      price: pkg?.price ?? 0,
      vehicleClass: pkg?.vehicleClass ?? 'LMV',
      isActive: pkg?.isActive ?? true,
    })
    setPackageError(null)
    setShowPackageForm(true)
  }

  async function handleSavePackage() {
    if (!packageForm.packageName.trim()) { setPackageError('Package name is required.'); return }
    if (packageForm.totalSessions < 1) { setPackageError('Sessions must be at least 1.'); return }
    setSavingPackage(true)
    setPackageError(null)
    const payload = { packageName: packageForm.packageName, totalSessions: Number(packageForm.totalSessions), price: Number(packageForm.price), vehicleClass: packageForm.vehicleClass, isActive: packageForm.isActive }
    const res = editPackage
      ? await api.drivingPackage.update({ id: editPackage.id, ...payload })
      : await api.drivingPackage.create(payload)
    setSavingPackage(false)
    if (res.success) {
      setShowPackageForm(false)
      loadPackages()
    } else {
      setPackageError(res.error?.message ?? 'Could not save package.')
    }
  }

  async function handleDeletePackage(id: string) {
    const res = await api.drivingPackage.delete({ id })
    if (!res.success) setPackageError(res.error?.message ?? 'Could not delete package.')
    else loadPackages()
  }

  async function handleCreateEnrollment() {
    if (!enrollForm.learnerId || !enrollForm.packageId) { setEnrollError('Learner and package are required.'); return }
    setSavingEnroll(true)
    setEnrollError(null)
    const res = await api.drivingPackageEnrollment.create({ learnerId: enrollForm.learnerId, packageId: enrollForm.packageId })
    setSavingEnroll(false)
    if (res.success) {
      setShowEnrollForm(false)
      setEnrollForm({ learnerId: '', packageId: '' })
      loadEnrollments()
    } else {
      setEnrollError(res.error?.message ?? 'Could not enroll learner.')
    }
  }

  async function handleDeleteEnrollment(id: string) {
    const res = await api.drivingPackageEnrollment.delete({ id })
    if (!res.success) setPackageError(res.error?.message ?? 'Could not delete enrollment.')
    else loadEnrollments()
  }

  async function handleGeneratePackageInvoice(id: string) {
    setInvoiceError(null)
    setGeneratingId(id)
    const res = await api.drivingPackageEnrollment.generateInvoice({ id })
    if (res.success) loadEnrollments()
    else setInvoiceError(res.error?.message ?? 'Could not generate invoice.')
    setGeneratingId(null)
  }

  const filteredCustomers = customers.filter((c) =>
    !learnerSearch || c.customerName.toLowerCase().includes(learnerSearch.toLowerCase()) || (c.phone ?? '').includes(learnerSearch)
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Driving School</h1>
          <p className="text-sm text-muted-foreground">Manage learners, sessions, vehicles, and tests</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'sessions' && <button onClick={() => setShowSessionForm(true)} className="h-10 px-4 bg-primary text-primary-foreground rounded-xl text-sm font-medium flex items-center gap-2"><Plus size={16} /> Schedule Session</button>}
          {tab === 'vehicles' && <button onClick={() => { setEditVehicle(null); setVehicleForm({ registrationNumber: '', make: '', model: '', vehicleClass: 'LMV', instructorId: '', status: 'ACTIVE', odometerKm: 0, serviceIntervalKm: 5000, serviceIntervalSessions: 30 }); setVehicleError(null); setShowVehicleForm(true); loadEmployees() }} className="h-10 px-4 bg-primary text-primary-foreground rounded-xl text-sm font-medium flex items-center gap-2"><Plus size={16} /> Add Vehicle</button>}
          {tab === 'tests' && <button onClick={() => { setShowTestForm(true); setTestError(null); setPickedTestLearner(null); setTestForm({ learnerId: '', testType: 'LL_TEST', testDate: new Date().toISOString().slice(0, 10), testCenter: '', notes: '', instructorId: '' }) }} className="h-10 px-4 bg-primary text-primary-foreground rounded-xl text-sm font-medium flex items-center gap-2"><Plus size={16} /> Schedule Test</button>}
          {tab === 'packages' && (
            <>
              <button onClick={() => { setShowEnrollForm(true); setEnrollError(null); loadCustomers() }} className="h-10 px-4 rounded-xl border border-border text-sm font-medium flex items-center gap-2 text-foreground hover:bg-muted/50"><Plus size={16} /> Enroll Learner</button>
              <button onClick={() => openPackageForm()} className="h-10 px-4 bg-primary text-primary-foreground rounded-xl text-sm font-medium flex items-center gap-2"><Plus size={16} /> New Package</button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'learners', label: 'Learners' },
          { id: 'sessions', label: 'Sessions' },
          { id: 'vehicles', label: 'Vehicles' },
          { id: 'tests', label: 'Tests' },
          { id: 'packages', label: 'Packages' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {error && <div className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{error}</div>}
      {invoiceError && <div className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{invoiceError}</div>}

      {/* Learners Tab */}
      {tab === 'learners' && (
        <div className="flex gap-6">
          {/* Left: Customer List */}
          <div className="w-72 shrink-0 space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={learnerSearch} onChange={(e) => setLearnerSearch(e.target.value)} placeholder="Search learner..." className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-card text-sm text-foreground" />
            </div>
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {filteredCustomers.slice(0, 50).map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelectLearner(c.id)}
                  className={cn('w-full text-left px-3 py-3 rounded-xl border transition-colors', selectedLearner?.customerId === c.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/30')}
                >
                  <p className="text-sm font-medium text-foreground">{c.customerName}</p>
                  {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                </button>
              ))}
              {filteredCustomers.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No customers found</p>}
            </div>
          </div>

          {/* Right: Learner Profile Form */}
          {selectedLearner ? (
            <Card padding="lg" className="flex-1 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{selectedLearner.customer.customerName}</h2>
                  {selectedLearner.customer.phone && <p className="text-sm text-muted-foreground">{selectedLearner.customer.phone}</p>}
                </div>
                <span className="text-xs bg-muted/30 text-muted-foreground rounded-full px-3 py-1">{selectedLearner.licenseClass}</span>
              </div>

              {learnerError && <div className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{learnerError}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">License Class</label>
                  <select value={learnerForm.licenseClass} onChange={(e) => setLearnerForm({ ...learnerForm, licenseClass: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground">
                    {LICENSE_CLASSES.map((l) => <option key={l} value={l}>{l.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Vehicle Class Preference</label>
                  <input value={learnerForm.vehicleClassPreference} onChange={(e) => setLearnerForm({ ...learnerForm, vehicleClassPreference: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" placeholder="LMV, 2-Wheeler..." />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">DL Application Number</label>
                  <input value={learnerForm.dlApplicationNumber} onChange={(e) => setLearnerForm({ ...learnerForm, dlApplicationNumber: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" placeholder="LL/DL application no." />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Learner License No.</label>
                  <input value={learnerForm.learnerLicenseNumber} onChange={(e) => setLearnerForm({ ...learnerForm, learnerLicenseNumber: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">LL Issue Date</label>
                  <input type="date" value={learnerForm.learnerLicenseDate} onChange={(e) => setLearnerForm({ ...learnerForm, learnerLicenseDate: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Permanent License No.</label>
                  <input value={learnerForm.permanentLicenseNumber} onChange={(e) => setLearnerForm({ ...learnerForm, permanentLicenseNumber: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">DL Issue Date</label>
                  <input type="date" value={learnerForm.permanentLicenseDate} onChange={(e) => setLearnerForm({ ...learnerForm, permanentLicenseDate: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" />
                </div>
              </div>

              <button onClick={handleSaveLearner} disabled={savingLearner} className="h-11 px-6 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50">
                {savingLearner ? 'Saving...' : 'Save Profile'}
              </button>
            </Card>
          ) : (
            <Card className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <User size={32} className="mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">Select a learner to view profile</p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Sessions Tab */}
      {tab === 'sessions' && (
        <div className="space-y-3">
          <Tabs
            tabs={(['today', 'all', 'SCHEDULED', 'COMPLETED'] as const).map((f) => ({
              id: f,
              label: f === 'today' ? 'Today' : f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase(),
            }))}
            active={sessionFilter}
            onChange={setSessionFilter}
          />

          {loading ? <div className="p-12 text-center text-muted-foreground text-sm">Loading...</div> : (
            <Card padding="none" className="overflow-hidden">
              {sessions.length === 0 ? (
                <div className="p-12 text-center">
                  <Car size={32} className="mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-muted-foreground">No sessions found</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Learner</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date & Time</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Instructor</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vehicle</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Session #</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Fee / Invoice</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{s.learner.customerName}</p>
                          {s.pickupPoint && <p className="text-xs text-muted-foreground">Pickup: {s.pickupPoint}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-foreground">{formatDate(s.sessionDate)}</p>
                          <p className="text-xs text-muted-foreground">{s.sessionTime} · {s.durationMinutes}m</p>
                        </td>
                        <td className="px-4 py-3 text-foreground">{s.instructor.fullName}</td>
                        <td className="px-4 py-3">
                          <p className="text-foreground">{s.vehicle.registrationNumber}</p>
                          <p className="text-xs text-muted-foreground">{s.vehicle.make} {s.vehicle.model}</p>
                        </td>
                        <td className="px-4 py-3 text-center text-foreground font-medium">#{s.sessionNumber}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={SESSION_STATUS_VARIANT[s.status] ?? 'neutral'} size="sm">{s.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {s.packageEnrollmentId ? (
                            <span className="text-xs text-muted-foreground">Via package</span>
                          ) : s.invoiceId ? (
                            <span className="text-xs text-success font-medium">Invoiced</span>
                          ) : (
                            <input
                              type="number" min="0" step="0.01" placeholder="Fee"
                              value={feeDrafts[s.id] ?? ''}
                              onChange={(e) => setFeeDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))}
                              onBlur={() => handleSaveSessionFee(s.id)}
                              className="w-20 h-8 px-2 text-xs text-center rounded-lg border border-border bg-background text-foreground"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {s.status === 'SCHEDULED' && (
                              <>
                                <button onClick={() => handleSessionStatus(s.id, 'COMPLETED')} disabled={updatingSession === s.id} className="text-xs text-success border border-success/30 rounded-lg px-2 py-1 hover:bg-success/5 disabled:opacity-50">Done</button>
                                <button onClick={() => handleSessionStatus(s.id, 'NO_SHOW')} disabled={updatingSession === s.id} className="text-xs text-danger border border-danger/30 rounded-lg px-2 py-1 hover:bg-danger/5 disabled:opacity-50">No Show</button>
                              </>
                            )}
                            {!s.packageEnrollmentId && !s.invoiceId && s.sessionFee != null && s.sessionFee > 0 && (
                              <button
                                onClick={() => handleGenerateSessionInvoice(s.id)}
                                disabled={generatingId === s.id}
                                title="Generate Invoice"
                                className="p-1.5 text-muted-foreground hover:text-success hover:bg-success/5 rounded-lg transition-colors disabled:opacity-50"
                              >
                                <Receipt size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Vehicles Tab */}
      {tab === 'vehicles' && (
        <div className="grid grid-cols-3 gap-4">
          {loading ? <div className="col-span-3 p-12 text-center text-muted-foreground text-sm">Loading...</div> : (
            <>
              {vehicles.map((v) => (
                <Card key={v.id} padding="lg" className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-foreground text-lg">{v.registrationNumber}</p>
                      <p className="text-sm text-foreground">{v.make} {v.model}</p>
                    </div>
                    <Badge variant={VEHICLE_STATUS_VARIANT[v.status] ?? 'neutral'} size="sm">{v.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="bg-muted/30 px-2 py-0.5 rounded-full">{v.vehicleClass}</span>
                    {v.instructor && <span>{v.instructor.fullName}</span>}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{v.odometerKm.toLocaleString('en-IN')} km · {v.sessionsSinceService} sessions since service</span>
                    {v.dueForService && <Badge variant="warning" size="sm">Due for service</Badge>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditVehicle(v)
                        setVehicleForm({
                          registrationNumber: v.registrationNumber, make: v.make, model: v.model, vehicleClass: v.vehicleClass,
                          instructorId: v.instructor?.id ?? '', status: v.status,
                          odometerKm: v.odometerKm, serviceIntervalKm: v.serviceIntervalKm, serviceIntervalSessions: v.serviceIntervalSessions,
                        })
                        setVehicleError(null)
                        setShowVehicleForm(true)
                      }}
                      className="flex-1 h-8 rounded-lg border border-border text-xs text-foreground hover:bg-muted/50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openMaintenance(v)}
                      className="flex-1 h-8 rounded-lg border border-border text-xs text-foreground hover:bg-muted/50"
                    >
                      Maintenance
                    </button>
                  </div>
                </Card>
              ))}
              {vehicles.length === 0 && (
                <Card padding="lg" className="col-span-3 text-center">
                  <Car size={32} className="mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-muted-foreground">No vehicles registered. Add the school's fleet.</p>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* Tests Tab */}
      {tab === 'tests' && (
        <div className="space-y-4">
          {passRates.length > 0 && (
            <Card padding="lg">
              <p className="text-sm font-semibold text-foreground mb-3">Pass Rate by Instructor</p>
              <div className="grid grid-cols-3 gap-3">
                {passRates.map((r) => (
                  <div key={r.instructorId} className="border border-border rounded-xl px-3 py-2">
                    <p className="text-sm font-medium text-foreground">{r.instructorName}</p>
                    <p className="text-xs text-muted-foreground">{r.passed}/{r.total} passed</p>
                    <p className={cn('text-lg font-bold', r.passRate >= 70 ? 'text-success' : r.passRate >= 40 ? 'text-warning' : 'text-danger')}>{r.passRate}%</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card padding="none" className="overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Loading...</div>
          ) : tests.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardList size={32} className="mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">No tests scheduled yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Learner</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Test Center</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Instructor</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Result</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{t.learner.customerName}</p>
                      {t.learner.phone && <p className="text-xs text-muted-foreground">{t.learner.phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-foreground">{t.testType.replace('_', ' ')}</td>
                    <td className="px-4 py-3">
                      <p className="text-foreground">{formatDate(t.testDate)}</p>
                      {t.retestDate && <p className="text-xs text-warning">Retest: {formatDate(t.retestDate)}</p>}
                    </td>
                    <td className="px-4 py-3 text-foreground">{t.testCenter}</td>
                    <td className="px-4 py-3 text-foreground">{t.instructor?.fullName ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={TEST_RESULT_VARIANT[t.result] ?? 'neutral'} size="sm">{t.result}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {t.result === 'PENDING' && (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleUpdateTestResult(t.id, 'PASSED')} className="text-xs text-success border border-success/30 rounded-lg px-2 py-1 hover:bg-success/5">Pass</button>
                          <button onClick={() => handleUpdateTestResult(t.id, 'FAILED')} className="text-xs text-danger border border-danger/30 rounded-lg px-2 py-1 hover:bg-danger/5">Fail</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </Card>
        </div>
      )}

      {/* Packages Tab (Phase 41) */}
      {tab === 'packages' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Package Catalog</h2>
            <div className="grid grid-cols-3 gap-4">
              {packages.map((pkg) => (
                <Card key={pkg.id} padding="lg" className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{pkg.packageName}</p>
                      <p className="text-xs text-muted-foreground">{pkg.totalSessions} sessions · {pkg.vehicleClass}</p>
                    </div>
                    {!pkg.isActive && <Badge variant="neutral" size="sm">Inactive</Badge>}
                  </div>
                  <p className="text-xl font-bold text-foreground">₹{Number(pkg.price).toLocaleString('en-IN')}</p>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => openPackageForm(pkg)} className="flex-1 h-8 rounded-lg border border-border text-xs text-foreground hover:bg-muted/50">Edit</button>
                    <button onClick={() => handleDeletePackage(pkg.id)} className="h-8 px-3 rounded-lg border border-danger/30 text-xs text-danger hover:bg-danger/5"><Trash2 size={12} /></button>
                  </div>
                </Card>
              ))}
              {packages.length === 0 && (
                <Card padding="lg" className="col-span-3 text-center">
                  <PackageIcon size={28} className="mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-muted-foreground text-sm">No packages yet. Create one to sell N-lesson bundles.</p>
                </Card>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Learner Enrollments</h2>
            {packageError && <div className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2 mb-3">{packageError}</div>}
            <Card padding="none" className="overflow-hidden">
              {loading ? (
                <div className="p-12 text-center text-muted-foreground text-sm">Loading...</div>
              ) : enrollments.length === 0 ? (
                <div className="p-12 text-center">
                  <User size={32} className="mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-muted-foreground">No learners enrolled in a package yet</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Learner</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Package</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Sessions Used</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Purchased</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Invoice</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((e) => (
                      <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{e.learner.customerName}</p>
                          {e.learner.phone && <p className="text-xs text-muted-foreground">{e.learner.phone}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-foreground">{e.package.packageName}</p>
                          <p className="text-xs text-muted-foreground">₹{Number(e.package.price).toLocaleString('en-IN')}</p>
                        </td>
                        <td className="px-4 py-3 text-center text-foreground">{e.sessionsUsed} / {e.package.totalSessions}</td>
                        <td className="px-4 py-3 text-foreground">{formatDate(e.purchaseDate)}</td>
                        <td className="px-4 py-3 text-center">
                          {e.invoiceId ? <span className="text-xs text-success font-medium">Invoiced</span> : <span className="text-xs text-muted-foreground">Pending</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {!e.invoiceId && Number(e.package.price) > 0 && (
                              <button
                                onClick={() => handleGeneratePackageInvoice(e.id)}
                                disabled={generatingId === e.id}
                                title="Generate Invoice"
                                className="p-1.5 text-muted-foreground hover:text-success hover:bg-success/5 rounded-lg transition-colors disabled:opacity-50"
                              >
                                <Receipt size={14} />
                              </button>
                            )}
                            {!e.invoiceId && (
                              <button onClick={() => handleDeleteEnrollment(e.id)} className="p-1.5 text-muted-foreground hover:text-danger hover:bg-danger/5 rounded-lg transition-colors">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Session Form Modal */}
      {showSessionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Schedule Session</h2>
              <button onClick={() => setShowSessionForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            {sessionError && <div className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{sessionError}</div>}
            <div className="space-y-3">
              <CustomerPicker
                label="Learner *"
                value={pickedSessionLearner}
                onChange={(c) => { setPickedSessionLearner(c); setSessionForm({ ...sessionForm, learnerId: c?.id ?? '', packageEnrollmentId: '' }) }}
                placeholder="Search by name or phone..."
              />
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Instructor *</label>
                <select value={sessionForm.instructorId} onChange={(e) => setSessionForm({ ...sessionForm, instructorId: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground">
                  <option value="">Select instructor...</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Vehicle *</label>
                <select value={sessionForm.vehicleId} onChange={(e) => setSessionForm({ ...sessionForm, vehicleId: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground">
                  <option value="">Select vehicle...</option>
                  {vehicles.filter((v) => v.status === 'ACTIVE').map((v) => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.make} {v.model}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Date *</label>
                  <input type="date" value={sessionForm.sessionDate} onChange={(e) => setSessionForm({ ...sessionForm, sessionDate: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Time *</label>
                  <input type="time" value={sessionForm.sessionTime} onChange={(e) => setSessionForm({ ...sessionForm, sessionTime: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Duration (minutes)</label>
                  <input type="number" min="15" step="15" value={sessionForm.durationMinutes} onChange={(e) => setSessionForm({ ...sessionForm, durationMinutes: Number(e.target.value) })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Pickup Point</label>
                  <input value={sessionForm.pickupPoint} onChange={(e) => setSessionForm({ ...sessionForm, pickupPoint: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" placeholder="Address or landmark" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Redeem from Package (optional)</label>
                <select
                  value={sessionForm.packageEnrollmentId}
                  onChange={(e) => setSessionForm({ ...sessionForm, packageEnrollmentId: e.target.value, sessionFee: e.target.value ? '' : sessionForm.sessionFee })}
                  className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground"
                >
                  <option value="">None — bill this session on its own</option>
                  {enrollments.filter((e) => e.learnerId === sessionForm.learnerId && e.sessionsUsed < e.package.totalSessions).map((e) => (
                    <option key={e.id} value={e.id}>{e.package.packageName} ({e.package.totalSessions - e.sessionsUsed} left)</option>
                  ))}
                </select>
              </div>
              {!sessionForm.packageEnrollmentId && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Session Fee (₹, optional — for invoicing)</label>
                  <input type="number" min="0" step="0.01" value={sessionForm.sessionFee} onChange={(e) => setSessionForm({ ...sessionForm, sessionFee: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" placeholder="e.g. 500" />
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowSessionForm(false)} className="flex-1 h-11 rounded-xl border border-border text-sm text-foreground hover:bg-muted/50">Cancel</button>
              <button onClick={handleCreateSession} disabled={savingSession} className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50">
                {savingSession ? 'Scheduling...' : 'Schedule Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Form Modal */}
      {showVehicleForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{editVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
              <button onClick={() => setShowVehicleForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            {vehicleError && <div className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{vehicleError}</div>}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Registration Number *</label>
                <input value={vehicleForm.registrationNumber} onChange={(e) => setVehicleForm({ ...vehicleForm, registrationNumber: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground uppercase" placeholder="MH01AB1234" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Make *</label>
                  <input value={vehicleForm.make} onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" placeholder="Maruti" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Model *</label>
                  <input value={vehicleForm.model} onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" placeholder="Alto" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Vehicle Class</label>
                  <select value={vehicleForm.vehicleClass} onChange={(e) => setVehicleForm({ ...vehicleForm, vehicleClass: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground">
                    {VEHICLE_CLASSES.map((vc) => <option key={vc} value={vc}>{vc.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                  <select value={vehicleForm.status} onChange={(e) => setVehicleForm({ ...vehicleForm, status: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground">
                    <option value="ACTIVE">Active</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="RETIRED">Retired</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Assigned Instructor</label>
                <select value={vehicleForm.instructorId} onChange={(e) => setVehicleForm({ ...vehicleForm, instructorId: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground">
                  <option value="">None</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Current Odometer (km)</label>
                <input type="number" min={0} value={vehicleForm.odometerKm} onChange={(e) => setVehicleForm({ ...vehicleForm, odometerKm: Number(e.target.value) || 0 })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Service Every (km)</label>
                  <input type="number" min={1} value={vehicleForm.serviceIntervalKm} onChange={(e) => setVehicleForm({ ...vehicleForm, serviceIntervalKm: Number(e.target.value) || 1 })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Service Every (sessions)</label>
                  <input type="number" min={1} value={vehicleForm.serviceIntervalSessions} onChange={(e) => setVehicleForm({ ...vehicleForm, serviceIntervalSessions: Number(e.target.value) || 1 })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowVehicleForm(false)} className="flex-1 h-11 rounded-xl border border-border text-sm text-foreground hover:bg-muted/50">Cancel</button>
              <button onClick={handleSaveVehicle} disabled={savingVehicle} className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50">
                {savingVehicle ? 'Saving...' : 'Save Vehicle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Maintenance Modal (Phase 58 §2) */}
      {maintenanceVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Maintenance — {maintenanceVehicle.registrationNumber}</h2>
                <p className="text-xs text-muted-foreground">{maintenanceVehicle.odometerKm.toLocaleString('en-IN')} km · {maintenanceVehicle.sessionsSinceService} sessions since last service</p>
              </div>
              <button onClick={() => { setMaintenanceVehicle(null); setMaintenanceLogs([]) }} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            {maintenanceError && <div className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{maintenanceError}</div>}
            <div className="border border-border rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">Log a Service</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Service Date</label>
                  <input type="date" value={maintenanceForm.serviceDate} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, serviceDate: e.target.value })} className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Odometer (km) *</label>
                  <input type="number" min={0} value={maintenanceForm.odometerKm} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, odometerKm: Number(e.target.value) || 0 })} className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Service Type *</label>
                <input value={maintenanceForm.serviceType} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, serviceType: e.target.value })} placeholder="e.g. General Service, Brake Pads..." className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cost (optional)</label>
                <input type="number" min={0} value={maintenanceForm.cost} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })} className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
                <textarea value={maintenanceForm.notes} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm resize-none" />
              </div>
              <button onClick={handleLogMaintenance} disabled={savingMaintenance} className="w-full h-11 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50">
                {savingMaintenance ? 'Saving...' : 'Log Service'}
              </button>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Service History</p>
              {maintenanceLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No service logged yet.</p>
              ) : (
                <div className="space-y-2">
                  {maintenanceLogs.map((log) => (
                    <div key={log.id} className="border border-border rounded-xl px-3 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-foreground">{log.serviceType}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(log.serviceDate)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{log.odometerKm.toLocaleString('en-IN')} km{log.cost != null ? ` · ₹${log.cost.toLocaleString('en-IN')}` : ''}</p>
                      {log.notes && <p className="text-xs text-muted-foreground mt-1">{log.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Test Form Modal */}
      {showTestForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Schedule Test</h2>
              <button onClick={() => setShowTestForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            {testError && <div className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{testError}</div>}
            <div className="space-y-3">
              <CustomerPicker
                label="Learner *"
                value={pickedTestLearner}
                onChange={(c) => { setPickedTestLearner(c); setTestForm({ ...testForm, learnerId: c?.id ?? '' }) }}
                placeholder="Search by name or phone..."
              />
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Test Type</label>
                <select value={testForm.testType} onChange={(e) => setTestForm({ ...testForm, testType: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground">
                  <option value="LL_TEST">Learner License Test</option>
                  <option value="DL_TEST">Driving License Test</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Test Date *</label>
                  <input type="date" value={testForm.testDate} onChange={(e) => setTestForm({ ...testForm, testDate: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Test Center *</label>
                  <input value={testForm.testCenter} onChange={(e) => setTestForm({ ...testForm, testCenter: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" placeholder="RTO Office, Mumbai..." />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Instructor (who taught this learner)</label>
                <select value={testForm.instructorId} onChange={(e) => setTestForm({ ...testForm, instructorId: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground">
                  <option value="">Not recorded</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                <textarea value={testForm.notes} onChange={(e) => setTestForm({ ...testForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm resize-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowTestForm(false)} className="flex-1 h-11 rounded-xl border border-border text-sm text-foreground hover:bg-muted/50">Cancel</button>
              <button onClick={handleCreateTest} disabled={savingTest} className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50">
                {savingTest ? 'Scheduling...' : 'Schedule Test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Package Form Modal (Phase 41) */}
      {showPackageForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{editPackage ? 'Edit Package' : 'New Package'}</h2>
              <button onClick={() => setShowPackageForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            {packageError && <div className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{packageError}</div>}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Package Name *</label>
                <input value={packageForm.packageName} onChange={(e) => setPackageForm({ ...packageForm, packageName: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" placeholder="e.g. 10-Lesson LMV Package" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Total Sessions *</label>
                  <input type="number" min="1" value={packageForm.totalSessions} onChange={(e) => setPackageForm({ ...packageForm, totalSessions: Number(e.target.value) })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Price (₹) *</label>
                  <input type="number" min="0" value={packageForm.price} onChange={(e) => setPackageForm({ ...packageForm, price: Number(e.target.value) })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Vehicle Class</label>
                <select value={packageForm.vehicleClass} onChange={(e) => setPackageForm({ ...packageForm, vehicleClass: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground">
                  {VEHICLE_CLASSES.map((vc) => <option key={vc} value={vc}>{vc.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              {editPackage && (
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={packageForm.isActive} onChange={(e) => setPackageForm({ ...packageForm, isActive: e.target.checked })} />
                  Active (visible for new enrollments)
                </label>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowPackageForm(false)} className="flex-1 h-11 rounded-xl border border-border text-sm text-foreground hover:bg-muted/50">Cancel</button>
              <button onClick={handleSavePackage} disabled={savingPackage} className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50">
                {savingPackage ? 'Saving...' : 'Save Package'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enroll Learner Modal (Phase 41) */}
      {showEnrollForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Enroll Learner in Package</h2>
              <button onClick={() => setShowEnrollForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            {enrollError && <div className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{enrollError}</div>}
            <div className="space-y-3">
              <CustomerPicker
                label="Learner *"
                value={pickedEnrollLearner}
                onChange={(c) => { setPickedEnrollLearner(c); setEnrollForm({ ...enrollForm, learnerId: c?.id ?? '' }) }}
                placeholder="Search by name or phone..."
              />
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Package *</label>
                <select value={enrollForm.packageId} onChange={(e) => setEnrollForm({ ...enrollForm, packageId: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground">
                  <option value="">Select package...</option>
                  {packages.filter((p) => p.isActive).map((p) => <option key={p.id} value={p.id}>{p.packageName} — ₹{Number(p.price).toLocaleString('en-IN')} ({p.totalSessions} sessions)</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowEnrollForm(false)} className="flex-1 h-11 rounded-xl border border-border text-sm text-foreground hover:bg-muted/50">Cancel</button>
              <button onClick={handleCreateEnrollment} disabled={savingEnroll} className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50">
                {savingEnroll ? 'Enrolling...' : 'Enroll Learner'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
