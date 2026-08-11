import { getPrisma } from './db'
import { seedDefaultTemplates } from '../services/industry-template.service'
import { seedDefaultLeaveTypes } from '../services/hr.service'

// All roles and permissions from PERMISSIONS_MATRIX.md
const ROLES = [
  { roleName: 'Admin', description: 'Full system access' },
  { roleName: 'Manager', description: 'Operational control' },
  { roleName: 'Cashier', description: 'Billing focused' },
  { roleName: 'Staff', description: 'Operational support' },
  { roleName: 'Kitchen Staff', description: 'Restaurant kitchen operations' }
]

const PERMISSIONS = [
  // Auth
  { permissionKey: 'auth.login', permissionName: 'Login' },
  { permissionKey: 'auth.changeOwnPassword', permissionName: 'Change Own Password' },
  // Users
  { permissionKey: 'users.view', permissionName: 'View Users' },
  { permissionKey: 'users.create', permissionName: 'Create Users' },
  { permissionKey: 'users.update', permissionName: 'Update Users' },
  { permissionKey: 'users.disable', permissionName: 'Disable Users' },
  { permissionKey: 'users.delete', permissionName: 'Delete Users' },
  { permissionKey: 'users.assignRoles', permissionName: 'Assign Roles' },
  // Roles
  { permissionKey: 'roles.view', permissionName: 'View Roles' },
  { permissionKey: 'roles.modify', permissionName: 'Modify Roles' },
  // Customers
  { permissionKey: 'customers.view', permissionName: 'View Customers' },
  { permissionKey: 'customers.create', permissionName: 'Create Customer' },
  { permissionKey: 'customers.update', permissionName: 'Update Customer' },
  { permissionKey: 'customers.archive', permissionName: 'Archive Customer' },
  { permissionKey: 'customers.viewLedger', permissionName: 'View Customer Ledger' },
  { permissionKey: 'customers.modifyCreditLimit', permissionName: 'Modify Customer Credit Limit' },
  // Suppliers
  { permissionKey: 'suppliers.view', permissionName: 'View Suppliers' },
  { permissionKey: 'suppliers.create', permissionName: 'Create Supplier' },
  { permissionKey: 'suppliers.update', permissionName: 'Update Supplier' },
  { permissionKey: 'suppliers.archive', permissionName: 'Archive Supplier' },
  { permissionKey: 'suppliers.viewLedger', permissionName: 'View Supplier Ledger' },
  { permissionKey: 'suppliers.recordPayment', permissionName: 'Record Supplier Payment' },
  // Products
  { permissionKey: 'products.view', permissionName: 'View Products' },
  { permissionKey: 'products.create', permissionName: 'Create Product' },
  { permissionKey: 'products.update', permissionName: 'Update Product' },
  { permissionKey: 'products.archive', permissionName: 'Archive Product' },
  { permissionKey: 'products.modifyPricing', permissionName: 'Modify Pricing' },
  // Phase 38 — deliberately separate from products.update: printing/weighing a
  // barcode label is a checkout-counter action (same category as
  // billing.printInvoice, which Cashier already has), not product-master-data
  // editing. Gating it on products.update would make the entire "weigh and
  // print a loose item" flow unusable by the Cashier role it's built for.
  { permissionKey: 'products.printLabels', permissionName: 'Print Barcode Labels' },
  // Inventory
  { permissionKey: 'inventory.view', permissionName: 'View Inventory' },
  { permissionKey: 'inventory.addStock', permissionName: 'Add Stock' },
  { permissionKey: 'inventory.adjustStock', permissionName: 'Adjust Stock' },
  { permissionKey: 'inventory.viewMovements', permissionName: 'View Inventory Movements' },
  { permissionKey: 'inventory.valuation', permissionName: 'View Inventory Valuation' },
  // Phase 3 — Manufacturing (raw materials, BOM, production orders, work
  // orders, dispatch). Referenced by 5 IPC handlers since the phase shipped
  // but never actually seeded here — the exact same class of gap already
  // hit once before for billing.view/billing.create (see note below): every
  // one of those routes was unreachable by any role, including Admin.
  { permissionKey: 'inventory.manage', permissionName: 'Manage Manufacturing (Raw Materials, BOM, Production Orders, Dispatch)' },
  // Billing
  { permissionKey: 'billing.createInvoice', permissionName: 'Create Invoice' },
  { permissionKey: 'billing.editDraftInvoice', permissionName: 'Edit Draft Invoice' },
  { permissionKey: 'billing.cancelInvoice', permissionName: 'Cancel Invoice' },
  { permissionKey: 'billing.printInvoice', permissionName: 'Print Invoice' },
  // billing.view / billing.create were referenced by 30+ routes and nav items
  // (router.tsx ProtectedRoute, Sidebar.tsx) across billing AND most Phase
  // 22-36 service-vertical screens, but were never seeded as real permissions —
  // every one of those routes was unreachable by any role, including Admin.
  { permissionKey: 'billing.view', permissionName: 'View Invoices & Billing Records' },
  { permissionKey: 'billing.create', permissionName: 'Create Quotations & Credit Notes' },
  // Phase 20 — billing.void referenced by quotations:delete and creditNotes:delete
  // since the phase shipped but never actually seeded here — same class of gap
  // as billing.view/billing.create above.
  { permissionKey: 'billing.void', permissionName: 'Delete Quotations & Void Credit Notes' },
  // Payments
  { permissionKey: 'payments.record', permissionName: 'Record Payment' },
  { permissionKey: 'payments.reverse', permissionName: 'Reverse Payment' },
  { permissionKey: 'payments.view', permissionName: 'View Payments' },
  // Expenses
  { permissionKey: 'expenses.view', permissionName: 'View Expenses' },
  { permissionKey: 'expenses.create', permissionName: 'Create Expense' },
  { permissionKey: 'expenses.modify', permissionName: 'Modify Expense' },
  { permissionKey: 'expenses.delete', permissionName: 'Delete Expense' },
  // Reports (granular — GAP F9)
  { permissionKey: 'reports.view', permissionName: 'View All Reports' },
  { permissionKey: 'reports.sales', permissionName: 'View Sales Report' },
  { permissionKey: 'reports.invoices', permissionName: 'View Invoice Report' },
  { permissionKey: 'reports.financial', permissionName: 'View Financial Report' },
  { permissionKey: 'reports.tax', permissionName: 'View Tax Report' },
  { permissionKey: 'reports.inventory', permissionName: 'View Inventory Report' },
  { permissionKey: 'reports.outstanding', permissionName: 'View Outstanding Report' },
  { permissionKey: 'reports.export', permissionName: 'Export Reports' },
  { permissionKey: 'reports.print', permissionName: 'Print Reports' },
  // Analytics
  { permissionKey: 'analytics.viewDashboard', permissionName: 'View Dashboard' },
  { permissionKey: 'analytics.viewRevenue', permissionName: 'View Revenue Analytics' },
  { permissionKey: 'analytics.viewExpenses', permissionName: 'View Expense Analytics' },
  { permissionKey: 'analytics.viewProfit', permissionName: 'View Profit Analytics' },
  { permissionKey: 'analytics.viewInventory', permissionName: 'View Inventory Analytics' },
  // Import
  { permissionKey: 'import.execute', permissionName: 'Import Data' },
  // Backup
  { permissionKey: 'backup.create', permissionName: 'Create Backup' },
  { permissionKey: 'backup.view', permissionName: 'View Backups' },
  { permissionKey: 'backup.restore', permissionName: 'Restore Backup' },
  { permissionKey: 'backup.delete', permissionName: 'Delete Backup' },
  // Settings
  { permissionKey: 'settings.view', permissionName: 'View Settings' },
  { permissionKey: 'settings.modify', permissionName: 'Modify Settings' },
  { permissionKey: 'settings.modifyTax', permissionName: 'Modify Tax Settings' },
  { permissionKey: 'settings.modifyCurrency', permissionName: 'Modify Currency Settings' },
  // Phase 59 — Licensing. Admin-only (not granted to Manager below) — same
  // sensitivity bar as Security, license changes are financially/legally
  // significant enough to warrant it, per PHASE_59's own spec (Section 59.6).
  { permissionKey: 'settings.manageLicense', permissionName: 'Manage License' },
  // Audit
  { permissionKey: 'audit.view', permissionName: 'View Audit Logs' },
  { permissionKey: 'audit.export', permissionName: 'Export Audit Logs' },
  // Purchase Orders
  { permissionKey: 'purchaseOrders.view', permissionName: 'View Purchase Orders' },
  { permissionKey: 'purchaseOrders.create', permissionName: 'Create Purchase Order' },
  { permissionKey: 'purchaseOrders.approve', permissionName: 'Approve Purchase Order' },
  { permissionKey: 'purchaseOrders.receive', permissionName: 'Receive Purchase Order Stock' },
  { permissionKey: 'purchaseOrders.cancel', permissionName: 'Cancel Purchase Order' },
  // Phase 45: Debit Note printing is a purchasing-domain document, not billing —
  // billing.printInvoice doesn't fit; needs its own key matching this domain's convention.
  // NOTE: despite the key name, this is (and has only ever been) consumed by
  // Debit Note printing (debit-note.handler.ts) — deliberately left untouched
  // (do not rename/repurpose) since it's load-bearing for already-deployed
  // installs' role assignments. Purchase Order printing/export/share below
  // uses the correctly-named purchaseOrders.printDocument instead.
  { permissionKey: 'purchaseOrders.print', permissionName: 'Print Debit Note' },
  // Share feature (docs/FEATURE_SHARE_BILL_REPORT_WHATSAPP_EMAIL.md Section
  // 4/5.4): Purchase Order print/export/share is a real, new capability that
  // didn't exist to permission before now — a correctly-named key, seeded at
  // the same role tier as purchaseOrders.print above (not the mislabeled key
  // itself), so printing/sharing an actual PO document requires the same
  // trust level printing a Debit Note already does.
  { permissionKey: 'purchaseOrders.printDocument', permissionName: 'Print/Export Purchase Order' },
  // Phase 61 — Bills (AP: what we owe a supplier) and Payments Made against
  // a specific Bill. Same trust tier as purchaseOrders.create/approve and
  // payments.record/reverse respectively — these are real financial
  // commitments and outflows, not floor-staff-level actions.
  { permissionKey: 'bills.view', permissionName: 'View Bills' },
  { permissionKey: 'bills.create', permissionName: 'Create Bill' },
  { permissionKey: 'bills.void', permissionName: 'Void Bill' },
  { permissionKey: 'supplierPayments.record', permissionName: 'Record Supplier Payment (Bill)' },
  { permissionKey: 'supplierPayments.reverse', permissionName: 'Reverse Supplier Payment (Bill)' },
  { permissionKey: 'supplierPayments.view', permissionName: 'View Supplier Payments (Bill)' },
  // Phase 62 — Banking, Ledger & Compliance Backbone. Journal Entries and
  // the Transaction Lock date are Admin-only (not granted to Manager below)
  // — posting a manual GL adjustment or moving the lock date are structural
  // ledger actions with a different consequence tier than recording a day-
  // to-day Bill/Payment, which Manager already has.
  { permissionKey: 'chartOfAccounts.view', permissionName: 'View Chart of Accounts' },
  { permissionKey: 'chartOfAccounts.manage', permissionName: 'Manage Chart of Accounts' },
  { permissionKey: 'journalEntries.view', permissionName: 'View Journal Entries' },
  { permissionKey: 'journalEntries.create', permissionName: 'Create Journal Entry' },
  { permissionKey: 'journalEntries.reverse', permissionName: 'Reverse Journal Entry' },
  { permissionKey: 'transactionLock.manage', permissionName: 'Set Transaction Lock Date' },
  { permissionKey: 'bankAccounts.view', permissionName: 'View Bank Accounts' },
  { permissionKey: 'bankAccounts.manage', permissionName: 'Manage Bank Accounts' },
  { permissionKey: 'bankReconciliation.view', permissionName: 'View Bank Reconciliation' },
  { permissionKey: 'bankReconciliation.import', permissionName: 'Import Bank Statement' },
  { permissionKey: 'bankReconciliation.reconcile', permissionName: 'Reconcile Bank Statement Lines' },
  { permissionKey: 'creditInterest.view', permissionName: 'View Credit Interest' },
  { permissionKey: 'creditInterest.post', permissionName: 'Post Credit Interest Charge' },
  { permissionKey: 'postDatedCheques.view', permissionName: 'View Post-Dated Cheques' },
  { permissionKey: 'postDatedCheques.manage', permissionName: 'Manage Post-Dated Cheques' },
  { permissionKey: 'fixedAssets.view', permissionName: 'View Fixed Assets' },
  { permissionKey: 'fixedAssets.manage', permissionName: 'Manage Fixed Assets' },
  { permissionKey: 'fixedAssets.runDepreciation', permissionName: 'Run Fixed Asset Depreciation' },
  // Year-End Close — Admin-only, the single highest-consequence action in
  // this phase (locks an entire year and posts the opening balances every
  // subsequent report depends on).
  { permissionKey: 'yearEndClose.execute', permissionName: 'Execute Year-End Close' },
  // Restaurant
  { permissionKey: 'restaurant.viewKOT', permissionName: 'View KOT' },
  { permissionKey: 'restaurant.updateKOT', permissionName: 'Update KOT Status' },
  { permissionKey: 'restaurant.manageTables', permissionName: 'Manage Tables' },
  { permissionKey: 'restaurant.manageRecipes', permissionName: 'Manage Recipes' },
  // Phase 47: accepting/rejecting a customer's QR-submitted order — accepting
  // creates a real Invoice + KOT, so this is scoped like billing.createInvoice
  // (Manager/Cashier), not viewKOT/updateKOT (which Kitchen Staff also has).
  { permissionKey: 'restaurant.manageOrderRequests', permissionName: 'Manage QR Order Requests' },
  // Phase 58 §2 — Distributor field-rep order capture. Accepting/rejecting a
  // rep's submitted order creates a real Invoice, so this is scoped exactly
  // like restaurant.manageOrderRequests directly above (Manager/Cashier, not
  // Staff) — the rep's own capture-side submission goes through an
  // unauthenticated LAN endpoint (see field-order-server.ts), same as QR
  // table ordering, and needs no permission of its own.
  { permissionKey: 'distributor.manageFieldOrders', permissionName: 'Manage Field-Rep Order Requests' },
  // Phase 58 §2 — Electronics repair/RMA. Same 3-way split rationale as
  // labOrders.view/create/manage: logging a claim at intake is routine
  // front-desk trust (Cashier reaches this, same as billing.createInvoice),
  // while advancing a ticket's status — especially REPLACED, which flips a
  // ProductSerial's status and effectively creates a free replacement sale —
  // needs Manager+ trust.
  { permissionKey: 'repairTickets.view', permissionName: 'View Repair Tickets' },
  { permissionKey: 'repairTickets.create', permissionName: 'Log New Repair Ticket' },
  { permissionKey: 'repairTickets.manage', permissionName: 'Update Repair Ticket Status, Vendor RMA & Replacement' },
  // HR & Attendance
  { permissionKey: 'hr.view', permissionName: 'View HR & Attendance' },
  { permissionKey: 'hr.manage', permissionName: 'Manage Employees & Salary Reference' },
  { permissionKey: 'hr.attendance', permissionName: 'Mark Attendance & Leave' },
  // Phase 24 — Clinical Notes (GP + Specialist; restricted to owner/practitioner only)
  { permissionKey: 'clinicalNotes.view', permissionName: 'View Clinical Notes' },
  { permissionKey: 'clinicalNotes.write', permissionName: 'Create & Edit Clinical Notes' },
  // Phase 50 — Diagnostic & Pathology Labs. Split 3 ways (unlike clinicalNotes'
  // 2) because lab front-desk work (registering an order, handing over an
  // already-finalized report) is routine Cashier-level trust, while sample
  // collection/result entry/finalizing is lab-technician-level trust — a
  // materially different split than a GP clinic's receptionist, who never
  // touches clinical notes at all.
  { permissionKey: 'labOrders.view', permissionName: 'View Lab Test Orders' },
  { permissionKey: 'labOrders.create', permissionName: 'Create Lab Test Order' },
  { permissionKey: 'labOrders.manage', permissionName: 'Manage Sample Collection, Results & Reports' },
  // Phase 51 — Blood Bank. Same 3-way split rationale as Labs above: donor
  // registration and viewing stock is routine front-desk trust; recording a
  // screening pass/fail result and issuing units to a recipient (a
  // compatibility-critical, clinically consequential action) is manager+
  // trust, not Cashier-reachable.
  { permissionKey: 'bloodBank.view', permissionName: 'View Blood Bank Donors, Stock & Issues' },
  { permissionKey: 'bloodBank.create', permissionName: 'Register Donor / Record Donation' },
  { permissionKey: 'bloodBank.manage', permissionName: 'Manage Screening, Issue & Cancel' },
  // Phase 37 — Logistics & Supply Chain
  { permissionKey: 'logistics.view', permissionName: 'View Logistics & Supply Chain' },
  { permissionKey: 'logistics.manage', permissionName: 'Manage Logistics & Supply Chain' },
  // Phase 4 — Service Business (Projects, Service Tickets, Job Cards, Work
  // Logs). Referenced by all 20 permission checks across 4 IPC handlers since
  // the phase shipped but never actually seeded here — same class of gap as
  // inventory.manage and billing.view/billing.create above: every route in
  // this module (including plain list/get reads) was unreachable by any role,
  // including Admin.
  { permissionKey: 'sales.view', permissionName: 'View Projects, Service Tickets & Job Cards' },
  { permissionKey: 'sales.manage', permissionName: 'Manage Projects, Service Tickets & Job Cards' },
  // Phase 54G — Rental. Bounded like billing.createInvoice/labOrders.create —
  // creating a booking, checking an item out, and processing a return are
  // routine front-desk trust (Cashier reaches this), while the asset roster
  // (adding/retiring a RentalUnit) sits under the same rental.manage gate.
  { permissionKey: 'rental.view', permissionName: 'View Rental Bookings & Catalog' },
  { permissionKey: 'rental.manage', permissionName: 'Create Bookings, Check Out/In, Manage Rental Units' },
  // Hotel/Lodge vertical. Same bounded front-desk trust level as rental.manage
  // — creating a booking, checking a guest in/out, and adding folio charges
  // are routine counter operations (Cashier reaches this); the room roster
  // (adding/deactivating a HotelRoom) sits under the same hotel.manage gate.
  { permissionKey: 'hotel.view', permissionName: 'View Hotel Rooms & Bookings' },
  { permissionKey: 'hotel.manage', permissionName: 'Create Bookings, Check In/Out Guests, Manage Rooms' },
  // Fresh-audit build (2026-07-12) — Jewellery. Split into 3, same
  // "different actions, different trust levels" reasoning as
  // labOrders.create/labOrders.manage: rate-setting affects the price of
  // EVERY future sale shop-wide (same trust level as products.modifyPricing,
  // Manager+ only), while recording an old-metal exchange is a bounded
  // per-transaction counter action (same trust level as billing.createInvoice,
  // which Cashier already has).
  { permissionKey: 'jewellery.view', permissionName: 'View Metal Rates & Exchanges' },
  { permissionKey: 'jewellery.manageRates', permissionName: 'Set Today\'s Metal Rates' },
  { permissionKey: 'jewellery.manageExchanges', permissionName: 'Record Old-Metal Exchanges' },
  // Phase 57 — AI Assistant. Deliberately Admin/Manager only, not Cashier/Staff:
  // the query catalog spans profit (analytics.viewProfit is Admin-only
  // elsewhere), supplier purchase volume, and full customer/credit visibility
  // all in one surface — granting it to a role whose normal screens don't show
  // all of that would be exactly the side-channel the spec's permission-parity
  // requirement forbids. Admin/Manager already have that breadth on their
  // normal screens, so this is genuine parity, not a new exposure.
  { permissionKey: 'ai.query', permissionName: 'Ask the AI Assistant Business Questions' },

  // ─── Security audit fix (2026-08-04) ───────────────────────────────────────
  // 59 handler files (196 call sites) across ~35 business-vertical modules
  // were using billing.createInvoice as their ONLY permission gate for
  // create/update/delete operations on entities that have nothing to do with
  // billing, because dedicated permission keys were never seeded for them.
  // Concretely this let the Cashier role — granted billing.createInvoice for
  // its real job at the checkout counter — also delete legal case files,
  // board resolutions, ROC filings, etc. via direct IPC calls, since
  // window.api exposes every method regardless of role and the IPC-layer
  // check was the only enforcement boundary that mattered. Each vertical
  // below gets its own dedicated key. List/get reads in these same files were
  // already (correctly) gated on billing.view and are untouched — only the
  // create/update/delete/action endpoints move off the mis-borrowed key.
  // Any handler's own generateInvoice-style action that genuinely creates a
  // real Invoice (verified per-file against billingService.createInvoice
  // usage) was deliberately left on billing.createInvoice, same as the
  // already-correct precedent in job-card.handler.ts/project.handler.ts/
  // service-ticket.handler.ts (sales.manage for CRUD, billing.createInvoice
  // only for the actual invoice-generating action).

  // Appointments — the generic booking/scheduling system shared by every
  // SERVICE_BASE_MODULES vertical (salons, clinics, gyms, driving schools,
  // etc.). Booking/rescheduling/checking a walk-in customer in is the same
  // front-desk, bounded trust level as billing.createInvoice (Cashier already
  // has it); deletion stays on billing.void, untouched. Reminder generation
  // (notification-queue) is tied 1:1 to the same front-desk workflow.
  { permissionKey: 'appointments.manage', permissionName: 'Create & Update Appointments' },
  { permissionKey: 'notifications.manage', permissionName: 'Generate Appointment Reminders' },

  // Gym/Fitness Studio — Batch Classes, Memberships, Session Packs, Staff
  // Commission. Selling a membership and assigning/deducting a session pack
  // are the same bounded front-desk transaction as billing.createInvoice
  // (Cashier already reaches this); enrolling/marking attendance for a batch
  // class is the same tier, split into its own key from actually
  // creating/rescheduling the CLASS ITSELF (schedule, instructor, capacity),
  // which is a shop-wide scheduling decision at the same trust tier as
  // jewellery.manageRates (Manager+ only). staffCommission.record is
  // narrower still — it fires automatically the instant a Cashier generates
  // an appointment invoice (AppointmentsScreen.tsx), so it has to stay at the
  // same trust level as billing.createInvoice or that existing checkout flow
  // breaks for Cashier.
  { permissionKey: 'batchClass.manage', permissionName: 'Create & Reschedule Batch Classes' },
  { permissionKey: 'batchClass.enroll', permissionName: 'Enroll & Mark Attendance For Batch Classes' },
  { permissionKey: 'memberships.manage', permissionName: 'Sell, Check-In & Freeze/Resume Memberships' },
  { permissionKey: 'sessionPacks.manage', permissionName: 'Sell & Deduct Session Packs' },
  { permissionKey: 'staffCommission.record', permissionName: 'Record Staff Commission At Time Of Billing' },

  // Driving School — enrolling a learner and booking/updating a driving
  // session or test is the same bounded front-desk trust level as
  // billing.createInvoice (Cashier already has it); the vehicle/package
  // master data stays on settings.modify, untouched.
  { permissionKey: 'drivingSchool.manage', permissionName: 'Manage Learner Profiles, Driving Sessions & Tests' },

  // Veterinary Clinic — registering/updating a pet's profile (name, species,
  // weight log) is the same bounded trust level as customers.create/update,
  // which Cashier already has; deletion stays on billing.void, untouched.
  // Vaccination records are actual clinical/medical history, though, so they
  // stay at the same Manager+-only trust tier as clinicalNotes — NOT
  // extended to Cashier even though pets.manage is.
  { permissionKey: 'pets.manage', permissionName: 'Register & Update Pet Profiles' },
  { permissionKey: 'vaccinations.manage', permissionName: 'Record Vaccinations & Reminders' },

  // Clinic/Lab walk-in Token Queue — calling/skipping/resetting the queue is
  // literally the front-desk receptionist's job, same trust level as
  // billing.createInvoice.
  { permissionKey: 'tokenQueue.manage', permissionName: 'Manage Walk-In Token Queue' },

  // Photo Studio — booking a shoot and adding paid add-ons at intake is the
  // same bounded counter trust level as billing.createInvoice; the shoot-day
  // equipment/crew checklist and post-shoot delivery pipeline are internal
  // production coordination, not a customer-facing transaction, so they sit
  // at Manager+ only.
  { permissionKey: 'shootBookings.manage', permissionName: 'Book Shoots & Add-Ons' },
  { permissionKey: 'shootProduction.manage', permissionName: 'Manage Shoot Checklists & Delivery Tracking' },

  // Event Management — booking an event at intake is the same bounded
  // counter trust level as billing.createInvoice; vendor contracting and
  // day-of-show run-sheet planning are back-office operational work, Manager+
  // only.
  { permissionKey: 'eventBookings.manage', permissionName: 'Book Events' },
  { permissionKey: 'eventOperations.manage', permissionName: 'Manage Event Vendor Bookings & Run-of-Show' },

  // Real Estate — property/deal/inquiry/site-visit records are agent-level
  // back-office sales-pipeline data, not a walk-in counter transaction (same
  // "default deny Cashier" reasoning as Leads/Legal/CA/CS data below) —
  // Manager+ only. propertyDeal:generateInvoice stays on
  // billing.createInvoice, untouched (it genuinely creates a real Invoice).
  { permissionKey: 'properties.manage', permissionName: 'Manage Properties, Deals, Inquiries & Site Visits' },

  // Generic Leads (CRM) — shared by Real Estate, Architect, Civil Engineer,
  // Consultant, Marketing/Software Agency, Event Management. Back-office
  // sales-pipeline data, Manager+ only — not a Cashier-reachable counter
  // transaction.
  { permissionKey: 'leads.manage', permissionName: 'Manage Leads' },

  // Lawyer — legal case files and hearing records. Manager+ only; this is
  // exactly the kind of sensitive professional client data the Cashier role
  // (billing counter staff) must never be able to touch.
  { permissionKey: 'legalCases.manage', permissionName: 'Manage Legal Cases & Hearings' },

  // CA Firm / Company Secretary — shared statutory compliance calendar
  // (compliance-task + compliance-event, the same "CA + CS" library Phase 29
  // seeds below). Manager+ only — back-office statutory tracking, not
  // customer-facing.
  { permissionKey: 'compliance.manage', permissionName: 'Manage Compliance Tasks & Events' },

  // CA Firm — client engagements and their document checklists. Manager+
  // only; engagement:generateInvoice stays on billing.createInvoice, untouched.
  { permissionKey: 'engagements.manage', permissionName: 'Manage Client Engagements & Document Checklists' },

  // Company Secretary — board meetings/resolutions and ROC filings are
  // statutory corporate-governance records. Manager+ only.
  { permissionKey: 'boardGovernance.manage', permissionName: 'Manage Board Meetings & Resolutions' },
  { permissionKey: 'rocFilings.manage', permissionName: 'Manage ROC Filings' },

  // Architect — drawing register/revisions. Manager+ only.
  { permissionKey: 'drawingRegister.manage', permissionName: 'Manage Drawing Revisions' },

  // Civil Engineer — site visit log & material test results. Manager+ only.
  { permissionKey: 'siteVisitLog.manage', permissionName: 'Manage Site Visits & Material Test Results' },

  // Architect / Civil Engineer / Consultant / Marketing & Software Agency —
  // professional-services projects (Phase 30's ServiceProject, distinct from
  // the legacy Phase 4 sales.manage-gated Project model) and their
  // milestones. Manager+ only; milestone:generateInvoice stays on
  // billing.createInvoice, untouched.
  { permissionKey: 'serviceProjects.manage', permissionName: 'Manage Service Projects & Milestones' },

  // Independent Consultant / Marketing & Software Agency — retainer
  // agreements. Manager+ only; retainer:generateInvoice stays on
  // billing.createInvoice, untouched.
  { permissionKey: 'retainers.manage', permissionName: 'Manage Retainer Agreements' },

  // Marketing Agency — campaign performance & content calendar. Manager+ only.
  { permissionKey: 'marketingCampaigns.manage', permissionName: 'Manage Marketing Campaigns & Content Calendar' },

  // Software Agency — issue tracker (issues/comments/subtasks) and sprints.
  // Manager+ only (conservative default — a dev-team member's own ticket
  // updates would also reasonably need this, but the app has no dedicated
  // "Developer" role to scope it to, so it stays at the Manager tier rather
  // than opening it to Cashier/Staff).
  { permissionKey: 'issueTracker.manage', permissionName: 'Manage Issues, Comments & Sprints' },

  // Time-billed professions (Lawyer/CA/CS/Architect/Civil Engineer/
  // Consultant/Software Agency) — logged time entries. Manager+ only
  // (conservative default, same reasoning as issueTracker.manage above);
  // timeEntry:generateInvoice stays on billing.createInvoice, untouched.
  { permissionKey: 'timeEntries.manage', permissionName: 'Manage Time Entries' },

  // Coaching Institute — registering a new student is the same bounded
  // front-desk trust level as customers.create, which Cashier already has;
  // editing/deleting an existing student record is Manager+ only.
  { permissionKey: 'students.create', permissionName: 'Register New Student' },
  { permissionKey: 'students.manage', permissionName: 'Update & Delete Student Profiles' },
  // Batch/curriculum scheduling, syllabus topics, and performance/recital
  // events are shop-wide curriculum decisions, same trust tier as
  // jewellery.manageRates — Manager+ only. (Also covers StudentTestScore —
  // real academic mark/grade records, same sensitivity as the recital/
  // syllabus data it's grouped with here.)
  { permissionKey: 'coachingBatches.manage', permissionName: 'Manage Coaching Batches, Syllabus, Performances & Test Scores' },
  // Enrolling a student into a batch at the front desk is the same bounded
  // trust level as billing.createInvoice; updating/deleting an enrollment,
  // promoting from a waitlist, and recording attendance are Manager+ only.
  { permissionKey: 'coachingEnrollment.create', permissionName: 'Enroll Student In Batch' },
  { permissionKey: 'coachingEnrollment.manage', permissionName: 'Update Enrollments, Waitlist & Attendance' },
  // Generating a month's fee-due records is a bulk administrative batch job
  // (all active enrollments at once), not a per-customer counter
  // transaction — Manager+ only. coachingFee:update (marking a record PAID,
  // which conditionally creates a real Invoice) stays on
  // billing.createInvoice, untouched.
  { permissionKey: 'coachingFees.manage', permissionName: 'Generate Monthly Coaching Fees' },

  // Car Service Center — opening a job card at intake is the same bounded
  // trust level as repairTickets.create (Cashier already has that exact
  // pattern elsewhere); updating/deleting a job card or scheduling a service
  // reminder is Manager+ only. carJobCard:generateInvoice stays on
  // billing.createInvoice, untouched.
  { permissionKey: 'carJobCard.create', permissionName: 'Open New Car Job Card' },
  { permissionKey: 'carJobCard.manage', permissionName: 'Update, Delete & Schedule Reminders For Car Job Cards' },

  // Tailor Boutique — taking a new order and recording a customer's
  // measurements at the counter is the same bounded trust level as
  // billing.createInvoice; editing an order, setting/clearing assigned
  // fabric, scheduling a trial appointment, and updating/deleting a
  // measurement record are Manager+ only. tailoringOrder:generateInvoice
  // stays on billing.createInvoice, untouched.
  { permissionKey: 'tailoringOrders.create', permissionName: 'Take New Tailoring Order & Record Measurements' },
  { permissionKey: 'tailoringOrders.manage', permissionName: 'Update Tailoring Orders, Fabric & Trial Scheduling' },

  // Pest Control — contracts and job sheets (incl. pesticide usage records)
  // are B2B field-service scheduling, not a walk-in counter transaction —
  // Manager+ only. Both handlers' generateInvoice actions stay on
  // billing.createInvoice, untouched.
  { permissionKey: 'pestControl.manage', permissionName: 'Manage Pest Contracts & Job Sheets' },

  // Placement Agency — candidates, interview rounds, placements, and client
  // job orders are recruitment back-office work, Manager+ only.
  // placement:generateInvoice stays on billing.createInvoice, untouched.
  { permissionKey: 'placements.manage', permissionName: 'Manage Candidates, Interviews, Placements & Job Orders' },

  // Retail Returns & Cash Drawer Close. A return reverses a completed sale
  // (refunds money/restocks goods) — same Manager+-only trust tier as
  // payments.reverse, not Cashier-reachable. Cash-drawer close is the
  // Cashier's own literal end-of-shift task (counting and recording their own
  // drawer), same trust level as the reports.print end-of-shift workflow
  // Cashier already has.
  { permissionKey: 'billing.manageReturns', permissionName: 'Process Sales Returns' },
  { permissionKey: 'billing.cashClose', permissionName: 'Close Cash Drawer' }
]

// Role → permission assignments from PERMISSIONS_MATRIX.md
const ROLE_PERMISSIONS: Record<string, string[]> = {
  Admin: PERMISSIONS.map((p) => p.permissionKey),
  Manager: [
    'auth.login', 'auth.changeOwnPassword',
    'users.view', 'roles.view',
    'customers.view', 'customers.create', 'customers.update', 'customers.archive', 'customers.viewLedger', 'customers.modifyCreditLimit',
    'suppliers.view', 'suppliers.create', 'suppliers.update', 'suppliers.archive', 'suppliers.viewLedger', 'suppliers.recordPayment',
    'products.view', 'products.create', 'products.update', 'products.archive', 'products.modifyPricing', 'products.printLabels',
    'inventory.view', 'inventory.addStock', 'inventory.adjustStock', 'inventory.viewMovements', 'inventory.valuation', 'inventory.manage',
    'billing.createInvoice', 'billing.editDraftInvoice', 'billing.cancelInvoice', 'billing.printInvoice', 'billing.view', 'billing.create', 'billing.void',
    'payments.record', 'payments.reverse', 'payments.view',
    'expenses.view', 'expenses.create', 'expenses.modify',
    'reports.view', 'reports.sales', 'reports.invoices', 'reports.financial', 'reports.tax', 'reports.inventory', 'reports.outstanding', 'reports.export', 'reports.print',
    'analytics.viewDashboard', 'analytics.viewRevenue', 'analytics.viewInventory',
    'import.execute',
    'backup.create', 'backup.view',
    'settings.view',
    'audit.view',
    'purchaseOrders.view', 'purchaseOrders.create', 'purchaseOrders.approve', 'purchaseOrders.receive', 'purchaseOrders.cancel', 'purchaseOrders.print', 'purchaseOrders.printDocument',
    'bills.view', 'bills.create', 'bills.void', 'supplierPayments.record', 'supplierPayments.reverse', 'supplierPayments.view',
    // Phase 62 — Chart of Accounts/Journal Entries view-only for Manager
    // (posting/reversing a manual entry and moving the lock date stay
    // Admin-only, see the permission definitions' own comment above);
    // day-to-day Bank Accounts + reconciliation are full Manager actions,
    // same trust tier as Bills/Payments.
    'chartOfAccounts.view', 'journalEntries.view',
    'bankAccounts.view', 'bankAccounts.manage', 'bankReconciliation.view', 'bankReconciliation.import', 'bankReconciliation.reconcile',
    'creditInterest.view', 'creditInterest.post', 'postDatedCheques.view', 'postDatedCheques.manage',
    // fixedAssets.runDepreciation stays Admin-only — a GL-wide batch
    // operation with year-end-close-adjacent consequence, same tier as
    // Journal Entry posting/reversal and the Transaction Lock date above.
    'fixedAssets.view', 'fixedAssets.manage',
    'restaurant.viewKOT', 'restaurant.updateKOT', 'restaurant.manageTables', 'restaurant.manageRecipes', 'restaurant.manageOrderRequests',
    'distributor.manageFieldOrders',
    'repairTickets.view', 'repairTickets.create', 'repairTickets.manage',
    'hr.view', 'hr.manage', 'hr.attendance',
    'clinicalNotes.view', 'clinicalNotes.write',
    'labOrders.view', 'labOrders.create', 'labOrders.manage',
    'bloodBank.view', 'bloodBank.create', 'bloodBank.manage',
    // Manager is already trusted with inventory.adjustStock and PO create/approve
    // — withholding the GRN module from them while only Admin can use it left a
    // real gap. Not extended to Cashier/Staff: unlike the bounded purchaseOrders.receive
    // they have (executing receipt against an already-approved, cost-fixed PO),
    // a GRN can be created, self-verified, and self-posted by the same person with
    // no second approver, directly creating supplier ledger debits — that needs
    // Manager-level trust, not floor-staff-level.
    'logistics.view', 'logistics.manage',
    'sales.view', 'sales.manage',
    'rental.view', 'rental.manage',
    'hotel.view', 'hotel.manage',
    'jewellery.view', 'jewellery.manageRates', 'jewellery.manageExchanges',
    'ai.query',
    // Security audit fix (2026-08-04) — dedicated vertical permission keys
    // replacing the mis-borrowed billing.createInvoice gate (see PERMISSIONS
    // above for full per-vertical reasoning). Manager gets all of them, same
    // "operational control" breadth Manager already has everywhere else.
    'appointments.manage', 'notifications.manage',
    'batchClass.manage', 'batchClass.enroll', 'memberships.manage', 'sessionPacks.manage', 'staffCommission.record',
    'drivingSchool.manage',
    'pets.manage', 'vaccinations.manage',
    'tokenQueue.manage',
    'shootBookings.manage', 'shootProduction.manage',
    'eventBookings.manage', 'eventOperations.manage',
    'properties.manage', 'leads.manage',
    'legalCases.manage',
    'compliance.manage', 'engagements.manage',
    'boardGovernance.manage', 'rocFilings.manage',
    'drawingRegister.manage', 'siteVisitLog.manage',
    'serviceProjects.manage', 'retainers.manage', 'marketingCampaigns.manage', 'issueTracker.manage', 'timeEntries.manage',
    'students.create', 'students.manage', 'coachingBatches.manage', 'coachingEnrollment.create', 'coachingEnrollment.manage', 'coachingFees.manage',
    'carJobCard.create', 'carJobCard.manage',
    'tailoringOrders.create', 'tailoringOrders.manage',
    'pestControl.manage',
    'placements.manage',
    'billing.manageReturns', 'billing.cashClose'
  ],
  Cashier: [
    'auth.login', 'auth.changeOwnPassword',
    'customers.view', 'customers.create', 'customers.update', 'customers.viewLedger',
    'products.view', 'products.printLabels',
    'inventory.view',
    'billing.createInvoice', 'billing.editDraftInvoice', 'billing.printInvoice', 'billing.view', 'billing.create',
    'payments.record', 'payments.view',
    // Export/print scoped to the two report types Cashier can already view (Sales,
    // Customer Ledger) — covers the real end-of-shift "print today's sales" workflow.
    'reports.sales', 'reports.invoices', 'reports.export', 'reports.print',
    'analytics.viewDashboard',
    'restaurant.viewKOT', 'restaurant.updateKOT', 'restaurant.manageOrderRequests',
    'distributor.manageFieldOrders',
    // Cashier can log a new claim at intake (bounded, per-transaction — same
    // trust level as billing.createInvoice) but cannot advance its status,
    // set vendor RMA details, or link a replacement unit (repairTickets.manage
    // stays Manager+ — REPLACED effectively gives away a free unit).
    'repairTickets.view', 'repairTickets.create',
    // Bounded, not a financial-integrity risk: a PO's quantities/costs are
    // already fixed by whoever created+approved it (Manager/Admin only).
    // Letting whoever is on the floor check off a delivery against it — without
    // also granting the ability to create spend commitments, override approvals,
    // or freely rewrite recorded stock counts (inventory.adjustStock stays
    // Manager+) — matches how small shops actually receive goods day to day.
    'purchaseOrders.view', 'purchaseOrders.receive',
    // Front-desk registration/handover at a diagnostics lab — Cashier can log a
    // new order and see status/print an already-finalized report, but cannot
    // collect samples or enter/edit results (labOrders.manage stays Manager+).
    'labOrders.view', 'labOrders.create',
    // Cashier can register a donor and record a donation intake, and view
    // stock/issue history — but cannot record a screening result or issue
    // units to a recipient (bloodBank.manage stays Manager+, same rationale).
    'bloodBank.view', 'bloodBank.create',
    // Booking/checkout/return at a rental counter is the same trust level as
    // billing.createInvoice, which Cashier already has.
    'rental.view', 'rental.manage',
    // Front-desk check-in/out at a hotel is the same bounded, per-transaction
    // trust level — same reasoning as rental.manage immediately above.
    'hotel.view', 'hotel.manage',
    // Recording an old-metal exchange at the counter is the same bounded,
    // per-transaction trust level — but NOT jewellery.manageRates, which
    // affects the price of every future sale shop-wide (Manager+ only).
    'jewellery.view', 'jewellery.manageExchanges',
    // Security audit fix (2026-08-04) — narrow, bounded grants only, exactly
    // matching the per-transaction/front-desk actions Cashier already has
    // elsewhere (billing.createInvoice/repairTickets.create/rental.manage/
    // hotel.manage/customers.create). Everything else in the newly-seeded
    // vertical permissions above (legal cases, board/ROC filings, compliance
    // tasks, leads, real-estate deals, professional-services projects/
    // retainers/time entries/issue tracker, pest control, placement agency,
    // coaching curriculum/fees, vaccinations, sales returns) is deliberately
    // NOT granted here — that back-office/professional/clinical data is
    // exactly what the Cashier role (billing counter staff) must not reach.
    'appointments.manage', 'notifications.manage', // front-desk booking/reminders
    'batchClass.enroll', // enrolling a walk-in member into a class, not scheduling the class itself
    'memberships.manage', // selling/checking in a membership at the counter
    'sessionPacks.manage', // selling/deducting a session pack at the counter
    'staffCommission.record', // fires automatically alongside Cashier's own appointment-invoice generation
    'drivingSchool.manage', // enrolling a learner / booking a driving session at the counter
    'pets.manage', // registering/updating a pet profile — same tier as customers.create/update
    'tokenQueue.manage', // running the walk-in token queue is the front-desk job itself
    'shootBookings.manage', // booking a shoot & add-ons at intake
    'eventBookings.manage', // booking an event at intake
    'students.create', // registering a new student — same tier as customers.create
    'coachingEnrollment.create', // enrolling a student into a batch at the front desk
    'carJobCard.create', // opening a job card at intake — same tier as repairTickets.create
    'tailoringOrders.create', // taking a new order / recording measurements at the counter
    'billing.cashClose' // counting/recording their own drawer at end of shift, same tier as reports.print
  ],
  Staff: [
    'auth.login', 'auth.changeOwnPassword',
    'customers.view',
    'products.view',
    'inventory.view',
    'analytics.viewDashboard',
    'purchaseOrders.view', 'purchaseOrders.receive',
    'rental.view',
    'hotel.view',
    'jewellery.view',
    'repairTickets.view'
  ],
  'Kitchen Staff': [
    'auth.login', 'auth.changeOwnPassword',
    'products.view',
    'inventory.view',
    'restaurant.viewKOT', 'restaurant.updateKOT'
  ]
}

const DEFAULT_EXPENSE_CATEGORIES = [
  'Rent', 'Salaries & Wages', 'Utilities', 'Raw Materials',
  'Transport & Delivery', 'Maintenance & Repairs', 'Advertising',
  'Office Supplies', 'Bank Charges', 'Miscellaneous'
]

// GST slabs for India — both CGST and SGST components
const DEFAULT_GST_CONFIGS = [
  { taxName: 'GST Exempt', taxType: 'GST', rate: 0 },
  { taxName: 'CGST @ 2.5%', taxType: 'CGST', rate: 2.5 },
  { taxName: 'SGST @ 2.5%', taxType: 'SGST', rate: 2.5 },
  { taxName: 'CGST @ 6%', taxType: 'CGST', rate: 6 },
  { taxName: 'SGST @ 6%', taxType: 'SGST', rate: 6 },
  { taxName: 'CGST @ 9%', taxType: 'CGST', rate: 9 },
  { taxName: 'SGST @ 9%', taxType: 'SGST', rate: 9 },
  { taxName: 'CGST @ 14%', taxType: 'CGST', rate: 14 },
  { taxName: 'SGST @ 14%', taxType: 'SGST', rate: 14 }
]

export async function seedDefaultData(): Promise<void> {
  const db = getPrisma()

  // Upsert roles
  for (const role of ROLES) {
    await db.role.upsert({
      where: { roleName: role.roleName },
      create: role,
      update: { description: role.description }
    })
  }

  // Upsert permissions
  for (const perm of PERMISSIONS) {
    await db.permission.upsert({
      where: { permissionKey: perm.permissionKey },
      create: perm,
      update: { permissionName: perm.permissionName }
    })
  }

  // Seed default industry templates
  await seedDefaultTemplates()

  // Seed role-permission assignments
  for (const [roleName, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await db.role.findUnique({ where: { roleName } })
    if (!role) continue

    for (const key of permKeys) {
      const perm = await db.permission.findUnique({ where: { permissionKey: key } })
      if (!perm) continue

      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        create: { roleId: role.id, permissionId: perm.id },
        update: {}
      })
    }
  }

  // Seed default expense categories (idempotent — skip if already present)
  for (const categoryName of DEFAULT_EXPENSE_CATEGORIES) {
    const existing = await db.expenseCategory.findUnique({ where: { categoryName } })
    if (!existing) {
      await db.expenseCategory.create({ data: { categoryName } })
    }
  }

  // Seed default GST tax configurations (idempotent)
  for (const cfg of DEFAULT_GST_CONFIGS) {
    const existing = await db.taxConfiguration.findFirst({ where: { taxName: cfg.taxName, taxType: cfg.taxType } })
    if (!existing) {
      await db.taxConfiguration.create({ data: { ...cfg, country: 'IN', isActive: true } })
    }
  }

  // Seed default leave types (idempotent)
  await seedDefaultLeaveTypes()

  // Phase 29 — Seed statutory compliance event library (CA + CS)
  const { seedComplianceEvents } = await import('../services/compliance-event.service')
  await seedComplianceEvents()

  // Phase 54B — seed the universal vitals/lab normal-range library; runs on
  // every launch (self-healing) so already-installed databases (not just
  // fresh setups) get it, same precedent as Phase 38's products.printLabels
  // permission backfill.
  const { seedDefaultNormalRanges } = await import('../services/normal-range.service')
  await seedDefaultNormalRanges()

  // Phase 54D — prune audit log rows past the retention window on every
  // launch, same self-healing precedent as the two imports above. Cheap
  // no-op on a fresh/small install; keeps disk usage bounded on a long-lived one.
  const { pruneOldAuditLogs } = await import('../services/audit.service')
  await pruneOldAuditLogs()
}
