import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

export type BusinessType =
  | 'RESTAURANT' | 'RETAIL' | 'HARDWARE' | 'DISTRIBUTOR' | 'GENERAL'
  // Phase 2 — Industry Expansion
  | 'PHARMACY' | 'ELECTRONICS' | 'CLOTHING' | 'FOOTWEAR'
  // Phase 3 — Manufacturing
  | 'MANUFACTURING'
  // Phase 4 — Service (legacy generic types)
  | 'SERVICE' | 'CONSULTANT' | 'REPAIR'
  // Phase 22 — Service Business Templates (24 specific verticals)
  | 'VET_CLINIC' | 'GP_CLINIC' | 'SPECIALIST_CLINIC' | 'DENTAL_CLINIC' | 'PHYSIO_CLINIC'
  | 'BEAUTY_SALON' | 'GYM_STUDIO' | 'DRIVING_SCHOOL'
  | 'LAWYER' | 'CA_FIRM' | 'COMPANY_SECRETARY' | 'ARCHITECT' | 'CIVIL_ENGINEER'
  | 'REAL_ESTATE' | 'INDEPENDENT_CONSULTANT'
  | 'MARKETING_AGENCY' | 'SOFTWARE_AGENCY' | 'PHOTO_STUDIO' | 'EVENT_MANAGEMENT'
  | 'COACHING_INSTITUTE'
  | 'CAR_SERVICE_CENTER' | 'TAILOR_BOUTIQUE' | 'PEST_CONTROL' | 'PLACEMENT_AGENCY'
  // Phase 49 — New Business Vertical: Agricultural Inputs & Equipment (PRODUCT category)
  | 'AGRI_INPUTS'
  // Phase 50 — New Business Vertical: Diagnostic & Pathology Labs (SERVICE category)
  | 'DIAGNOSTIC_LAB'
  // Phase 51 — New Business Vertical: Blood Bank (PRODUCT category)
  | 'BLOOD_BANK'
  // Phase 54G — New Business Vertical: Rental (PRODUCT category) — generic
  // short-term/checkout-return rental for tents, utensils, clothing,
  // accessories, cars, bikes, short-stay homes, jewellery, gaming stations,
  // electronics, furniture. Distinct from REAL_ESTATE's Property (long-term
  // lease, no checkout/return cycle) — see PHASE_54G_RENTAL_TECHNICAL_SPEC.md.
  | 'RENTAL'
  // Fresh-audit build (2026-07-12) — New Business Vertical: Jewellery
  // (PRODUCT category). Genuine gap: a jewellery item's real sale price is
  // netWeight × today's metal rate + a making charge, not a static
  // sellingPrice — no existing mechanism (not even loose/weight billing,
  // which prices by a fixed per-unit-weight rate the OWNER sets once, not a
  // daily-fluctuating market rate) covers this.
  | 'JEWELLERY'
  // Hotel/Lodge vertical (SERVICE category) — deliberately its own vertical,
  // not an extension of RENTAL. See hotel.service.ts's header comment: a
  // hotel booking needs guest ID compliance (many jurisdictions legally
  // require a producible guest register), per-night billing, and in-stay
  // extra charges that RENTAL's short-term-checkout model has no equivalent
  // of.
  | 'HOTEL_LODGE'

export type TemplateModule =
  // Phase 1 modules
  | 'tables' | 'kot' | 'recipes' | 'ingredient_tracking'
  | 'returns'
  | 'area_pricing' | 'credit_limit_enforcement'
  | 'bulk_orders' | 'outstanding_analytics'
  // Phase 2 modules
  | 'batch_tracking' | 'expiry_tracking'
  | 'serial_tracking' | 'imei_tracking' | 'warranty_tracking'
  | 'variant_tracking'
  // Phase 3 modules
  | 'raw_materials' | 'bom' | 'production_orders' | 'production_analytics'
  | 'work_orders' | 'dispatch_tracking' | 'finished_goods' | 'vendor_management'
  // Phase 4 modules (legacy service)
  | 'projects' | 'project_tasks' | 'service_tickets' | 'job_cards' | 'work_tracking' | 'customer_history'
  // Phase 22 modules (service business foundation — all 24 templates)
  | 'appointments' | 'service_catalog' | 'provider_schedule' | 'notification_queue'
  // Phase 23 modules (template-specific)
  | 'vet_patients'
  // Phase 24 modules (template-specific)
  | 'visit_notes' | 'token_queue'
  // Phase 25 modules (template-specific)
  | 'dental_chart' | 'dental_recall'
  // Phase 26 modules (template-specific)
  | 'physio_notes' | 'session_packs'
  // Phase 27 modules (template-specific)
  | 'staff_commission' | 'memberships' | 'batch_classes' | 'learner_profiles' | 'driving_sessions'
  // Phase 28 modules (template-specific)
  | 'legal_cases' | 'time_entries'
  // Phase 29 modules (template-specific)
  | 'compliance_tasks' | 'engagements' | 'roc_filings' | 'board_meetings'
  // Phase 30 modules (template-specific)
  | 'leads' | 'service_projects' | 'retainers' | 'issues'
  // Phase 31 modules (template-specific)
  | 'student_profiles' | 'coaching_batches' | 'coaching_attendance' | 'coaching_fees' | 'coaching_performances'
  // Phase 32 modules (template-specific)
  | 'shoot_bookings' | 'event_bookings' | 'properties'
  // Phase 33 modules (template-specific)
  | 'car_job_cards' | 'tailoring_orders' | 'pest_contracts'
  // Phase 34 modules (template-specific)
  | 'placement_agency'
  // Phase 37 modules — Logistics & Supply Chain (product businesses)
  | 'logistics_fleet' | 'logistics_carriers' | 'logistics_shipments'
  | 'logistics_grn' | 'logistics_challan' | 'logistics_freight' | 'logistics_analytics'
  // Phase 38 modules — Barcode System + Loose/Weight Billing (cross-cutting, ALL PRODUCT
  // business types — deliberately opt-in, never added to TEMPLATE_DEFAULTS below for any
  // business type. An owner turns these on explicitly in Settings; until they do, this
  // phase is entirely dormant for every business.)
  | 'barcode_generation' | 'barcode_printing' | 'loose_billing'
  // Phase 46 modules — replacing two hardcoded business-type checks the audit found in
  // AppointmentsScreen.tsx/VisitNoteScreen.tsx (raw `businessType === 'X'` comparisons in
  // renderer business logic, violating "no template-specific if/else — configuration
  // flags only") with real, config-driven flags.
  | 'multi_service_booking' | 'specialist_referral'
  // Phase 47 module — QR-code customer table ordering (RESTAURANT only). Opt-in,
  // deliberately never added to TEMPLATE_DEFAULTS below — starts a local LAN HTTP
  // server only when explicitly enabled in Settings (see qr-order-server.ts), same
  // zero-footprint-when-off convention as the Phase 38 opt-in modules.
  | 'qr_table_ordering'
  // Phase 50 module — Diagnostic & Pathology Labs order/sample/result/report
  // workflow. Bundles order creation, sample collection, result entry, and
  // report finalization under one flag (same convention as vet_patients
  // bundling multiple related capabilities for its vertical).
  | 'lab_orders'
  // Phase 51 module — Blood Bank donor registry/donation/stock/issue workflow.
  // Deliberately NOT paired with batch_tracking/expiry_tracking — the generic
  // BatchManagementScreen's fixed 30-day alert window and lack of blood-group
  // grouping don't fit blood units (see blood-bank.service.ts's header
  // comment); Blood Bank gets its own dedicated stock screen instead, while
  // still reusing ProductBatch as the underlying stock ledger.
  | 'blood_bank'
  // Phase 54F module — Marketing Agency campaign depth (campaign target
  // channel, deliverable type, ad-spend budget on ServiceProject). Marketing
  // Agency previously shared the exact same generic lead/project/retainer
  // scaffold as Architect/Civil/Consultant with zero fields of its own —
  // this closes that gap the same "add fields, gate by module flag" way
  // every other vertical-depth phase has (e.g. Phase 25's dental_chart,
  // Phase 27's memberships), not template-specific if/else.
  | 'marketing_campaigns'
  // Phase 54G module — Rental Business booking/checkout/return lifecycle.
  // Bundles catalog rental fields, unit-tracked asset roster, and the
  // booking/checkout/return/invoice workflow under one flag, same "one flag
  // per vertical's whole workflow" convention as lab_orders/blood_bank.
  | 'rental_bookings'
  // Fresh-audit build (2026-07-12) — Jewellery vertical. Bundles the
  // Product metal/purity/weight/making-charge fields, MetalRate management,
  // and old-metal MetalExchange recording under one flag, same "one flag per
  // vertical's whole workflow" convention as rental_bookings/blood_bank.
  | 'jewellery_pricing'
  // Fresh-audit build (2026-07-12) — Architect real depth (previously
  // byte-for-byte identical to Civil Engineer's module set). A drawing
  // register (drawing number/revision/discipline/status) is genuine,
  // everyday architectural-practice bookkeeping Civil Engineer/Consultant
  // don't share.
  | 'drawing_register'
  // Fresh-audit build (2026-07-12) — Civil Engineer real depth. A site
  // visit log (survey/inspection/progress-check findings) is genuine,
  // everyday civil-practice bookkeeping distinct from an architect's
  // drawing-issue workflow.
  | 'site_visit_log'
  // Hotel/Lodge module. Bundles room roster, availability-checked booking
  // lifecycle, guest ID compliance capture at check-in, in-stay extra
  // charges, and checkout billing under one flag — same "one flag per
  // vertical's whole workflow" convention as rental_bookings/blood_bank.
  | 'hotel_bookings'
  // Phase 57 — AI Assistant. Local, offline natural-language business
  // queries (see AI_ASSISTANT_MASTER_PROMPT.md). Cross-cutting — available
  // to every business type, not vertical-specific — but deliberately never
  // added to TEMPLATE_DEFAULTS below (same opt-in convention as
  // barcode_generation/barcode_printing/loose_billing): an owner turns it on
  // explicitly in Settings, until then this phase is entirely dormant.
  | 'ai_assistant'

export interface TemplateConfig {
  businessType: string
  enabledModules: TemplateModule[]
  dashboardLayout: string
}

// All 24 Phase 22 service business template types — used for businessCategory detection
export const SERVICE_TEMPLATE_TYPES = new Set<string>([
  'VET_CLINIC', 'GP_CLINIC', 'SPECIALIST_CLINIC', 'DENTAL_CLINIC', 'PHYSIO_CLINIC',
  'BEAUTY_SALON', 'GYM_STUDIO', 'DRIVING_SCHOOL',
  'LAWYER', 'CA_FIRM', 'COMPANY_SECRETARY', 'ARCHITECT', 'CIVIL_ENGINEER',
  'REAL_ESTATE', 'INDEPENDENT_CONSULTANT',
  'MARKETING_AGENCY', 'SOFTWARE_AGENCY', 'PHOTO_STUDIO', 'EVENT_MANAGEMENT',
  'COACHING_INSTITUTE',
  'CAR_SERVICE_CENTER', 'TAILOR_BOUTIQUE', 'PEST_CONTROL', 'PLACEMENT_AGENCY',
  'DIAGNOSTIC_LAB', 'HOTEL_LODGE',
])

// Phase 48 — named, contained exceptions to the standing "languageLock: 'en'
// for all service business templates" rule. Deliberately NOT removed from
// SERVICE_TEMPLATE_TYPES above (still needs businessCategory: 'SERVICE' and
// the service-business UI shell/roles) — only the language lock itself is
// decoupled. Every other service vertical is untouched.
const LANGUAGE_LOCK_EXCEPTIONS = new Set<string>(['TAILOR_BOUTIQUE'])

// Single source of truth for languageLock, called from both changeBusinessType
// (below) and setup.service.ts's completeSetup() — previously each duplicated
// the identical `isServiceTemplate ? 'en' : 'multi'` expression inline, which
// is exactly the kind of two-copy drift risk this project has hit and fixed
// repeatedly (TemplateModule unions, seedDefaultTemplates, canShowUpiQr).
export function getLanguageLockFor(businessType: string): 'en' | 'multi' {
  if (!SERVICE_TEMPLATE_TYPES.has(businessType)) return 'multi'
  return LANGUAGE_LOCK_EXCEPTIONS.has(businessType) ? 'multi' : 'en'
}

// Base modules enabled for every service business template in Phase 22
// (phase-specific modules added per later phase)
const SERVICE_BASE_MODULES: TemplateModule[] = [
  'appointments',
  'service_catalog',
  'provider_schedule',
  'notification_queue',
]

const LOGISTICS_MODULES: TemplateModule[] = [
  'logistics_fleet', 'logistics_carriers', 'logistics_shipments',
  'logistics_grn', 'logistics_challan', 'logistics_freight', 'logistics_analytics',
]

// Default enabled modules per business type
const TEMPLATE_DEFAULTS: Record<string, TemplateModule[]> = {
  // Phase 1
  // Fresh-audit fix (2026-07-12): LOGISTICS_MODULES (Fleet/Carriers/GRN/
  // Freight — a fleet of OWN delivery vehicles) removed from the default set
  // here — a restaurant doesn't operate trucks. Still available to any
  // restaurant that does want formal supplier-delivery tracking via the
  // "Additional Business Features" Logistics & Supply Chain toggle in
  // Settings (SettingsScreen.tsx's BusinessFeaturesSection).
  RESTAURANT:  ['tables', 'kot', 'recipes', 'ingredient_tracking'],
  RETAIL:      ['returns', ...LOGISTICS_MODULES],
  HARDWARE:    ['area_pricing', 'credit_limit_enforcement', ...LOGISTICS_MODULES],
  DISTRIBUTOR: ['credit_limit_enforcement', 'bulk_orders', 'outstanding_analytics', ...LOGISTICS_MODULES],
  GENERAL:     [...LOGISTICS_MODULES],
  // Phase 2
  PHARMACY:    ['batch_tracking', 'expiry_tracking', ...LOGISTICS_MODULES],
  ELECTRONICS: ['serial_tracking', 'imei_tracking', 'warranty_tracking', ...LOGISTICS_MODULES],
  CLOTHING:    ['variant_tracking', 'returns', ...LOGISTICS_MODULES],
  FOOTWEAR:    ['variant_tracking', 'returns', ...LOGISTICS_MODULES],
  // Phase 3
  MANUFACTURING: ['raw_materials', 'bom', 'production_orders', 'production_analytics', 'work_orders', 'dispatch_tracking', 'finished_goods', 'vendor_management', ...LOGISTICS_MODULES],
  // Phase 49 — Agricultural Inputs & Equipment. Fertilizers/pesticides reuse
  // PHARMACY's batch_tracking/expiry_tracking (same safety/compliance shape
  // as medicines); farm equipment reuses ELECTRONICS's serial_tracking +
  // warranty_tracking WITHOUT imei_tracking (IMEI is phone-specific, doesn't
  // apply to a tractor/sprayer); job_cards reuses REPAIR's generic job-card
  // model/screen for equipment servicing. Not in SERVICE_TEMPLATE_TYPES, so
  // this is businessCategory: 'PRODUCT' and languageLock: 'multi' automatically.
  AGRI_INPUTS: ['batch_tracking', 'expiry_tracking', 'serial_tracking', 'warranty_tracking', 'job_cards', ...LOGISTICS_MODULES],
  // Phase 51 — Blood Bank. Deliberately does NOT include batch_tracking/
  // expiry_tracking — blood_bank's own dedicated stock screen reuses
  // ProductBatch as the underlying ledger directly, not through the generic
  // Batch Management screen (whose fixed 30-day alert window is wrong for
  // blood — see blood-bank.service.ts). Not in SERVICE_TEMPLATE_TYPES, so
  // businessCategory: 'PRODUCT' and languageLock: 'multi' automatically.
  BLOOD_BANK: ['blood_bank', ...LOGISTICS_MODULES],
  // Phase 54G — Rental. Not in SERVICE_TEMPLATE_TYPES, so businessCategory:
  // 'PRODUCT' and languageLock: 'multi' both fall out automatically, same as
  // AGRI_INPUTS/BLOOD_BANK.
  RENTAL: ['rental_bookings', ...LOGISTICS_MODULES],
  // Fresh-audit build (2026-07-12) — Jewellery. Deliberately does NOT
  // include batch_tracking/expiry_tracking or variant_tracking — a
  // jewellery item's identity IS its own weight/purity/hallmark record, not
  // a batch lot or a size/color variant. LOGISTICS_MODULES included since a
  // jewellery retailer routinely receives formal supplier consignments (GRN
  // is a real, common workflow here, unlike RESTAURANT/SERVICE/CONSULTANT/
  // REPAIR above). Not in SERVICE_TEMPLATE_TYPES, so businessCategory:
  // 'PRODUCT' and languageLock: 'multi' both fall out automatically.
  JEWELLERY: ['jewellery_pricing', 'returns', ...LOGISTICS_MODULES],
  // Phase 4 (legacy generic). Fresh-audit fix (2026-07-12): LOGISTICS_MODULES
  // removed from these 3 — none of them operate a fleet of goods-delivery
  // vehicles or receive formal goods shipments by default (SERVICE/CONSULTANT
  // are pure professional-services types; REPAIR uses individual customer-
  // brought items via job_cards, not supplier shipments). Still available via
  // the Logistics & Supply Chain "Additional Business Features" toggle in
  // Settings for anyone who genuinely needs it.
  SERVICE:    ['projects', 'project_tasks', 'service_tickets', 'work_tracking', 'customer_history'],
  CONSULTANT: ['projects', 'project_tasks', 'work_tracking', 'customer_history'],
  REPAIR:     ['job_cards', 'service_tickets', 'work_tracking', 'customer_history'],
  // Phase 22 — Clinical; Phase 23 adds vet_patients; Phase 24 adds visit_notes + token_queue
  // 'token_queue' (2026-07-15, final testing pass): extended to ALL 6 clinic-shaped
  // verticals, not just GP_CLINIC/SPECIALIST_CLINIC — walk-in token queues are just as
  // common at vet, dental, physio, and diagnostic-lab front desks in practice as at GP
  // clinics (the earlier Phase 50 rationale for adding it to SPECIALIST_CLINIC applies
  // equally here). TokenQueueScreen.tsx/its IPC layer were already fully generic (no
  // business-type-specific logic), so this is purely a module-flag change.
  VET_CLINIC:         [...SERVICE_BASE_MODULES, 'vet_patients', 'token_queue'],
  GP_CLINIC:          [...SERVICE_BASE_MODULES, 'visit_notes', 'token_queue'],
  // 'specialist_referral' (Phase 46) is the flag distinguishing this vertical's extra
  // referral fields on the visit note — GP_CLINIC/PHYSIO_CLINIC also have 'visit_notes'
  // but not this, since referral-in/referral-out fields are specialist-specific.
  SPECIALIST_CLINIC:  [...SERVICE_BASE_MODULES, 'visit_notes', 'specialist_referral', 'token_queue'],
  DENTAL_CLINIC:      [...SERVICE_BASE_MODULES, 'dental_chart', 'dental_recall', 'token_queue'],
  PHYSIO_CLINIC:      [...SERVICE_BASE_MODULES, 'visit_notes', 'physio_notes', 'session_packs', 'token_queue'],
  // Phase 50 — Diagnostic & Pathology Labs. Test/panel catalog reuses
  // service_catalog (already in SERVICE_BASE_MODULES) rather than a parallel
  // catalog module.
  DIAGNOSTIC_LAB:     [...SERVICE_BASE_MODULES, 'lab_orders', 'token_queue'],
  // Phase 22 — Wellness (Phase 27 adds template-specific modules)
  // 'multi_service_booking' (Phase 46) replaces a hardcoded `businessType === 'BEAUTY_SALON'`
  // check in AppointmentsScreen.tsx that gated actual save-time validation/payload shape.
  BEAUTY_SALON:       [...SERVICE_BASE_MODULES, 'session_packs', 'staff_commission', 'multi_service_booking'],
  GYM_STUDIO:         [...SERVICE_BASE_MODULES, 'session_packs', 'memberships', 'batch_classes', 'staff_commission'],
  DRIVING_SCHOOL:     [...SERVICE_BASE_MODULES, 'session_packs', 'learner_profiles', 'driving_sessions'],
  // Phase 22 — Professional
  LAWYER:                 [...SERVICE_BASE_MODULES, 'legal_cases', 'time_entries'],
  CA_FIRM:                [...SERVICE_BASE_MODULES, 'compliance_tasks', 'engagements', 'time_entries'],
  COMPANY_SECRETARY:      [...SERVICE_BASE_MODULES, 'compliance_tasks', 'roc_filings', 'board_meetings', 'time_entries'],
  // Fresh-audit fix (2026-07-12): previously byte-for-byte identical module
  // sets (a real gap the audit flagged — "the same vertical shipped twice
  // under two names"). drawing_register/site_visit_log are the real,
  // vertical-specific differentiators now.
  ARCHITECT:              [...SERVICE_BASE_MODULES, 'leads', 'service_projects', 'time_entries', 'drawing_register'],
  CIVIL_ENGINEER:         [...SERVICE_BASE_MODULES, 'leads', 'service_projects', 'time_entries', 'site_visit_log'],
  REAL_ESTATE:            [...SERVICE_BASE_MODULES, 'leads', 'properties'],
  INDEPENDENT_CONSULTANT: [...SERVICE_BASE_MODULES, 'leads', 'service_projects', 'retainers', 'time_entries'],
  // Phase 22 — Creative
  MARKETING_AGENCY: [...SERVICE_BASE_MODULES, 'leads', 'service_projects', 'retainers', 'marketing_campaigns'],
  SOFTWARE_AGENCY:  [...SERVICE_BASE_MODULES, 'leads', 'service_projects', 'retainers', 'issues'],
  PHOTO_STUDIO:     [...SERVICE_BASE_MODULES, 'shoot_bookings'],
  EVENT_MANAGEMENT: [...SERVICE_BASE_MODULES, 'leads', 'event_bookings'],
  // Phase 22 — Education; Phase 31 adds coaching-specific modules
  COACHING_INSTITUTE: [...SERVICE_BASE_MODULES, 'student_profiles', 'coaching_batches', 'coaching_attendance', 'coaching_fees', 'coaching_performances'],
  // Phase 22 — Trade (Phase 33 adds template-specific modules)
  CAR_SERVICE_CENTER: [...SERVICE_BASE_MODULES, 'car_job_cards'],
  TAILOR_BOUTIQUE:    [...SERVICE_BASE_MODULES, 'tailoring_orders'],
  PEST_CONTROL:       [...SERVICE_BASE_MODULES, 'pest_contracts'],
  PLACEMENT_AGENCY:   [...SERVICE_BASE_MODULES, 'placement_agency'],
  // Hotel/Lodge. Deliberately does NOT spread SERVICE_BASE_MODULES — a
  // hotel needs its own dedicated multi-night room-booking lifecycle, not
  // the generic single-visit 'appointments'/'service_catalog'/
  // 'provider_schedule' scaffold every other SERVICE_TEMPLATE_TYPES member
  // above uses. hotel_bookings bundles the whole workflow standalone, same
  // "one flag, no base spread" shape RENTAL uses for the identical reason
  // on the PRODUCT-category side.
  HOTEL_LODGE: ['hotel_bookings'],
}

const DASHBOARD_LAYOUTS: Record<string, string> = {
  // Phase 1
  RESTAURANT:  'restaurant',
  RETAIL:      'retail',
  HARDWARE:    'hardware',
  DISTRIBUTOR: 'distributor',
  GENERAL:     'general',
  // Phase 2
  PHARMACY:    'pharmacy',
  ELECTRONICS: 'electronics',
  CLOTHING:    'retail',
  FOOTWEAR:    'retail',
  // Phase 3
  MANUFACTURING: 'manufacturing',
  // Phase 49
  AGRI_INPUTS: 'agri',
  // Phase 51
  BLOOD_BANK: 'bloodbank',
  // Phase 4
  SERVICE:    'service',
  CONSULTANT: 'service',
  REPAIR:     'service',
  // Phase 22 — all service templates use 'service' layout (customised per-template in later phases)
  VET_CLINIC: 'service', GP_CLINIC: 'service', SPECIALIST_CLINIC: 'service',
  DENTAL_CLINIC: 'service', PHYSIO_CLINIC: 'service',
  BEAUTY_SALON: 'service', GYM_STUDIO: 'service', DRIVING_SCHOOL: 'service',
  LAWYER: 'service', CA_FIRM: 'service', COMPANY_SECRETARY: 'service',
  ARCHITECT: 'service', CIVIL_ENGINEER: 'service', REAL_ESTATE: 'service',
  INDEPENDENT_CONSULTANT: 'service',
  MARKETING_AGENCY: 'service', SOFTWARE_AGENCY: 'service',
  PHOTO_STUDIO: 'service', EVENT_MANAGEMENT: 'service',
  COACHING_INSTITUTE: 'service',
  CAR_SERVICE_CENTER: 'service', TAILOR_BOUTIQUE: 'service',
  PEST_CONTROL: 'service', PLACEMENT_AGENCY: 'service',
  DIAGNOSTIC_LAB: 'service',
  HOTEL_LODGE: 'service',
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getActiveTemplate(): Promise<{ success: boolean; data?: TemplateConfig; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const profile = await db.businessProfile.findFirst()
    const businessType = profile?.businessType ?? 'GENERAL'

    const row = await db.industryTemplateSetting.findUnique({ where: { businessType } })
    const enabledModules: TemplateModule[] = row?.enabledModules
      ? (JSON.parse(row.enabledModules) as TemplateModule[])
      : (TEMPLATE_DEFAULTS[businessType] ?? [])

    return {
      success: true,
      data: {
        businessType,
        enabledModules,
        dashboardLayout: DASHBOARD_LAYOUTS[businessType] ?? 'general',
      }
    }
  } catch (err) {
    return { success: false, error: { code: 'IND-001', message: err instanceof Error ? err.message : 'Could not load industry template.' } }
  }
}

export async function isModuleEnabled(module: TemplateModule): Promise<boolean> {
  const result = await getActiveTemplate()
  return result.data?.enabledModules.includes(module) ?? false
}

export async function changeBusinessType(
  newBusinessType: string,
  userId?: string
): Promise<{ success: boolean; data?: TemplateConfig; error?: { code: string; message: string } }> {
  try {
    if (!(newBusinessType in TEMPLATE_DEFAULTS)) {
      return { success: false, error: { code: 'IND-005', message: `"${newBusinessType}" is not a recognized business type.` } }
    }

    const db = getPrisma()

    const profile = await db.businessProfile.findFirst()
    if (!profile) return { success: false, error: { code: 'IND-002', message: 'Business profile not found.' } }

    const oldType = profile.businessType
    const isServiceTemplate = SERVICE_TEMPLATE_TYPES.has(newBusinessType)

    await db.businessProfile.update({
      where: { id: profile.id },
      data: {
        businessType: newBusinessType,
        businessCategory: isServiceTemplate ? 'SERVICE' : 'PRODUCT',
        serviceTemplateType: isServiceTemplate ? newBusinessType : null,
        languageLock: getLanguageLockFor(newBusinessType),
      }
    })

    const defaultModules = TEMPLATE_DEFAULTS[newBusinessType] ?? []
    await db.industryTemplateSetting.upsert({
      where: { businessType: newBusinessType },
      create: {
        businessType: newBusinessType,
        enabledModules: JSON.stringify(defaultModules),
        dashboardLayout: DASHBOARD_LAYOUTS[newBusinessType] ?? 'general',
      },
      update: {}
    })

    await logAction(userId, 'BUSINESS_TYPE_CHANGED', 'BusinessProfile', profile.id, oldType, newBusinessType)

    return getActiveTemplate()
  } catch (err) {
    return { success: false, error: { code: 'IND-003', message: err instanceof Error ? err.message : 'Could not change business type.' } }
  }
}

export async function updateEnabledModules(
  modules: TemplateModule[],
  userId?: string
): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const profile = await db.businessProfile.findFirst()
    const businessType = profile?.businessType ?? 'GENERAL'

    await db.industryTemplateSetting.upsert({
      where: { businessType },
      create: {
        businessType,
        enabledModules: JSON.stringify(modules),
        dashboardLayout: DASHBOARD_LAYOUTS[businessType] ?? 'general',
      },
      update: { enabledModules: JSON.stringify(modules) }
    })

    await logAction(userId, 'TEMPLATE_MODULES_UPDATED', 'IndustryTemplateSetting', businessType, undefined, JSON.stringify(modules))
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'IND-004', message: err instanceof Error ? err.message : 'Could not update modules.' } }
  }
}

export async function seedDefaultTemplates(): Promise<void> {
  const db = getPrisma()
  for (const [businessType, modules] of Object.entries(TEMPLATE_DEFAULTS)) {
    const existing = await db.industryTemplateSetting.findUnique({ where: { businessType } })
    if (!existing) {
      await db.industryTemplateSetting.create({
        data: {
          businessType,
          enabledModules: JSON.stringify(modules),
          dashboardLayout: DASHBOARD_LAYOUTS[businessType] ?? 'general',
        }
      })
      continue
    }

    // Backfill any module TEMPLATE_DEFAULTS has added since this row was first
    // created (e.g. Phase 46's multi_service_booking/specialist_referral) —
    // additive only, so an owner's manual opt-in choices (barcode_generation,
    // barcode_printing, loose_billing — never listed in TEMPLATE_DEFAULTS,
    // always set via updateEnabledModules) are never touched or removed.
    const current = JSON.parse(existing.enabledModules) as TemplateModule[]
    const missing = modules.filter((m) => !current.includes(m))
    if (missing.length > 0) {
      await db.industryTemplateSetting.update({
        where: { businessType },
        data: { enabledModules: JSON.stringify([...current, ...missing]) }
      })
    }
  }
}
