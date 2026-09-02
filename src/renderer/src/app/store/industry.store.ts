import { create } from 'zustand'
import { api } from '@renderer/services/ipc-client'
import { useBusinessStore } from './business.store'
import { i18n, setLanguage } from '../../i18n'

// REAL BUG found+fixed in this session's pre-release audit: languageLock was
// computed and persisted (industry-template.service.ts's getLanguageLockFor,
// written on setup and on every business-type change) but never read
// anywhere at runtime — a user on a languageLock:'en' service vertical
// (Hotel, Lawyer, Vet Clinic, and 20 others whose own screens are hardcoded
// English by design) could still switch the whole app to any of the other
// 12 languages via Settings, landing on a genuinely broken mixed-language
// app: translated global chrome next to that vertical's still-English
// screens. Enforced here, the single place both the initial load and every
// later business-type change flow through — matches the standing rule in
// industry-template.service.ts's own comment ("languageLock: 'en' for all
// service business templates").
function enforceLanguageLock(languageLock: 'en' | 'multi') {
  if (languageLock === 'en' && i18n.language !== 'en') setLanguage('en')
}

export type TemplateModule =
  | 'tables' | 'kot' | 'recipes' | 'ingredient_tracking'
  | 'returns'
  | 'area_pricing' | 'credit_limit_enforcement'
  | 'bulk_orders' | 'outstanding_analytics'
  | 'batch_tracking' | 'expiry_tracking'
  | 'serial_tracking' | 'imei_tracking' | 'warranty_tracking'
  | 'variant_tracking'
  | 'raw_materials' | 'bom' | 'production_orders' | 'production_analytics'
  | 'work_orders' | 'dispatch_tracking' | 'finished_goods' | 'vendor_management'
  | 'projects' | 'project_tasks' | 'service_tickets' | 'job_cards' | 'work_tracking' | 'customer_history'
  // Phase 22 — Service Business Foundation
  | 'appointments' | 'service_catalog' | 'provider_schedule' | 'notification_queue'
  // Phase 23 — Template-specific
  | 'vet_patients'
  // Phase 24 — Template-specific
  | 'visit_notes' | 'token_queue'
  // Phase 25 — Template-specific
  | 'dental_chart' | 'dental_recall'
  // Phase 26 — Template-specific
  | 'physio_notes' | 'session_packs'
  // Phase 27 — Template-specific
  | 'staff_commission' | 'memberships' | 'batch_classes' | 'learner_profiles' | 'driving_sessions'
  // Phase 28 — Legal
  | 'legal_cases' | 'time_entries'
  // Phase 29 — CA + CS
  | 'compliance_tasks' | 'engagements' | 'roc_filings' | 'board_meetings'
  // Phase 30 — Architecture + Civil + Consultant + Agencies
  | 'leads' | 'service_projects' | 'retainers' | 'issues'
  // Phase 31 — Coaching
  | 'student_profiles' | 'coaching_batches' | 'coaching_attendance' | 'coaching_fees' | 'coaching_performances'
  // Phase 32 — Photo + Event + Real Estate
  | 'shoot_bookings' | 'event_bookings' | 'properties'
  // Phase 33–34 — Template-specific
  | 'car_job_cards' | 'tailoring_orders' | 'pest_contracts' | 'placement_agency'
  // Phase 37 — Logistics & Supply Chain
  | 'logistics_fleet' | 'logistics_carriers' | 'logistics_shipments'
  | 'logistics_grn' | 'logistics_challan' | 'logistics_freight' | 'logistics_analytics'
  // Phase 38 — Barcode System + Loose/Weight Billing (opt-in, defaulted OFF for
  // every business type — see TEMPLATE_DEFAULTS in industry-template.service.ts)
  | 'barcode_generation' | 'barcode_printing' | 'loose_billing'
  // Phase 58 §2 — carton/box-to-loose-piece unit conversion (opt-in, same convention as loose_billing above)
  | 'pack_billing'
  // Phase 46 — replacing two hardcoded business-type checks the audit found in
  // AppointmentsScreen.tsx/VisitNoteScreen.tsx with real, config-driven flags.
  | 'multi_service_booking' | 'specialist_referral'
  // Phase 47 — QR-code customer table ordering (RESTAURANT only, opt-in).
  | 'qr_table_ordering'
  // Kitchen Display (phone/laptop, LAN) — RESTAURANT only, opt-in. Separate
  // LAN server/port from qr_table_ordering above, see kitchen-display-server.ts.
  | 'kitchen_display_web'
  // Phase 50 — Diagnostic & Pathology Labs order/sample/result/report workflow.
  | 'lab_orders'
  // Phase 51 — Blood Bank donor/donation/stock/issue workflow.
  | 'blood_bank'
  // Phase 54F — Marketing Agency campaign depth (target channel, deliverable
  // type, ad-spend budget on ServiceProject).
  | 'marketing_campaigns'
  // Phase 54G — Rental business booking/checkout/return lifecycle.
  | 'rental_bookings'
  // Fresh-audit build (2026-07-12) — Jewellery vertical (metal rate pricing,
  // purity/hallmark tracking, old-metal exchange).
  | 'jewellery_pricing'
  // Fresh-audit build (2026-07-12) — Architect drawing register / Civil
  // Engineer site visit log (real differentiation, previously identical
  // module sets).
  | 'drawing_register' | 'site_visit_log'
  // Hotel/Lodge vertical (room roster, availability-checked booking
  // lifecycle, guest ID compliance capture, in-stay charges, checkout
  // billing) — see industry-template.service.ts's header comment.
  | 'hotel_bookings'
  // Phase 57 — AI Assistant, cross-cutting opt-in, see
  // industry-template.service.ts's header comment.
  | 'ai_assistant'
  // Phase 58 §2 — Distributor field-rep order capture, a DISTRIBUTOR
  // default (not opt-in), see industry-template.service.ts's header comment.
  | 'field_order_capture'
  // Phase 58 §2 — Electronics repair/RMA workflow, an ELECTRONICS default
  // (not opt-in), see industry-template.service.ts's header comment.
  | 'repair_rma'
  // Phase 58 §2 — Agri Inputs combined consumables+equipment dashboard, an
  // AGRI_INPUTS default, see industry-template.service.ts's header comment.
  | 'agri_dashboard'
  // Phase 67 — GP Clinic chronic-condition recall, a GP_CLINIC default, see
  // industry-template.service.ts's header comment.
  | 'chronic_recall'
  // Phase 67 — GP Clinic diagnosis-category trend report, a GP_CLINIC
  // default, see industry-template.service.ts's header comment.
  | 'diagnosis_categories'
  // Phase 67 §9.1 item 20.3 — Specialist Clinic case-complexity tagging, a
  // SPECIALIST_CLINIC default, see industry-template.service.ts's header comment.
  | 'case_complexity'
  // Phase 67 §9.1 item 20.5 — Specialist Clinic referral-urgency queue
  // prioritization, a SPECIALIST_CLINIC default, see industry-template.service.ts's header comment.
  | 'referral_urgency'
  // Phase 67 §9.1 — Retail: time-boxed markdown workflow.
  | 'price_markdowns'
  | 'loyalty_program'
  // Phase 67 §9.1 — General: Custom Document Builder.
  | 'custom_documents'
  // Phase 69 §11 — four new verticals (Electrical/Plumbing/Stationery/
  // Furniture). See industry-template.service.ts's matching comments for
  // what each flag does — kept byte-for-byte in sync with that file's own
  // TemplateModule union, same manual-sync convention this whole union
  // already follows.
  | 'length_billing'
  | 'job_site_accounts'
  | 'scheduled_delivery'
  | 'bulk_list_order'
  | 'print_service_billing'
  | 'deposit_booking'
  | 'trade_in_exchange'
  // 2026-09 — Gym/Studio machine-based workout progress tracking, and a
  // universal visit check-in/check-out log (any business type).
  | 'workout_tracking'
  | 'customer_checkin'
  // 2026-09 §12 — Bakery custom order booking, mirrors deposit_booking.
  | 'custom_order_booking'
  // 2026-09 §12 — Tours & Travels.
  | 'vehicle_fleet' | 'tour_packages' | 'trip_charter_booking' | 'driver_duty_settlement'
  // 2026-09-02 — Restaurant/Bakery diet-type marker.
  | 'food_diet_type'
  // 2026-09-02 — Catering event booking (Bakery/Sweet Shop/Catering).
  | 'catering_events'

interface IndustryState {
  businessType: string
  enabledModules: TemplateModule[]
  dashboardLayout: string
  languageLock: 'en' | 'multi'
  isLoaded: boolean
  loadTemplate: () => Promise<void>
  isModuleEnabled: (module: TemplateModule) => boolean
  changeBusinessType: (type: string) => Promise<{ success: boolean; error?: { message: string } }>
  // Phase 38: lets Settings toggle individual opt-in modules (barcode_generation,
  // barcode_printing, loose_billing) without resetting everything else the way
  // changeBusinessType does — additive/subtractive, not a full template reset.
  updateEnabledModules: (modules: TemplateModule[]) => Promise<{ success: boolean; error?: { message: string } }>
}

export const useIndustryStore = create<IndustryState>((set, get) => ({
  businessType: 'GENERAL',
  enabledModules: [],
  dashboardLayout: 'general',
  languageLock: 'multi',
  isLoaded: false,

  loadTemplate: async () => {
    const res = await api.industry.getTemplate()
    if (res.success && res.data) {
      const d = res.data as { businessType: string; enabledModules: TemplateModule[]; dashboardLayout: string; languageLock: 'en' | 'multi' }
      set({ businessType: d.businessType, enabledModules: d.enabledModules, dashboardLayout: d.dashboardLayout, languageLock: d.languageLock, isLoaded: true })
      enforceLanguageLock(d.languageLock)
    } else {
      set({ isLoaded: true })
    }
  },

  isModuleEnabled: (module) => get().enabledModules.includes(module),

  changeBusinessType: async (type) => {
    const res = await api.industry.changeBusinessType({ businessType: type })
    if (res.success && res.data) {
      const d = res.data as { businessType: string; enabledModules: TemplateModule[]; dashboardLayout: string; languageLock: 'en' | 'multi' }
      set({ businessType: d.businessType, enabledModules: d.enabledModules, dashboardLayout: d.dashboardLayout, languageLock: d.languageLock })
      enforceLanguageLock(d.languageLock)
      // Fresh-audit fix (2026-07-12): this store's businessType and
      // business.store.ts's profile.businessType are two separate pieces of
      // state — updating only this one left the Dashboard's Industry
      // Spotlight widget (and Settings/About's business-type display) frozen
      // on the PREVIOUS business type until a full app reload, even though
      // every module-gated screen (which reads isModuleEnabled from this
      // store) correctly reflected the switch immediately.
      const currentProfile = useBusinessStore.getState().profile
      if (currentProfile) useBusinessStore.getState().setProfile({ ...currentProfile, businessType: d.businessType, languageLock: d.languageLock })
    }
    return res as { success: boolean; error?: { message: string } }
  },

  updateEnabledModules: async (modules) => {
    // industry:updateModules returns { success } only, no echoed state — the
    // caller already knows exactly what it asked to persist, so set it locally
    // on success rather than assuming a data payload that isn't there.
    const res = await api.industry.updateModules({ modules })
    if (res.success) set({ enabledModules: modules })
    return res as { success: boolean; error?: { message: string } }
  },
}))
