// Phase 56 — User Manual chapter manifest. Single source of truth for the Manual
// screen's table of contents. Chapter `businessTypes` values must match the
// `BusinessType` union in `src/main/services/industry-template.service.ts` — that
// file, not this one, is the source of truth for which business types exist.

export interface ManualChapter {
  slug: string
  group: 'getting-started' | 'universal' | 'business' | 'ai'
  /** English title shown in the TOC before the active locale's chapter loads (and as a11y fallback). */
  title: string
  /** Business types this chapter documents — only present for group: 'business'. */
  businessTypes?: string[]
}

export const MANUAL_CHAPTERS: ManualChapter[] = [
  { slug: 'getting-started', group: 'getting-started', title: 'Getting Started' },

  // Universal features — apply to every business type
  { slug: 'billing', group: 'universal', title: 'Billing & Documents' },
  { slug: 'inventory', group: 'universal', title: 'Inventory' },
  { slug: 'customers-suppliers', group: 'universal', title: 'Customers & Suppliers' },
  { slug: 'reports', group: 'universal', title: 'Reports' },
  { slug: 'settings', group: 'universal', title: 'Settings & Business Profile' },
  { slug: 'backup-restore', group: 'universal', title: 'Backup & Restore' },
  { slug: 'users-permissions', group: 'universal', title: 'Users & Permissions' },
  { slug: 'audit-log', group: 'universal', title: 'Audit Log' },
  { slug: 'barcode-loose-billing', group: 'universal', title: 'Barcode & Loose/Weight Billing' },
  { slug: 'dashboard', group: 'universal', title: 'Dashboard' },

  // AI Assistant (Phase 57) — cross-cutting, opt-in
  { slug: 'ai-assistant', group: 'ai', title: 'Ask Sarang (AI Assistant)' },

  // Business-type chapters — one per BusinessType, grouped by family for the TOC only
  { slug: 'business/restaurant', group: 'business', title: 'Restaurant', businessTypes: ['RESTAURANT'] },
  { slug: 'business/retail', group: 'business', title: 'Retail', businessTypes: ['RETAIL'] },
  { slug: 'business/hardware', group: 'business', title: 'Hardware Store', businessTypes: ['HARDWARE'] },
  { slug: 'business/distributor', group: 'business', title: 'Distributor / Wholesale', businessTypes: ['DISTRIBUTOR'] },
  { slug: 'business/general', group: 'business', title: 'General Store', businessTypes: ['GENERAL'] },
  { slug: 'business/pharmacy', group: 'business', title: 'Pharmacy', businessTypes: ['PHARMACY'] },
  { slug: 'business/electronics', group: 'business', title: 'Electronics', businessTypes: ['ELECTRONICS'] },
  { slug: 'business/clothing', group: 'business', title: 'Clothing', businessTypes: ['CLOTHING'] },
  { slug: 'business/footwear', group: 'business', title: 'Footwear', businessTypes: ['FOOTWEAR'] },
  { slug: 'business/manufacturing', group: 'business', title: 'Manufacturing', businessTypes: ['MANUFACTURING'] },
  { slug: 'business/service-consultant-repair', group: 'business', title: 'Service / Consultant / Repair', businessTypes: ['SERVICE', 'CONSULTANT', 'REPAIR'] },
  { slug: 'business/vet-clinic', group: 'business', title: 'Veterinary Clinic', businessTypes: ['VET_CLINIC'] },
  { slug: 'business/gp-clinic', group: 'business', title: 'GP Clinic', businessTypes: ['GP_CLINIC'] },
  { slug: 'business/specialist-clinic', group: 'business', title: 'Specialist Clinic', businessTypes: ['SPECIALIST_CLINIC'] },
  { slug: 'business/dental-clinic', group: 'business', title: 'Dental Clinic', businessTypes: ['DENTAL_CLINIC'] },
  { slug: 'business/physio-clinic', group: 'business', title: 'Physiotherapy Clinic', businessTypes: ['PHYSIO_CLINIC'] },
  { slug: 'business/beauty-salon', group: 'business', title: 'Beauty Salon', businessTypes: ['BEAUTY_SALON'] },
  { slug: 'business/gym-studio', group: 'business', title: 'Gym / Fitness Studio', businessTypes: ['GYM_STUDIO'] },
  { slug: 'business/driving-school', group: 'business', title: 'Driving School', businessTypes: ['DRIVING_SCHOOL'] },
  { slug: 'business/lawyer', group: 'business', title: 'Lawyer / Legal Practice', businessTypes: ['LAWYER'] },
  { slug: 'business/ca-firm', group: 'business', title: 'CA Firm', businessTypes: ['CA_FIRM'] },
  { slug: 'business/company-secretary', group: 'business', title: 'Company Secretary Practice', businessTypes: ['COMPANY_SECRETARY'] },
  { slug: 'business/architect', group: 'business', title: 'Architect', businessTypes: ['ARCHITECT'] },
  { slug: 'business/civil-engineer', group: 'business', title: 'Civil Engineer', businessTypes: ['CIVIL_ENGINEER'] },
  { slug: 'business/real-estate', group: 'business', title: 'Real Estate', businessTypes: ['REAL_ESTATE'] },
  { slug: 'business/independent-consultant', group: 'business', title: 'Independent Consultant', businessTypes: ['INDEPENDENT_CONSULTANT'] },
  { slug: 'business/marketing-agency', group: 'business', title: 'Marketing Agency', businessTypes: ['MARKETING_AGENCY'] },
  { slug: 'business/software-agency', group: 'business', title: 'Software Agency', businessTypes: ['SOFTWARE_AGENCY'] },
  { slug: 'business/photo-studio', group: 'business', title: 'Photo Studio', businessTypes: ['PHOTO_STUDIO'] },
  { slug: 'business/event-management', group: 'business', title: 'Event Management', businessTypes: ['EVENT_MANAGEMENT'] },
  { slug: 'business/coaching-institute', group: 'business', title: 'Coaching Institute', businessTypes: ['COACHING_INSTITUTE'] },
  { slug: 'business/car-service-center', group: 'business', title: 'Car Service Center', businessTypes: ['CAR_SERVICE_CENTER'] },
  { slug: 'business/tailor-boutique', group: 'business', title: 'Tailor / Boutique', businessTypes: ['TAILOR_BOUTIQUE'] },
  { slug: 'business/pest-control', group: 'business', title: 'Pest Control', businessTypes: ['PEST_CONTROL'] },
  { slug: 'business/placement-agency', group: 'business', title: 'Placement Agency', businessTypes: ['PLACEMENT_AGENCY'] },
  { slug: 'business/agri-inputs', group: 'business', title: 'Agricultural Inputs & Equipment', businessTypes: ['AGRI_INPUTS'] },
  { slug: 'business/diagnostic-lab', group: 'business', title: 'Diagnostic & Pathology Lab', businessTypes: ['DIAGNOSTIC_LAB'] },
  { slug: 'business/blood-bank', group: 'business', title: 'Blood Bank', businessTypes: ['BLOOD_BANK'] },
  { slug: 'business/rental', group: 'business', title: 'Rental Business', businessTypes: ['RENTAL'] },
  { slug: 'business/jewellery', group: 'business', title: 'Jewellery', businessTypes: ['JEWELLERY'] },
  { slug: 'business/hotel-lodge', group: 'business', title: 'Hotel / Lodge', businessTypes: ['HOTEL_LODGE'] },
]

export const MANUAL_LOCALES = ['en', 'hi', 'mr', 'gu', 'kn', 'ta', 'te', 'ml', 'es', 'fr', 'ar', 'pt', 'id'] as const
export type ManualLocale = typeof MANUAL_LOCALES[number]
