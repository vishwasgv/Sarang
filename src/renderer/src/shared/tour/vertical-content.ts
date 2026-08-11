/**
 * Phase 60 — hand-authored, per-screen tour content for the genuinely
 * distinctive vertical-specific screens across all 43 business types (as
 * opposed to the generic "look around" template every vertical screen
 * fell back to before this file existed). Keyed by the screen's real
 * NAV_ITEMS path — the exact same path used for navigation and for the
 * i18n key, so a step's title/body and its `t()` lookup always agree.
 *
 * Deliberately NOT every NAV_ITEMS entry: universal screens (Products,
 * Customers, Reports, etc.) already have their own richer content in the
 * `tour.universal` namespace, and a handful of generic cross-cutting
 * utility screens (Purchase Orders, Cash Close, Expenses, Documents,
 * Import, Audit Log, HR) are common enough across business types that the
 * generic template already describes them adequately. Everything listed
 * here is a screen distinctive enough to a specific vertical that a
 * generic "here's a screen" sentence would genuinely undersell it.
 *
 * `key` is the i18n leaf under `tour.items.<key>.title` / `.body` in every
 * locale file. Missing/not-yet-translated locales fall back to English via
 * the same graceful mechanism the rest of the app already uses.
 */

export interface VerticalContentEntry {
  path: string
  key: string
}

export const VERTICAL_CONTENT: VerticalContentEntry[] = [
  { path: '/restaurant/tables', key: 'restaurantTables' },
  { path: '/restaurant/kot', key: 'restaurantKot' },
  { path: '/restaurant/recipes', key: 'restaurantRecipes' },
  { path: '/returns', key: 'retailReturns' },
  { path: '/distributor/bulk-order', key: 'distributorBulkOrder' },
  { path: '/distributor/outstanding', key: 'distributorOutstanding' },
  { path: '/distributor/field-orders', key: 'distributorFieldOrders' },
  { path: '/distributor/pricing', key: 'distributorPricing' },
  { path: '/agri/dashboard', key: 'agriDashboard' },
  { path: '/pharmacy/batches', key: 'batchTracking' },
  { path: '/electronics/serials', key: 'serialTracking' },
  { path: '/electronics/repair-tickets', key: 'repairTickets' },
  { path: '/manufacturing/raw-materials', key: 'rawMaterials' },
  { path: '/manufacturing/bom', key: 'billOfMaterials' },
  { path: '/manufacturing/production', key: 'productionOrders' },
  { path: '/manufacturing/finished-goods', key: 'finishedGoods' },
  { path: '/manufacturing/dispatch', key: 'dispatchTracking' },
  { path: '/manufacturing/vendors', key: 'vendorManagement' },
  { path: '/manufacturing/analytics', key: 'productionAnalytics' },
  { path: '/logistics/fleet', key: 'logisticsFleet' },
  { path: '/logistics/carriers', key: 'logisticsCarriers' },
  { path: '/logistics/shipments', key: 'logisticsShipments' },
  { path: '/logistics/grn', key: 'logisticsGrn' },
  { path: '/logistics/challan', key: 'logisticsChallan' },
  { path: '/logistics/freight', key: 'logisticsFreight' },
  { path: '/logistics/analytics', key: 'logisticsAnalytics' },
  { path: '/products/print-labels', key: 'printLabels' },
  { path: '/service/projects', key: 'serviceProjects' },
  { path: '/service/tickets', key: 'serviceTickets' },
  { path: '/service/job-cards', key: 'serviceJobCards' },
  { path: '/service/work-tracking', key: 'workTracking' },
  { path: '/service/customer-history', key: 'customerHistory' },
  { path: '/appointments', key: 'appointments' },
  { path: '/service-catalog', key: 'serviceCatalog' },
  { path: '/normal-ranges', key: 'normalRanges' },
  { path: '/provider-schedule', key: 'providerSchedule' },
  { path: '/service-notifications', key: 'whatsappReminders' },
  { path: '/vet/pets', key: 'vetPatients' },
  { path: '/clinical/queue', key: 'tokenQueue' },
  { path: '/clinical/notes', key: 'clinicalNotes' },
  { path: '/lab/orders', key: 'labOrders' },
  { path: '/blood-bank/donors', key: 'bloodDonors' },
  { path: '/blood-bank/donations', key: 'bloodDonations' },
  { path: '/blood-bank/stock', key: 'bloodStock' },
  { path: '/blood-bank/issue', key: 'bloodIssue' },
  { path: '/rental/bookings', key: 'rentalBookings' },
  { path: '/rental/units', key: 'rentalUnits' },
  { path: '/hotel/bookings', key: 'hotelBookings' },
  { path: '/hotel/rooms', key: 'hotelRooms' },
  { path: '/hotel/housekeeping', key: 'hotelHousekeeping' },
  { path: '/jewellery/metal-rates', key: 'metalRates' },
  { path: '/jewellery/exchanges', key: 'metalExchange' },
  { path: '/dental/recalls', key: 'dentalRecall' },
  { path: '/physio/session-packs', key: 'sessionPacks' },
  { path: '/commission', key: 'staffCommission' },
  { path: '/gym/memberships', key: 'memberships' },
  { path: '/gym/classes', key: 'groupClasses' },
  { path: '/driving/learners', key: 'learners' },
  { path: '/driving/sessions', key: 'driveSessions' },
  { path: '/legal/cases', key: 'legalCases' },
  { path: '/ca-cs/compliance', key: 'compliance' },
  { path: '/ca-cs/engagements', key: 'engagements' },
  { path: '/cs/roc-filings', key: 'rocFilings' },
  { path: '/professional/time-entries', key: 'timeTracking' },
  { path: '/service/leads', key: 'leads' },
  { path: '/service/service-projects', key: 'consultingProjects' },
  { path: '/service/retainers', key: 'retainers' },
  { path: '/service/issues', key: 'issues' },
  { path: '/service/drawing-register', key: 'drawingRegister' },
  { path: '/service/site-visits', key: 'siteVisits' },
  { path: '/coaching/students', key: 'students' },
  { path: '/coaching/batches', key: 'coachingBatches' },
  { path: '/coaching/attendance', key: 'coachingAttendance' },
  { path: '/coaching/fees', key: 'feeCollection' },
  { path: '/coaching/performances', key: 'performances' },
  { path: '/coaching/test-scores', key: 'testScores' },
  { path: '/photo/shoots', key: 'shootBookings' },
  { path: '/events/list', key: 'events' },
  { path: '/realestate/properties', key: 'properties' },
  { path: '/carservice/jobs', key: 'carServiceJobs' },
  { path: '/tailor/orders', key: 'tailoring' },
  { path: '/pest/contracts', key: 'pestControl' },
  { path: '/placement/candidates', key: 'placement' },
  // Cross-cutting screens shared by nearly every business type (not
  // vertical-specific, but not covered by the universal segment either) —
  // added so every screen gets real, specific content, not just the
  // flagship distinctive ones. Confirmed via a full 43-type sweep: these
  // 14 are the ONLY paths that were still falling back to the generic
  // template across the entire app.
  { path: '/billing/quotations', key: 'quotations' },
  { path: '/billing/credit-notes', key: 'creditNotes' },
  { path: '/billing/debit-notes', key: 'debitNotes' },
  { path: '/purchase-orders', key: 'purchaseOrders' },
  { path: '/suppliers', key: 'suppliers' },
  // Phase 61 — Bills (AP: what we owe a supplier, distinct from a PO — a
  // vendor invoice can be recorded even without one) and Payments Made.
  { path: '/bills', key: 'bills' },
  { path: '/supplier-payments', key: 'supplierPayments' },
  // Phase 62 — Section 4.3's 2 required flagship Tutorial entries: the two
  // screens an owner is most likely to open without knowing what to do
  // first. Bank Accounts is the entry point into Bank Reconciliation
  // (the reconciliation screen itself is a detail view reached from here,
  // not its own NAV_ITEMS path, so the flagship content targets this nav
  // item directly, same as every other hand-authored entry in this file).
  { path: '/accounting/bank-accounts', key: 'bankReconciliation' },
  { path: '/accounting/journal-entries', key: 'manualJournal' },
  { path: '/cash-close', key: 'cashClose' },
  { path: '/expenses', key: 'expenses' },
  { path: '/documents', key: 'documents' },
  { path: '/import', key: 'importData' },
  { path: '/audit', key: 'auditLog' },
  { path: '/hr/employees', key: 'hrEmployees' },
  { path: '/hr/attendance', key: 'hrAttendance' },
  { path: '/hr/leave', key: 'hrLeave' },
  { path: '/hr/payroll', key: 'hrPayroll' }
]

export const VERTICAL_CONTENT_BY_PATH: Record<string, string> = Object.fromEntries(
  VERTICAL_CONTENT.map((e) => [e.path, e.key])
)
