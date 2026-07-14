import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, ShoppingCart, Package, Warehouse, Users, Truck,
  DollarSign, BarChart3, HardDrive, Settings, ScrollText, Landmark,
  ChevronLeft, ChevronRight, ClipboardList, Upload,
  UtensilsCrossed, Ticket, BookOpen, RotateCcw, PackagePlus, Activity, Info,
  Pill, Smartphone, FlaskConical, BookMarked, Factory, PackageCheck,
  BarChart2, Send, Store, Briefcase, Headphones, Wrench, Clock, UserCheck,
  Paperclip, UserCog, CalendarCheck, CalendarOff, Banknote, FileText, MinusCircle,
  Calendar, Layers, Bell, CalendarDays, PawPrint, Hash, Stethoscope, Smile,
  Dumbbell, GraduationCap, Car, Scale, FileStack,
  Target, FolderOpen, RefreshCw, AlertCircle,
  Music, Camera, PartyPopper, Home,
  Scissors, Bug, UsersRound,
  Barcode, Droplet, Droplets, Syringe, Award, CalendarClock, Boxes, Gem, Repeat, HardHat,
  Hotel, BedDouble, Sparkles, HelpCircle,
  type LucideIcon
} from 'lucide-react'
import { useUiStore } from '@app/store/ui.store'
import { useBusinessStore } from '@app/store/business.store'
import { useIndustryStore } from '@app/store/industry.store'
import { useAuthStore } from '@app/store/auth.store'
import { cn } from '@shared/utils/cn'
import { BrandIcon, AszurexMark } from '@shared/ui/atoms/Brand'

interface NavItem {
  label: string
  i18nKey?: string
  path: string
  icon: LucideIcon
  permissionKey?: string
  requiredModule?: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', i18nKey: 'nav.dashboard', path: '/', icon: LayoutDashboard },
  // Phase 57 — AI Assistant. Cross-cutting, opt-in (off by default for every
  // business type), English-only (no i18nKey — same convention as other
  // languageLock:'en'-adjacent additions), fixed placement per
  // AI_ASSISTANT_MASTER_PROMPT.md Section 5.1.
  { label: 'Ask Sarang', path: '/ai-assistant', icon: Sparkles, permissionKey: 'ai.query', requiredModule: 'ai_assistant' },
  { label: 'Billing', i18nKey: 'nav.billing', path: '/billing', icon: ShoppingCart, permissionKey: 'billing.view' },
  { label: 'Quotations', i18nKey: 'nav.quotations', path: '/billing/quotations', icon: FileText, permissionKey: 'billing.view' },
  { label: 'Credit Notes', i18nKey: 'nav.creditNotes', path: '/billing/credit-notes', icon: MinusCircle, permissionKey: 'billing.view' },
  { label: 'Debit Notes', i18nKey: 'nav.debitNotes', path: '/billing/debit-notes', icon: ClipboardList, permissionKey: 'purchaseOrders.view' },
  // Restaurant-only items
  { label: 'Tables', path: '/restaurant/tables', icon: UtensilsCrossed, permissionKey: 'restaurant.manageTables', requiredModule: 'tables' },
  { label: 'KOT', path: '/restaurant/kot', icon: Ticket, permissionKey: 'restaurant.viewKOT', requiredModule: 'kot' },
  { label: 'Recipes', path: '/restaurant/recipes', icon: BookOpen, permissionKey: 'restaurant.manageRecipes', requiredModule: 'recipes' },
  // Retail-only items
  { label: 'Returns', i18nKey: 'nav.returns', path: '/returns', icon: RotateCcw, permissionKey: 'billing.createInvoice', requiredModule: 'returns' },
  // Distributor-only items
  { label: 'Bulk Orders', path: '/distributor/bulk-order', icon: PackagePlus, permissionKey: 'billing.createInvoice', requiredModule: 'bulk_orders' },
  { label: 'Outstanding', path: '/distributor/outstanding', icon: Activity, permissionKey: 'customers.view', requiredModule: 'outstanding_analytics' },
  // Batch/expiry tracking — shared by any business type with the module on (Pharmacy, Phase 49 Agri Inputs, etc.)
  { label: 'Batch Tracking', path: '/pharmacy/batches', icon: Pill, permissionKey: 'inventory.view', requiredModule: 'batch_tracking' },
  // Serial/warranty tracking — shared by any business type with the module on (Electronics, Phase 49 Agri Inputs equipment, etc.).
  // The screen itself conditionally shows IMEI-specific UI only when imei_tracking is also enabled.
  { label: 'Serial Tracking', path: '/electronics/serials', icon: Smartphone, permissionKey: 'inventory.view', requiredModule: 'serial_tracking' },
  // Manufacturing-only items
  { label: 'Raw Materials', path: '/manufacturing/raw-materials', icon: FlaskConical, permissionKey: 'inventory.view', requiredModule: 'raw_materials' },
  { label: 'Bill of Materials', path: '/manufacturing/bom', icon: BookMarked, permissionKey: 'inventory.view', requiredModule: 'bom' },
  { label: 'Production', path: '/manufacturing/production', icon: Factory, permissionKey: 'inventory.view', requiredModule: 'production_orders' },
  { label: 'Finished Goods', path: '/manufacturing/finished-goods', icon: PackageCheck, permissionKey: 'inventory.view', requiredModule: 'finished_goods' },
  { label: 'Dispatch', path: '/manufacturing/dispatch', icon: Send, permissionKey: 'inventory.view', requiredModule: 'dispatch_tracking' },
  { label: 'Vendors', path: '/manufacturing/vendors', icon: Store, permissionKey: 'suppliers.view', requiredModule: 'vendor_management' },
  { label: 'Production Analytics', path: '/manufacturing/analytics', icon: BarChart2, permissionKey: 'reports.sales', requiredModule: 'production_analytics' },
  // Phase 37 — Logistics & Supply Chain
  { label: 'Fleet', i18nKey: 'nav.fleet', path: '/logistics/fleet', icon: Truck, permissionKey: 'logistics.view', requiredModule: 'logistics_fleet' },
  { label: 'Carriers', i18nKey: 'nav.carriers', path: '/logistics/carriers', icon: Store, permissionKey: 'logistics.view', requiredModule: 'logistics_carriers' },
  { label: 'Shipments', i18nKey: 'nav.shipments', path: '/logistics/shipments', icon: Send, permissionKey: 'logistics.view', requiredModule: 'logistics_shipments' },
  { label: 'GRN', i18nKey: 'nav.grn', path: '/logistics/grn', icon: PackagePlus, permissionKey: 'logistics.view', requiredModule: 'logistics_grn' },
  { label: 'Delivery Challan', i18nKey: 'nav.deliveryChallan', path: '/logistics/challan', icon: ScrollText, permissionKey: 'logistics.view', requiredModule: 'logistics_challan' },
  { label: 'Freight Ledger', i18nKey: 'nav.freightLedger', path: '/logistics/freight', icon: Banknote, permissionKey: 'logistics.view', requiredModule: 'logistics_freight' },
  { label: 'Logistics Analytics', i18nKey: 'nav.logisticsAnalytics', path: '/logistics/analytics', icon: BarChart2, permissionKey: 'logistics.view', requiredModule: 'logistics_analytics' },
  // Phase 38 — Barcode System + Loose/Weight Billing. English label only for
  // now — full 12-language translation deliberately deferred per the master
  // prompt's own scope-fork guidance (PHASE_38_MASTER_PROMPT.md Section 2),
  // not silently skipped. Follow-up task, not an oversight.
  { label: 'Print Labels', path: '/products/print-labels', icon: Barcode, permissionKey: 'products.view', requiredModule: 'barcode_printing' },
  // Service-only items (Phase 4 legacy)
  { label: 'Projects', path: '/service/projects', icon: Briefcase, permissionKey: 'sales.view', requiredModule: 'projects' },
  { label: 'Service Tickets', path: '/service/tickets', icon: Headphones, permissionKey: 'sales.view', requiredModule: 'service_tickets' },
  { label: 'Job Cards', path: '/service/job-cards', icon: Wrench, permissionKey: 'sales.view', requiredModule: 'job_cards' },
  { label: 'Work Tracking', path: '/service/work-tracking', icon: Clock, permissionKey: 'sales.view', requiredModule: 'work_tracking' },
  { label: 'Customer History', path: '/service/customer-history', icon: UserCheck, permissionKey: 'customers.view', requiredModule: 'customer_history' },
  // Phase 22 — Service Business Foundation (English-only, no i18nKey)
  { label: 'Appointments', path: '/appointments', icon: CalendarDays, permissionKey: 'billing.view', requiredModule: 'appointments' },
  { label: 'Service Catalog', path: '/service-catalog', icon: Layers, permissionKey: 'settings.view', requiredModule: 'service_catalog' },
  { label: 'Normal Ranges', path: '/normal-ranges', icon: Activity, permissionKey: 'clinicalNotes.view', requiredModule: 'appointments' },
  { label: 'Provider Schedule', path: '/provider-schedule', icon: Calendar, permissionKey: 'settings.view', requiredModule: 'provider_schedule' },
  { label: 'WhatsApp Reminders', path: '/service-notifications', icon: Bell, permissionKey: 'billing.view', requiredModule: 'notification_queue' },
  // Phase 23 — Veterinary
  { label: 'Patients', path: '/vet/pets', icon: PawPrint, permissionKey: 'billing.view', requiredModule: 'vet_patients' },
  // Phase 24 — Medical
  { label: 'Token Queue', path: '/clinical/queue', icon: Hash, permissionKey: 'billing.view', requiredModule: 'token_queue' },
  { label: 'Clinical Notes', path: '/clinical/notes', icon: Stethoscope, permissionKey: 'clinicalNotes.view', requiredModule: 'visit_notes' },
  // Phase 50 — Diagnostic & Pathology Labs
  { label: 'Lab Test Orders', path: '/lab/orders', icon: FlaskConical, permissionKey: 'labOrders.view', requiredModule: 'lab_orders' },
  // Phase 51 — Blood Bank
  { label: 'Donors', path: '/blood-bank/donors', icon: Droplet, permissionKey: 'bloodBank.view', requiredModule: 'blood_bank' },
  { label: 'Donations & Screening', path: '/blood-bank/donations', icon: Syringe, permissionKey: 'bloodBank.view', requiredModule: 'blood_bank' },
  { label: 'Blood Stock', path: '/blood-bank/stock', icon: Droplets, permissionKey: 'bloodBank.view', requiredModule: 'blood_bank' },
  { label: 'Blood Issue', path: '/blood-bank/issue', icon: Send, permissionKey: 'bloodBank.view', requiredModule: 'blood_bank' },
  { label: 'Rental Bookings', path: '/rental/bookings', icon: CalendarClock, permissionKey: 'rental.view', requiredModule: 'rental_bookings' },
  { label: 'Rental Units', path: '/rental/units', icon: Boxes, permissionKey: 'rental.view', requiredModule: 'rental_bookings' },
  // Hotel/Lodge vertical
  { label: 'Hotel Bookings', path: '/hotel/bookings', icon: Hotel, permissionKey: 'hotel.view', requiredModule: 'hotel_bookings' },
  { label: 'Rooms', path: '/hotel/rooms', icon: BedDouble, permissionKey: 'hotel.view', requiredModule: 'hotel_bookings' },
  // Fresh-audit build (2026-07-12) — Jewellery
  { label: 'Metal Rates', path: '/jewellery/metal-rates', icon: Gem, permissionKey: 'jewellery.view', requiredModule: 'jewellery_pricing' },
  { label: 'Old-Metal Exchange', path: '/jewellery/exchanges', icon: Repeat, permissionKey: 'jewellery.view', requiredModule: 'jewellery_pricing' },
  // Phase 25 — Dental
  { label: 'Recall Schedule', path: '/dental/recalls', icon: Smile, permissionKey: 'billing.view', requiredModule: 'dental_recall' },
  // Phase 26 — Physio
  { label: 'Session Packs', path: '/physio/session-packs', icon: Package, permissionKey: 'billing.view', requiredModule: 'session_packs' },
  // Phase 27 — Salon, Gym, Driving School
  { label: 'Commission', path: '/commission', icon: DollarSign, permissionKey: 'billing.view', requiredModule: 'staff_commission' },
  { label: 'Memberships', path: '/gym/memberships', icon: Dumbbell, permissionKey: 'billing.view', requiredModule: 'memberships' },
  { label: 'Group Classes', path: '/gym/classes', icon: Layers, permissionKey: 'billing.view', requiredModule: 'batch_classes' },
  { label: 'Learners', path: '/driving/learners', icon: GraduationCap, permissionKey: 'billing.view', requiredModule: 'learner_profiles' },
  { label: 'Drive Sessions', path: '/driving/sessions', icon: Car, permissionKey: 'billing.view', requiredModule: 'driving_sessions' },
  // Phase 28 — Legal
  { label: 'Legal Cases', path: '/legal/cases', icon: Scale, permissionKey: 'billing.view', requiredModule: 'legal_cases' },
  { label: 'Compliance', path: '/ca-cs/compliance', icon: ClipboardList, permissionKey: 'billing.view', requiredModule: 'compliance_tasks' },
  { label: 'Engagements', path: '/ca-cs/engagements', icon: Briefcase, permissionKey: 'billing.view', requiredModule: 'engagements' },
  { label: 'ROC Filings', path: '/cs/roc-filings', icon: FileStack, permissionKey: 'billing.view', requiredModule: 'roc_filings' },
  { label: 'Time Tracking', path: '/professional/time-entries', icon: Clock, permissionKey: 'billing.view', requiredModule: 'time_entries' },
  // Phase 30 — Architect, Civil, Consultant, Agency
  { label: 'Leads', path: '/service/leads', icon: Target, permissionKey: 'billing.view', requiredModule: 'leads' },
  { label: 'Projects', path: '/service/service-projects', icon: FolderOpen, permissionKey: 'billing.view', requiredModule: 'service_projects' },
  { label: 'Retainers', path: '/service/retainers', icon: RefreshCw, permissionKey: 'billing.view', requiredModule: 'retainers' },
  { label: 'Issues', path: '/service/issues', icon: AlertCircle, permissionKey: 'billing.view', requiredModule: 'issues' },
  // Fresh-audit build (2026-07-12) — Architect / Civil Engineer real depth
  { label: 'Drawing Register', path: '/service/drawing-register', icon: FileStack, permissionKey: 'billing.view', requiredModule: 'drawing_register' },
  { label: 'Site Visit Log', path: '/service/site-visits', icon: HardHat, permissionKey: 'billing.view', requiredModule: 'site_visit_log' },
  // Phase 31 — Coaching Institute
  { label: 'Students', path: '/coaching/students', icon: GraduationCap, permissionKey: 'billing.view', requiredModule: 'student_profiles' },
  { label: 'Batches', path: '/coaching/batches', icon: BookOpen, permissionKey: 'billing.view', requiredModule: 'coaching_batches' },
  { label: 'Attendance', path: '/coaching/attendance', icon: CalendarCheck, permissionKey: 'billing.view', requiredModule: 'coaching_attendance' },
  { label: 'Fee Collection', path: '/coaching/fees', icon: Banknote, permissionKey: 'billing.view', requiredModule: 'coaching_fees' },
  { label: 'Performances', path: '/coaching/performances', icon: Music, permissionKey: 'billing.view', requiredModule: 'coaching_performances' },
  { label: 'Test Scores', path: '/coaching/test-scores', icon: Award, permissionKey: 'billing.view', requiredModule: 'coaching_performances' },
  // Phase 32 — Photography, Event Management, Real Estate
  { label: 'Shoot Bookings', path: '/photo/shoots', icon: Camera, permissionKey: 'billing.view', requiredModule: 'shoot_bookings' },
  { label: 'Events', path: '/events/list', icon: PartyPopper, permissionKey: 'billing.view', requiredModule: 'event_bookings' },
  { label: 'Properties', path: '/realestate/properties', icon: Home, permissionKey: 'billing.view', requiredModule: 'properties' },
  // Phase 33 — Car Service, Tailor Boutique, Pest Control
  { label: 'Job Cards', path: '/carservice/jobs', icon: Car, permissionKey: 'billing.view', requiredModule: 'car_job_cards' },
  { label: 'Tailoring', i18nKey: 'nav.tailoring', path: '/tailor/orders', icon: Scissors, permissionKey: 'billing.view', requiredModule: 'tailoring_orders' },
  { label: 'Pest Control', path: '/pest/contracts', icon: Bug, permissionKey: 'billing.view', requiredModule: 'pest_contracts' },
  // Phase 34 — Placement Agency
  { label: 'Placement', path: '/placement/candidates', icon: UsersRound, permissionKey: 'billing.view', requiredModule: 'placement_agency' },
  { label: 'Employees', i18nKey: 'nav.employees', path: '/hr/employees', icon: UserCog, permissionKey: 'hr.view' },
  { label: 'Attendance', i18nKey: 'nav.attendance', path: '/hr/attendance', icon: CalendarCheck, permissionKey: 'hr.attendance' },
  { label: 'Leave', i18nKey: 'nav.leave', path: '/hr/leave', icon: CalendarOff, permissionKey: 'hr.view' },
  { label: 'Payroll', i18nKey: 'nav.payroll', path: '/hr/payroll', icon: Banknote, permissionKey: 'hr.view' },
  { label: 'Products', i18nKey: 'nav.products', path: '/products', icon: Package, permissionKey: 'products.view' },
  { label: 'Inventory', i18nKey: 'nav.inventory', path: '/inventory', icon: Warehouse, permissionKey: 'inventory.view' },
  { label: 'Purchase Orders', i18nKey: 'nav.purchaseOrders', path: '/purchase-orders', icon: ClipboardList, permissionKey: 'purchaseOrders.view' },
  { label: 'Customers', i18nKey: 'nav.customers', path: '/customers', icon: Users, permissionKey: 'customers.view' },
  { label: 'Suppliers', i18nKey: 'nav.suppliers', path: '/suppliers', icon: Truck, permissionKey: 'suppliers.view' },
  { label: 'Cash Close', i18nKey: 'nav.cashClose', path: '/cash-close', icon: Landmark, permissionKey: 'billing.createInvoice' },
  { label: 'Expenses', i18nKey: 'nav.expenses', path: '/expenses', icon: DollarSign, permissionKey: 'expenses.view' },
  { label: 'Reports', i18nKey: 'nav.reports', path: '/reports', icon: BarChart3, permissionKey: 'reports.sales' },
  { label: 'Documents', i18nKey: 'nav.documents', path: '/documents', icon: Paperclip, permissionKey: 'settings.view' },
  { label: 'Import', i18nKey: 'nav.import', path: '/import', icon: Upload, permissionKey: 'import.execute' },
  { label: 'Backup', i18nKey: 'nav.backup', path: '/backup', icon: HardDrive, permissionKey: 'backup.view' },
  { label: 'Audit Log', i18nKey: 'nav.auditLog', path: '/audit', icon: ScrollText, permissionKey: 'audit.view' },
  { label: 'Settings', i18nKey: 'nav.settings', path: '/settings', icon: Settings, permissionKey: 'settings.view' },
  // Phase 56 — User Manual. Read-only reference content, no permissionKey — every
  // role should be able to look up how to use the product, same convention as About.
  { label: 'Manual', i18nKey: 'nav.manual', path: '/manual', icon: HelpCircle },
  { label: 'About', i18nKey: 'nav.about', path: '/about', icon: Info }
]

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore()
  const profile = useBusinessStore((s) => s.profile)
  const { isModuleEnabled } = useIndustryStore()
  const { hasPermission } = useAuthStore()

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 72 : 280 }}
      transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      className="flex flex-col h-full bg-dark border-r border-slate-800 shrink-0 overflow-hidden"
    >
      {/* Logo area */}
      <div className="flex items-center h-16 px-4 border-b border-slate-800 shrink-0">
        <BrandIcon size={36} className="shrink-0" />
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="ml-3 overflow-hidden"
            >
              <p className="text-base font-bold text-white leading-none truncate max-w-[160px]">
                {profile?.businessName ?? 'Sarang'}
              </p>
              <p className="text-sm text-brand mt-0.5 leading-none">Business OS Lite</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS
          .filter(item => {
            if (item.requiredModule && !isModuleEnabled(item.requiredModule as Parameters<typeof isModuleEnabled>[0])) return false
            if (item.permissionKey && !hasPermission(item.permissionKey)) return false
            return true
          })
          .map((item) => (
            <SidebarLink key={item.path} item={item} collapsed={sidebarCollapsed} />
          ))}
      </nav>

      {/* Aszurex branding */}
      <AnimatePresence>
        {!sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 py-3 border-t border-slate-800"
          >
            <p className="text-sm text-slate-400 leading-none">Powered by</p>
            <p className="text-sm font-semibold text-brand mt-0.5 inline-flex items-center gap-1.5">
              Aszurex <AszurexMark width={14} />
            </p>
            <p className="text-sm text-slate-500">Trust Beyond Limits</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-10 border-t border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </motion.aside>
  )
}

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const location = useLocation()
  const { t } = useTranslation()
  const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
  const displayLabel = item.i18nKey ? t(item.i18nKey, item.label) : item.label

  return (
    <NavLink
      to={item.path}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors duration-150',
        'group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-dark',
        isActive
          ? 'bg-brand text-white'
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      )}
      title={collapsed ? displayLabel : undefined}
    >
      <item.icon size={20} className="shrink-0" />
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden whitespace-nowrap"
          >
            {displayLabel}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Tooltip when collapsed */}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-slate-800 text-white text-sm rounded whitespace-nowrap
                        opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
          {displayLabel}
        </div>
      )}
    </NavLink>
  )
}
