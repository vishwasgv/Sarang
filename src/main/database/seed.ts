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
  { permissionKey: 'purchaseOrders.print', permissionName: 'Print Debit Note' },
  // Restaurant
  { permissionKey: 'restaurant.viewKOT', permissionName: 'View KOT' },
  { permissionKey: 'restaurant.updateKOT', permissionName: 'Update KOT Status' },
  { permissionKey: 'restaurant.manageTables', permissionName: 'Manage Tables' },
  { permissionKey: 'restaurant.manageRecipes', permissionName: 'Manage Recipes' },
  // Phase 47: accepting/rejecting a customer's QR-submitted order — accepting
  // creates a real Invoice + KOT, so this is scoped like billing.createInvoice
  // (Manager/Cashier), not viewKOT/updateKOT (which Kitchen Staff also has).
  { permissionKey: 'restaurant.manageOrderRequests', permissionName: 'Manage QR Order Requests' },
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
  { permissionKey: 'ai.query', permissionName: 'Ask the AI Assistant Business Questions' }
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
    'purchaseOrders.view', 'purchaseOrders.create', 'purchaseOrders.approve', 'purchaseOrders.receive', 'purchaseOrders.cancel', 'purchaseOrders.print',
    'restaurant.viewKOT', 'restaurant.updateKOT', 'restaurant.manageTables', 'restaurant.manageRecipes', 'restaurant.manageOrderRequests',
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
    'ai.query'
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
    'jewellery.view', 'jewellery.manageExchanges'
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
    'jewellery.view'
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
