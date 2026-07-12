import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  UtensilsCrossed, ShoppingBag, Hammer, Truck, CheckCircle2, RefreshCw, AlertTriangle, Pill, Smartphone, Shirt, Footprints, Factory, Briefcase, Wrench, UserCheck, Tractor, Droplet, CalendarClock, Gem,
  PawPrint, Stethoscope, HeartPulse, Smile, Activity, Microscope, Sparkles, Dumbbell, Car, Scale, Calculator, FileText, Compass, HardHat, Home, UserCog, Megaphone, Code2, Camera, PartyPopper, GraduationCap, CarFront, Scissors, Bug, Users,
} from 'lucide-react'
import { useIndustryStore, type TemplateModule } from '@app/store/industry.store'
import { cn } from '@shared/utils/cn'
import { Badge } from '@shared/ui/atoms/Badge'

interface Template {
  type: string
  label: string
  description: string
  icon: React.ReactNode
  modules: TemplateModule[]
  moduleLabels: string[]
}

const TEMPLATES: Template[] = [
  {
    type: 'RESTAURANT',
    label: 'Restaurant / Café / Food',
    description: 'Table management, KOT printing, recipe-based ingredient tracking',
    icon: <UtensilsCrossed size={22} />,
    modules: ['tables', 'kot', 'recipes', 'ingredient_tracking'],
    moduleLabels: ['Table Management', 'Kitchen Order Tickets (KOT)', 'Recipe Management', 'Ingredient Tracking'],
  },
  {
    type: 'RETAIL',
    label: 'Retail / General Store',
    description: 'Barcode billing, product returns with inventory reversal',
    icon: <ShoppingBag size={22} />,
    modules: ['returns'],
    moduleLabels: ['Returns Workflow'],
  },
  {
    type: 'HARDWARE',
    label: 'Hardware / Glass / Plywood',
    description: 'Area pricing (sq ft, sq m), credit management for trade customers',
    icon: <Hammer size={22} />,
    modules: ['area_pricing', 'credit_limit_enforcement'],
    moduleLabels: ['Area Pricing Calculator', 'Credit Limit Enforcement'],
  },
  {
    type: 'DISTRIBUTOR',
    label: 'Distributor / Wholesale',
    description: 'Bulk orders, credit limit enforcement, outstanding analytics',
    icon: <Truck size={22} />,
    modules: ['credit_limit_enforcement', 'bulk_orders', 'outstanding_analytics'],
    moduleLabels: ['Credit Limit Enforcement', 'Bulk Order Workflow', 'Outstanding Analytics'],
  },
  {
    type: 'GENERAL',
    label: 'General Business',
    description: 'Standard billing, inventory, and reporting — no industry-specific features',
    icon: <CheckCircle2 size={22} />,
    modules: [],
    moduleLabels: ['All core modules'],
  },
  {
    type: 'PHARMACY',
    label: 'Pharmacy / Medical Store',
    description: 'Batch number tracking, expiry date alerts, FIFO dispensing',
    icon: <Pill size={22} />,
    modules: ['batch_tracking', 'expiry_tracking'],
    moduleLabels: ['Batch Tracking', 'Expiry Date Alerts'],
  },
  {
    type: 'ELECTRONICS',
    label: 'Electronics / Mobile Store',
    description: 'Per-unit serial number, dual IMEI tracking, warranty management',
    icon: <Smartphone size={22} />,
    modules: ['serial_tracking', 'imei_tracking', 'warranty_tracking'],
    moduleLabels: ['Serial Number Tracking', 'IMEI Lookup', 'Warranty Management'],
  },
  {
    type: 'CLOTHING',
    label: 'Clothing / Textile / Apparel',
    description: 'Size × colour variant grid, per-variant stock, product returns',
    icon: <Shirt size={22} />,
    modules: ['variant_tracking', 'returns'],
    moduleLabels: ['Size × Colour Variants', 'Returns Workflow'],
  },
  {
    type: 'FOOTWEAR',
    label: 'Footwear / Shoe Store',
    description: 'Size variants, per-variant stock levels, product returns',
    icon: <Footprints size={22} />,
    modules: ['variant_tracking', 'returns'],
    moduleLabels: ['Size Variants', 'Returns Workflow'],
  },
  {
    type: 'AGRI_INPUTS',
    label: 'Agricultural Inputs & Equipment',
    description: 'Fertilizer/pesticide batch + expiry tracking, equipment serial numbers + warranty, equipment service job cards',
    icon: <Tractor size={22} />,
    modules: ['batch_tracking', 'expiry_tracking', 'serial_tracking', 'warranty_tracking', 'job_cards'],
    moduleLabels: ['Batch Tracking', 'Expiry Date Alerts', 'Equipment Serial Tracking', 'Warranty Management', 'Equipment Service Job Cards'],
  },
  {
    type: 'BLOOD_BANK',
    label: 'Blood Bank',
    description: 'Donor registry, donation screening, blood-group stock tracking, compatibility-aware issuance',
    icon: <Droplet size={22} />,
    modules: ['blood_bank'],
    moduleLabels: ['Donor Registry', 'Donation & Screening', 'Blood Stock', 'Issue & Compatibility Check'],
  },
  {
    type: 'JEWELLERY',
    label: 'Jewellery',
    description: 'Weight × today\'s metal rate + making charge pricing, purity/hallmark tracking, old-gold/silver exchange',
    icon: <Gem size={22} />,
    modules: ['jewellery_pricing', 'returns'],
    moduleLabels: ['Metal Rate Pricing', 'Returns Workflow'],
  },
  {
    type: 'RENTAL',
    label: 'Rental Business',
    description: 'Book, check out, and return rented items — tents, vehicles, homes, electronics, furniture and more. Hourly to yearly rates, security deposits, late fees.',
    icon: <CalendarClock size={22} />,
    modules: ['rental_bookings'],
    moduleLabels: ['Rental Bookings', 'Rental Units & Asset Roster', 'Availability Checking', 'Checkout & Return'],
  },
  {
    type: 'MANUFACTURING',
    label: 'Manufacturing / Production',
    description: 'Raw material inventory, BOM, production orders, work orders, dispatch tracking',
    icon: <Factory size={22} />,
    modules: ['raw_materials', 'bom', 'production_orders', 'work_orders', 'dispatch_tracking', 'finished_goods', 'vendor_management', 'production_analytics'],
    moduleLabels: ['Raw Material Stock', 'Bill of Materials (BOM)', 'Production Orders', 'Work Orders', 'Dispatch Tracking', 'Finished Goods', 'Vendor Management', 'Production Analytics'],
  },
  {
    type: 'SERVICE',
    label: 'Service Business / Agency / IT',
    description: 'Projects, tasks, service tickets, work-hour tracking, customer history',
    icon: <Briefcase size={22} />,
    modules: ['projects', 'project_tasks', 'service_tickets', 'work_tracking', 'customer_history'],
    moduleLabels: ['Project Management', 'Task Tracking', 'Service Tickets', 'Work Hour Logging', 'Customer History'],
  },
  {
    type: 'CONSULTANT',
    label: 'Consultant / Freelancer',
    description: 'Project-centric work with hour tracking and customer history',
    icon: <UserCheck size={22} />,
    modules: ['projects', 'project_tasks', 'work_tracking', 'customer_history'],
    moduleLabels: ['Project Management', 'Task Tracking', 'Work Hour Logging', 'Customer History'],
  },
  {
    type: 'REPAIR',
    label: 'Repair Shop / Service Centre',
    description: 'Job cards for item repairs with estimated and actual cost tracking',
    icon: <Wrench size={22} />,
    modules: ['job_cards', 'service_tickets', 'work_tracking', 'customer_history'],
    moduleLabels: ['Job Cards', 'Service Tickets', 'Work Hour Logging', 'Customer History'],
  },
  // The 25 Phase 22 service-vertical templates below previously had no
  // Settings tile at all — selectable only at first-time setup, with no way
  // for an owner to review or switch back into their own business type
  // afterward (module lists mirror industry-template.service.ts's
  // TEMPLATE_DEFAULTS exactly, so a tile's "Apply" always matches what the
  // backend actually enables).
  {
    type: 'VET_CLINIC',
    label: 'Veterinary Clinic',
    description: 'Appointment booking, provider schedules, and pet patient records',
    icon: <PawPrint size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'vet_patients'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Pet Patient Records'],
  },
  {
    type: 'GP_CLINIC',
    label: 'GP / General Physician',
    description: 'Appointment booking, visit notes, and a walk-in token queue',
    icon: <Stethoscope size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'visit_notes', 'token_queue'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Visit Notes', 'Walk-in Token Queue'],
  },
  {
    type: 'SPECIALIST_CLINIC',
    label: 'Specialist Clinic',
    description: 'Visit notes with referral tracking, plus a walk-in token queue for any specialty',
    icon: <HeartPulse size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'visit_notes', 'specialist_referral', 'token_queue'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Visit Notes', 'Referral Tracking', 'Walk-in Token Queue'],
  },
  {
    type: 'DENTAL_CLINIC',
    label: 'Dental Clinic',
    description: 'Interactive dental chart and recall/checkup reminders',
    icon: <Smile size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'dental_chart', 'dental_recall'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Dental Chart', 'Recall Reminders'],
  },
  {
    type: 'PHYSIO_CLINIC',
    label: 'Physiotherapy Clinic',
    description: 'Visit notes, physiotherapy-specific notes, and prepaid session packs',
    icon: <Activity size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'visit_notes', 'physio_notes', 'session_packs'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Visit Notes', 'Physiotherapy Notes', 'Session Packs'],
  },
  {
    type: 'DIAGNOSTIC_LAB',
    label: 'Diagnostic & Pathology Lab',
    description: 'Test order intake, sample collection, result entry, and report finalization',
    icon: <Microscope size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'lab_orders'],
    moduleLabels: ['Appointment Booking', 'Test Catalog', 'Provider Schedule', 'Notification Queue', 'Lab Order & Report Workflow'],
  },
  {
    type: 'BEAUTY_SALON',
    label: 'Beauty Salon / Spa',
    description: 'Prepaid session packs, staff commission tracking, and multi-service bookings',
    icon: <Sparkles size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'session_packs', 'staff_commission', 'multi_service_booking'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Session Packs', 'Staff Commission', 'Multi-Service Booking'],
  },
  {
    type: 'GYM_STUDIO',
    label: 'Gym / Fitness Studio',
    description: 'Memberships, batch classes, session packs, and staff commission tracking',
    icon: <Dumbbell size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'session_packs', 'memberships', 'batch_classes', 'staff_commission'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Session Packs', 'Memberships', 'Batch Classes', 'Staff Commission'],
  },
  {
    type: 'DRIVING_SCHOOL',
    label: 'Driving School',
    description: 'Learner profiles, session packs, and individual driving session tracking',
    icon: <Car size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'session_packs', 'learner_profiles', 'driving_sessions'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Session Packs', 'Learner Profiles', 'Driving Sessions'],
  },
  {
    type: 'LAWYER',
    label: 'Lawyer / Law Firm',
    description: 'Legal case management with billable time entry tracking',
    icon: <Scale size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'legal_cases', 'time_entries'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Legal Case Management', 'Time Entry Tracking'],
  },
  {
    type: 'CA_FIRM',
    label: 'CA / Chartered Accountant',
    description: 'Compliance task tracking, client engagements, and billable time entries',
    icon: <Calculator size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'compliance_tasks', 'engagements', 'time_entries'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Compliance Task Tracking', 'Client Engagements', 'Time Entry Tracking'],
  },
  {
    type: 'COMPANY_SECRETARY',
    label: 'Company Secretary',
    description: 'Compliance tasks, ROC filing tracking, board meeting records, and time entries',
    icon: <FileText size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'compliance_tasks', 'roc_filings', 'board_meetings', 'time_entries'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Compliance Task Tracking', 'ROC Filings', 'Board Meeting Records', 'Time Entry Tracking'],
  },
  {
    type: 'ARCHITECT',
    label: 'Architect',
    description: 'Lead management, project tracking, billable time entries, and a drawing register (revisions, discipline, issue status)',
    icon: <Compass size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'leads', 'service_projects', 'time_entries', 'drawing_register'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Lead Management', 'Project Management', 'Time Entry Tracking', 'Drawing Register'],
  },
  {
    type: 'CIVIL_ENGINEER',
    label: 'Civil Engineer',
    description: 'Lead management, project tracking, billable time entries, and a site visit log (survey/inspection/progress findings)',
    icon: <HardHat size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'leads', 'service_projects', 'time_entries', 'site_visit_log'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Lead Management', 'Project Management', 'Time Entry Tracking', 'Site Visit Log'],
  },
  {
    type: 'REAL_ESTATE',
    label: 'Real Estate Agent',
    description: 'Lead management and a property listing roster',
    icon: <Home size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'leads', 'properties'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Lead Management', 'Property Listings'],
  },
  {
    type: 'INDEPENDENT_CONSULTANT',
    label: 'Consultant',
    description: 'Lead management, project tracking, retainer billing, and time entries',
    icon: <UserCog size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'leads', 'service_projects', 'retainers', 'time_entries'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Lead Management', 'Project Management', 'Retainer Billing', 'Time Entry Tracking'],
  },
  {
    type: 'MARKETING_AGENCY',
    label: 'Marketing Agency',
    description: 'Leads, project tracking, retainer billing, and campaign management',
    icon: <Megaphone size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'leads', 'service_projects', 'retainers', 'marketing_campaigns'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Lead Management', 'Project Management', 'Retainer Billing', 'Campaign Management'],
  },
  {
    type: 'SOFTWARE_AGENCY',
    label: 'Software / IT Agency',
    description: 'Leads, project tracking, retainer billing, and issue tracking',
    icon: <Code2 size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'leads', 'service_projects', 'retainers', 'issues'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Lead Management', 'Project Management', 'Retainer Billing', 'Issue Tracking'],
  },
  {
    type: 'PHOTO_STUDIO',
    label: 'Photography Studio',
    description: 'Shoot booking calendar with provider scheduling',
    icon: <Camera size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'shoot_bookings'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Shoot Bookings'],
  },
  {
    type: 'EVENT_MANAGEMENT',
    label: 'Event Management',
    description: 'Lead management and an event booking calendar',
    icon: <PartyPopper size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'leads', 'event_bookings'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Lead Management', 'Event Bookings'],
  },
  {
    type: 'COACHING_INSTITUTE',
    label: 'Coaching / Tuition Institute',
    description: 'Student profiles, batches, attendance, fee management, and performance tracking',
    icon: <GraduationCap size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'student_profiles', 'coaching_batches', 'coaching_attendance', 'coaching_fees', 'coaching_performances'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Student Profiles', 'Coaching Batches', 'Attendance Tracking', 'Fee Management', 'Performance Tracking'],
  },
  {
    type: 'CAR_SERVICE_CENTER',
    label: 'Car Service Center',
    description: 'Vehicle job cards for service and repair work',
    icon: <CarFront size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'car_job_cards'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Vehicle Job Cards'],
  },
  {
    type: 'TAILOR_BOUTIQUE',
    label: 'Tailor / Boutique',
    description: 'Tailoring orders with measurements, trial dates, and delivery tracking',
    icon: <Scissors size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'tailoring_orders'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Tailoring Orders'],
  },
  {
    type: 'PEST_CONTROL',
    label: 'Pest Control Service',
    description: 'Service contracts (AMC) with renewal reminders and job sheet visits',
    icon: <Bug size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'pest_contracts'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Service Contracts (AMC)'],
  },
  {
    type: 'PLACEMENT_AGENCY',
    label: 'Placement / Recruitment Agency',
    description: 'Candidate database, job orders, and placement tracking with commission',
    icon: <Users size={22} />,
    modules: ['appointments', 'service_catalog', 'provider_schedule', 'notification_queue', 'placement_agency'],
    moduleLabels: ['Appointment Booking', 'Service Catalog', 'Provider Schedule', 'Notification Queue', 'Candidate & Placement Tracking'],
  },
]

export function IndustrySettingsScreen() {
  const { businessType, changeBusinessType } = useIndustryStore()
  const [selected, setSelected] = useState(businessType)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (selected === businessType) return
    setSaving(true)
    setError(null)
    try {
      const res = await changeBusinessType(selected)
      if (res.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError(res.error?.message ?? 'Could not change business type.')
      }
    } catch {
      setError('Could not change business type. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-dark dark:text-slate-100">Industry Template</h2>
        <p className="text-sm text-slate-400">Choose your business type to activate industry-specific features. Changes take effect immediately — no restart required.</p>
      </div>

      {error && (
        <div className="bg-danger/5 border border-danger/20 rounded-xl px-4 py-3 text-sm text-danger">{error}</div>
      )}

      {saved && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="bg-success/5 border border-success/20 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-success">
          <CheckCircle2 size={14} />
          Template updated. Sidebar and features have been refreshed.
        </motion.div>
      )}

      <div className="space-y-3">
        {TEMPLATES.map(tmpl => {
          const isActive = businessType === tmpl.type
          const isSelected = selected === tmpl.type
          return (
            <button key={tmpl.type}
              onClick={() => setSelected(tmpl.type)}
              className={cn(
                'w-full text-left rounded-xl border-2 p-5 flex items-start gap-4 transition-all',
                isSelected ? 'border-brand bg-brand/5' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-brand/40',
              )}>
              <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                isSelected ? 'bg-brand text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400')}>
                {tmpl.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn('text-sm font-semibold', isSelected ? 'text-brand' : 'text-dark dark:text-slate-100')}>{tmpl.label}</p>
                  {isActive && <Badge variant="success" size="sm">Active</Badge>}
                </div>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{tmpl.description}</p>
                {tmpl.moduleLabels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tmpl.moduleLabels.map(m => (
                      <Badge key={m} variant="neutral" size="sm">{m}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className={cn('w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 transition-colors flex items-center justify-center',
                isSelected ? 'border-brand bg-brand' : 'border-slate-300')}>
                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-900" />}
              </div>
            </button>
          )
        })}
      </div>

      {selected !== businessType && (
        <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
          <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
          <p>Switching templates will change the sidebar navigation and enable/disable features. All existing data is preserved — only the feature set changes.</p>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={handleSave}
          disabled={saving || selected === businessType}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {saving && <RefreshCw size={14} className="animate-spin" />}
          {saving ? 'Saving…' : 'Apply Template'}
        </button>
      </div>
    </div>
  )
}
