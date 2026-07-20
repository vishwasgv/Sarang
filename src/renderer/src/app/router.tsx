import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth.store'
import { AppLayout } from '@shared/ui/layout/AppLayout'
import { LoginScreen } from '@modules/auth/ui/LoginScreen'
import { SetupWizard } from '@modules/setup/ui/SetupWizard'
import { DashboardScreen } from '@modules/dashboard/ui/DashboardScreen'
import { SettingsScreen } from '@modules/settings/ui/SettingsScreen'
import { ProductsScreen } from '@modules/products/ui/ProductsScreen'
import { PrintLabelsScreen } from '@modules/products/ui/PrintLabelsScreen'
import { CustomersScreen } from '@modules/customers/ui/CustomersScreen'
import { CustomerDetailScreen } from '@modules/customers/ui/CustomerDetailScreen'
import { SuppliersScreen } from '@modules/suppliers/ui/SuppliersScreen'
import { SupplierDetailScreen } from '@modules/suppliers/ui/SupplierDetailScreen'
import { InventoryScreen } from '@modules/inventory/ui/InventoryScreen'
import { InventoryMovementsScreen } from '@modules/inventory/ui/InventoryMovementsScreen'
import { PurchaseOrdersScreen } from '@modules/inventory/ui/PurchaseOrdersScreen'
import { PurchaseOrderDetailScreen } from '@modules/inventory/ui/PurchaseOrderDetailScreen'
import { BillingScreen } from '@modules/billing/ui/BillingScreen'
import { InvoiceListScreen } from '@modules/billing/ui/InvoiceListScreen'
import { InvoiceDetailScreen } from '@modules/billing/ui/InvoiceDetailScreen'
import { PaymentHistoryScreen } from '@modules/billing/ui/PaymentHistoryScreen'
import { QuotationsScreen } from '@modules/billing/ui/QuotationsScreen'
import { QuotationFormScreen } from '@modules/billing/ui/QuotationFormScreen'
import { CreditNotesScreen } from '@modules/billing/ui/CreditNotesScreen'
import { DebitNotesScreen } from '@modules/billing/ui/DebitNotesScreen'
import { ReportsScreen } from '@modules/reports/ui/ReportsScreen'
import { BackupScreen } from '@modules/backup/ui/BackupScreen'
import { ImportWizardScreen } from '@modules/import/ui/ImportWizardScreen'
import { RestaurantTablesScreen } from '@modules/restaurant/ui/RestaurantTablesScreen'
import { KOTScreen } from '@modules/restaurant/ui/KOTScreen'
import { RecipesScreen } from '@modules/restaurant/ui/RecipesScreen'
import { KitchenDisplayBoardScreen } from '@modules/restaurant/ui/KitchenDisplayBoardScreen'
import { ReturnScreen } from '@modules/retail/ui/ReturnScreen'
import { IndustrySettingsScreen } from '@modules/industry/ui/IndustrySettingsScreen'
import { AboutScreen } from '@modules/settings/ui/AboutScreen'
import { ManualScreen } from '@modules/manual/ui/ManualScreen'
import { DisclaimerScreen } from '@modules/disclaimer/ui/DisclaimerScreen'
import { BackupPromptScreen } from '@modules/backup/ui/BackupPromptScreen'
import { BulkOrderScreen } from '@modules/distributor/ui/BulkOrderScreen'
import { OutstandingAnalyticsScreen } from '@modules/distributor/ui/OutstandingAnalyticsScreen'
import { FieldOrdersScreen } from '@modules/distributor/ui/FieldOrdersScreen'
import { CustomerPricingScreen } from '@modules/distributor/ui/CustomerPricingScreen'
import { AuditLogsScreen } from '@modules/audit/ui/AuditLogsScreen'
import { ExpensesScreen } from '@modules/expenses/ui/ExpensesScreen'
import { CashCloseScreen } from '@modules/cashclose/ui/CashCloseScreen'
import { BatchManagementScreen } from '@modules/inventory/ui/BatchManagementScreen'
import { SerialTrackingScreen } from '@modules/inventory/ui/SerialTrackingScreen'
import { RepairTicketsScreen } from '@modules/inventory/ui/RepairTicketsScreen'
import { AgriInputsDashboardScreen } from '@modules/inventory/ui/AgriInputsDashboardScreen'
import { RawMaterialsScreen } from '@modules/manufacturing/ui/RawMaterialsScreen'
import { BillOfMaterialsScreen } from '@modules/manufacturing/ui/BillOfMaterialsScreen'
import { ProductionOrdersScreen } from '@modules/manufacturing/ui/ProductionOrdersScreen'
import { FinishedGoodsScreen } from '@modules/manufacturing/ui/FinishedGoodsScreen'
import { DispatchTrackingScreen } from '@modules/manufacturing/ui/DispatchTrackingScreen'
import { VendorManagementScreen } from '@modules/manufacturing/ui/VendorManagementScreen'
import { ProductionAnalyticsScreen } from '@modules/manufacturing/ui/ProductionAnalyticsScreen'
import { ProjectsScreen } from '@modules/service/ui/ProjectsScreen'
import { ProjectDetailScreen } from '@modules/service/ui/ProjectDetailScreen'
import { ServiceTicketsScreen } from '@modules/service/ui/ServiceTicketsScreen'
import { JobCardsScreen } from '@modules/service/ui/JobCardsScreen'
import { WorkTrackingScreen } from '@modules/service/ui/WorkTrackingScreen'
import { CustomerHistoryScreen } from '@modules/service/ui/CustomerHistoryScreen'
import { DocumentsScreen } from '@modules/documents/ui/DocumentsScreen'
import { EmployeesScreen } from '@modules/hr/ui/EmployeesScreen'
import { AttendanceScreen } from '@modules/hr/ui/AttendanceScreen'
import { LeaveScreen } from '@modules/hr/ui/LeaveScreen'
import { PayrollScreen } from '@modules/hr/ui/PayrollScreen'
// Phase 22 — Service Business Foundation
import { AppointmentsScreen } from '@modules/service-business/ui/AppointmentsScreen'
import { ServiceCatalogScreen } from '@modules/service-business/ui/ServiceCatalogScreen'
import { NormalRangesScreen } from '@modules/service-business/ui/NormalRangesScreen'
import { ProviderScheduleScreen } from '@modules/service-business/ui/ProviderScheduleScreen'
import { NotificationQueueScreen } from '@modules/service-business/ui/NotificationQueueScreen'
// Phase 23 — Veterinary
import { PetListScreen } from '@modules/service-business/ui/PetListScreen'
import { PetProfileScreen } from '@modules/service-business/ui/PetProfileScreen'
// Phase 24 — Medical
import { TokenQueueScreen } from '@modules/service-business/ui/TokenQueueScreen'
import { VisitNoteScreen } from '@modules/service-business/ui/VisitNoteScreen'
import { ClinicalNotesListScreen } from '@modules/service-business/ui/ClinicalNotesListScreen'
// Phase 50 — Diagnostic & Pathology Labs
import { LabOrdersScreen } from '@modules/service-business/ui/LabOrdersScreen'
// Phase 51 — Blood Bank
import { DonorsScreen } from '@modules/blood-bank/ui/DonorsScreen'
import { DonationsScreen } from '@modules/blood-bank/ui/DonationsScreen'
import { BloodStockScreen } from '@modules/blood-bank/ui/BloodStockScreen'
import { BloodIssueScreen } from '@modules/blood-bank/ui/BloodIssueScreen'
import { RentalBookingsScreen } from '@modules/rental/ui/RentalBookingsScreen'
import { RentalUnitsScreen } from '@modules/rental/ui/RentalUnitsScreen'
import { HotelBookingsScreen } from '@modules/hotel/ui/HotelBookingsScreen'
import { HotelRoomsScreen } from '@modules/hotel/ui/HotelRoomsScreen'
import { HotelHousekeepingScreen } from '@modules/hotel/ui/HotelHousekeepingScreen'
import { AiAssistantScreen } from '@modules/ai/ui/AiAssistantScreen'
import { MetalRatesScreen } from '@modules/jewellery/ui/MetalRatesScreen'
import { MetalExchangeScreen } from '@modules/jewellery/ui/MetalExchangeScreen'
// Phase 25 — Dental
import { DentalPatientScreen } from '@modules/service-business/ui/DentalPatientScreen'
import { RecallListScreen } from '@modules/service-business/ui/RecallListScreen'
// Phase 26 — Physio
import { PhysioPatientScreen } from '@modules/service-business/ui/PhysioPatientScreen'
import { SessionPacksScreen } from '@modules/service-business/ui/SessionPacksScreen'
// Phase 27 — Salon, Gym, Driving School
import { StaffCommissionScreen } from '@modules/service-business/ui/StaffCommissionScreen'
import { MembershipsScreen } from '@modules/service-business/ui/MembershipsScreen'
import { BatchClassesScreen } from '@modules/service-business/ui/BatchClassesScreen'
import { DrivingSchoolScreen } from '@modules/service-business/ui/DrivingSchoolScreen'
// Phase 28 — Legal
import { LegalCasesScreen } from '@modules/service-business/ui/LegalCasesScreen'
// Phase 29 — CA + CS
import ComplianceScreen from '@modules/service-business/ui/ComplianceScreen'
import EngagementsScreen from '@modules/service-business/ui/EngagementsScreen'
import ROCFilingsScreen from '@modules/service-business/ui/ROCFilingsScreen'
import TimeEntryScreen from '@modules/service-business/ui/TimeEntryScreen'
// Phase 30 — Architect, Civil, Consultant, Agency
import LeadsScreen from '@modules/service-business/ui/LeadsScreen'
import ServiceProjectsScreen from '@modules/service-business/ui/ProjectsScreen'
import RetainersScreen from '@modules/service-business/ui/RetainersScreen'
import IssuesScreen from '@modules/service-business/ui/IssuesScreen'
import { DrawingRegisterScreen } from '@modules/service-business/ui/DrawingRegisterScreen'
import { SiteVisitsScreen } from '@modules/service-business/ui/SiteVisitsScreen'
// Phase 31 — Coaching Institute
import StudentsScreen from '@modules/service-business/ui/StudentsScreen'
import BatchesScreen from '@modules/service-business/ui/BatchesScreen'
import CoachingAttendanceScreen from '@modules/service-business/ui/AttendanceScreen'
import FeesScreen from '@modules/service-business/ui/FeesScreen'
import PerformanceScreen from '@modules/service-business/ui/PerformanceScreen'
import TestScoresScreen from '@modules/service-business/ui/TestScoresScreen'
// Phase 32 — Photography, Event Management, Real Estate
import ShootsScreen from '@modules/service-business/ui/ShootsScreen'
import EventsScreen from '@modules/service-business/ui/EventsScreen'
import PropertiesScreen from '@modules/service-business/ui/PropertiesScreen'
// Phase 33 — Car Service, Tailor Boutique, Pest Control
import CarJobCardsScreen from '@modules/service-business/ui/CarJobCardsScreen'
import TailoringScreen from '@modules/service-business/ui/TailoringScreen'
import PestControlScreen from '@modules/service-business/ui/PestControlScreen'
// Phase 34 — Placement Agency
import PlacementScreen from '@modules/service-business/ui/PlacementScreen'
// Phase 37 — Logistics & Supply Chain
import FleetScreen from '@modules/logistics/ui/FleetScreen'
import CarriersScreen from '@modules/logistics/ui/CarriersScreen'
import ShipmentsScreen from '@modules/logistics/ui/ShipmentsScreen'
import GRNScreen from '@modules/logistics/ui/GRNScreen'
import ChallanScreen from '@modules/logistics/ui/ChallanScreen'
import FreightLedgerScreen from '@modules/logistics/ui/FreightLedgerScreen'
import LogisticsAnalyticsScreen from '@modules/logistics/ui/LogisticsAnalyticsScreen'
import { api } from '@renderer/services/ipc-client'

export function AppRouter() {
  const { user, isLoading } = useAuthStore()
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null)
  const [disclaimerAccepted, setDisclaimerAccepted] = useState<boolean | null>(null)
  // Deliberately NOT loaded in checkSetup() below — backup:* channels are
  // session-gated (unlike the disclaimer flag), so this can only be checked
  // once `user` actually exists, not during the pre-login setup/disclaimer
  // check. Reset to null (unresolved) whenever `user` changes so a logout
  // followed by a different user logging in re-evaluates it fresh.
  const [backupPromptDismissed, setBackupPromptDismissed] = useState<boolean | null>(null)

  useEffect(() => {
    checkSetup()
  }, [])

  useEffect(() => {
    if (!user) { setBackupPromptDismissed(null); return }
    api.app.isBackupPromptDismissed().then((res) => setBackupPromptDismissed(res.data ?? true))
  }, [user])

  async function checkSetup() {
    const [setupRes, disclaimerRes] = await Promise.all([
      api.setup.isSetupComplete(),
      api.app.isDisclaimerAccepted()
    ])
    setSetupComplete(setupRes.data ?? false)
    setDisclaimerAccepted(disclaimerRes.data ?? false)
  }

  if (isLoading || setupComplete === null || disclaimerAccepted === null) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!setupComplete) {
    return <SetupWizard onComplete={() => setSetupComplete(true)} />
  }

  if (!disclaimerAccepted) {
    return <DisclaimerScreen onAccepted={() => setDisclaimerAccepted(true)} />
  }

  if (!user) {
    return <LoginScreen />
  }

  if (backupPromptDismissed === null) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (backupPromptDismissed === false) {
    return <BackupPromptScreen onDone={() => setBackupPromptDismissed(true)} />
  }

  return (
    <Routes>
      {/* Sibling of AppLayout, deliberately — this is a full-screen wall
          board (second-monitor Kitchen Display), no sidebar/chrome. */}
      <Route path="/kitchen-display" element={<ProtectedRoute permission="restaurant.viewKOT"><KitchenDisplayBoardScreen /></ProtectedRoute>} />
      <Route element={<AppLayout />}>
        {/* Dashboard — all authenticated users */}
        <Route index element={<ProtectedRoute permission="analytics.viewDashboard"><DashboardScreen /></ProtectedRoute>} />

        {/* Module routes — permission-guarded */}
        <Route path="/billing" element={<ProtectedRoute permission="billing.view"><InvoiceListScreen /></ProtectedRoute>} />
        <Route path="/billing/new" element={<ProtectedRoute permission="billing.createInvoice"><BillingScreen /></ProtectedRoute>} />
        <Route path="/billing/quotations" element={<ProtectedRoute permission="billing.view"><QuotationsScreen /></ProtectedRoute>} />
        <Route path="/billing/quotations/new" element={<ProtectedRoute permission="billing.create"><QuotationFormScreen /></ProtectedRoute>} />
        <Route path="/billing/credit-notes" element={<ProtectedRoute permission="billing.view"><CreditNotesScreen /></ProtectedRoute>} />
        <Route path="/billing/debit-notes" element={<ProtectedRoute permission="purchaseOrders.view"><DebitNotesScreen /></ProtectedRoute>} />
        <Route path="/billing/invoices/:id" element={<ProtectedRoute permission="billing.view"><InvoiceDetailScreen /></ProtectedRoute>} />
        <Route path="/billing/:id" element={<ProtectedRoute permission="billing.view"><InvoiceDetailScreen /></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute permission="payments.view"><PaymentHistoryScreen /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute permission="products.view"><ProductsScreen /></ProtectedRoute>} />
        <Route path="/products/print-labels" element={<ProtectedRoute permission="products.view"><PrintLabelsScreen /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute permission="inventory.view"><InventoryScreen /></ProtectedRoute>} />
        <Route path="/inventory/movements" element={<ProtectedRoute permission="inventory.viewMovements"><InventoryMovementsScreen /></ProtectedRoute>} />
        <Route path="/purchase-orders" element={<ProtectedRoute permission="purchaseOrders.view"><PurchaseOrdersScreen /></ProtectedRoute>} />
        <Route path="/purchase-orders/:id" element={<ProtectedRoute permission="purchaseOrders.view"><PurchaseOrderDetailScreen /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute permission="customers.view"><CustomersScreen /></ProtectedRoute>} />
        <Route path="/customers/:id" element={<ProtectedRoute permission="customers.view"><CustomerDetailScreen /></ProtectedRoute>} />
        <Route path="/suppliers" element={<ProtectedRoute permission="suppliers.view"><SuppliersScreen /></ProtectedRoute>} />
        <Route path="/suppliers/:id" element={<ProtectedRoute permission="suppliers.view"><SupplierDetailScreen /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute permission="expenses.view"><ExpensesScreen /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute permission="reports.sales"><ReportsScreen /></ProtectedRoute>} />
        <Route path="/backup" element={<ProtectedRoute permission="backup.view"><BackupScreen /></ProtectedRoute>} />
        <Route path="/import" element={<ProtectedRoute permission="import.execute"><ImportWizardScreen /></ProtectedRoute>} />
        {/* Restaurant routes */}
        <Route path="/restaurant/tables" element={<ProtectedRoute permission="restaurant.manageTables"><RestaurantTablesScreen /></ProtectedRoute>} />
        <Route path="/restaurant/kot" element={<ProtectedRoute permission="restaurant.viewKOT"><KOTScreen /></ProtectedRoute>} />
        <Route path="/restaurant/recipes" element={<ProtectedRoute permission="restaurant.manageRecipes"><RecipesScreen /></ProtectedRoute>} />
        {/* Retail returns */}
        <Route path="/returns" element={<ProtectedRoute permission="billing.createInvoice"><ReturnScreen /></ProtectedRoute>} />
        {/* Distributor routes */}
        <Route path="/distributor/bulk-order" element={<ProtectedRoute permission="billing.createInvoice"><BulkOrderScreen /></ProtectedRoute>} />
        <Route path="/distributor/outstanding" element={<ProtectedRoute permission="customers.view"><OutstandingAnalyticsScreen /></ProtectedRoute>} />
        {/* Phase 58 §2 — Distributor field-rep order capture + customer-class pricing */}
        <Route path="/distributor/field-orders" element={<ProtectedRoute permission="distributor.manageFieldOrders"><FieldOrdersScreen /></ProtectedRoute>} />
        <Route path="/distributor/pricing" element={<ProtectedRoute permission="products.modifyPricing"><CustomerPricingScreen /></ProtectedRoute>} />
        {/* Phase 2 — Industry Expansion */}
        <Route path="/pharmacy/batches" element={<ProtectedRoute permission="inventory.view"><BatchManagementScreen /></ProtectedRoute>} />
        <Route path="/electronics/serials" element={<ProtectedRoute permission="inventory.view"><SerialTrackingScreen /></ProtectedRoute>} />
        {/* Phase 58 §2 — Electronics repair/RMA workflow */}
        <Route path="/electronics/repair-tickets" element={<ProtectedRoute permission="repairTickets.view"><RepairTicketsScreen /></ProtectedRoute>} />
        {/* Phase 58 §2 — Agri Inputs combined consumables+equipment dashboard */}
        <Route path="/agri/dashboard" element={<ProtectedRoute permission="inventory.view"><AgriInputsDashboardScreen /></ProtectedRoute>} />
        {/* Phase 3 — Manufacturing Lite */}
        <Route path="/manufacturing/raw-materials" element={<ProtectedRoute permission="inventory.view"><RawMaterialsScreen /></ProtectedRoute>} />
        <Route path="/manufacturing/bom" element={<ProtectedRoute permission="inventory.view"><BillOfMaterialsScreen /></ProtectedRoute>} />
        <Route path="/manufacturing/production" element={<ProtectedRoute permission="inventory.view"><ProductionOrdersScreen /></ProtectedRoute>} />
        <Route path="/manufacturing/finished-goods" element={<ProtectedRoute permission="inventory.view"><FinishedGoodsScreen /></ProtectedRoute>} />
        <Route path="/manufacturing/dispatch" element={<ProtectedRoute permission="inventory.view"><DispatchTrackingScreen /></ProtectedRoute>} />
        <Route path="/manufacturing/vendors" element={<ProtectedRoute permission="suppliers.view"><VendorManagementScreen /></ProtectedRoute>} />
        <Route path="/manufacturing/analytics" element={<ProtectedRoute permission="reports.sales"><ProductionAnalyticsScreen /></ProtectedRoute>} />
        {/* Phase 4 — Service Business Module */}
        <Route path="/service/projects" element={<ProtectedRoute permission="sales.view"><ProjectsScreen /></ProtectedRoute>} />
        <Route path="/service/projects/:id" element={<ProtectedRoute permission="sales.view"><ProjectDetailScreen /></ProtectedRoute>} />
        <Route path="/service/tickets" element={<ProtectedRoute permission="sales.view"><ServiceTicketsScreen /></ProtectedRoute>} />
        <Route path="/service/job-cards" element={<ProtectedRoute permission="sales.view"><JobCardsScreen /></ProtectedRoute>} />
        <Route path="/service/work-tracking" element={<ProtectedRoute permission="sales.view"><WorkTrackingScreen /></ProtectedRoute>} />
        <Route path="/service/customer-history" element={<ProtectedRoute permission="customers.view"><CustomerHistoryScreen /></ProtectedRoute>} />
        {/* Phase 11 — Document Management */}
        <Route path="/documents" element={<ProtectedRoute permission="settings.view"><DocumentsScreen /></ProtectedRoute>} />
        {/* Phase 17 — HR & Attendance */}
        <Route path="/hr/employees" element={<ProtectedRoute permission="hr.view"><EmployeesScreen /></ProtectedRoute>} />
        <Route path="/hr/attendance" element={<ProtectedRoute permission="hr.attendance"><AttendanceScreen /></ProtectedRoute>} />
        <Route path="/hr/leave" element={<ProtectedRoute permission="hr.view"><LeaveScreen /></ProtectedRoute>} />
        <Route path="/hr/payroll" element={<ProtectedRoute permission="hr.view"><PayrollScreen /></ProtectedRoute>} />
        {/* Phase 22 — Service Business Foundation */}
        <Route path="/appointments" element={<ProtectedRoute permission="billing.view"><AppointmentsScreen /></ProtectedRoute>} />
        <Route path="/service-catalog" element={<ProtectedRoute permission="settings.view"><ServiceCatalogScreen /></ProtectedRoute>} />
        <Route path="/normal-ranges" element={<ProtectedRoute permission="clinicalNotes.view"><NormalRangesScreen /></ProtectedRoute>} />
        <Route path="/provider-schedule" element={<ProtectedRoute permission="settings.view"><ProviderScheduleScreen /></ProtectedRoute>} />
        <Route path="/service-notifications" element={<ProtectedRoute permission="billing.view"><NotificationQueueScreen /></ProtectedRoute>} />
        {/* Phase 23 — Veterinary */}
        <Route path="/vet/pets" element={<ProtectedRoute permission="billing.view"><PetListScreen /></ProtectedRoute>} />
        <Route path="/vet/pets/:id" element={<ProtectedRoute permission="billing.view"><PetProfileScreen /></ProtectedRoute>} />
        {/* Phase 24 — Medical */}
        <Route path="/clinical/queue" element={<ProtectedRoute permission="billing.view"><TokenQueueScreen /></ProtectedRoute>} />
        <Route path="/clinical/visit/:appointmentId" element={<ProtectedRoute permission="clinicalNotes.view"><VisitNoteScreen /></ProtectedRoute>} />
        <Route path="/clinical/notes" element={<ProtectedRoute permission="clinicalNotes.view"><ClinicalNotesListScreen /></ProtectedRoute>} />
        {/* Phase 50 — Diagnostic & Pathology Labs */}
        <Route path="/lab/orders" element={<ProtectedRoute permission="labOrders.view"><LabOrdersScreen /></ProtectedRoute>} />
        {/* Phase 51 — Blood Bank */}
        <Route path="/blood-bank/donors" element={<ProtectedRoute permission="bloodBank.view"><DonorsScreen /></ProtectedRoute>} />
        <Route path="/blood-bank/donations" element={<ProtectedRoute permission="bloodBank.view"><DonationsScreen /></ProtectedRoute>} />
        <Route path="/blood-bank/stock" element={<ProtectedRoute permission="bloodBank.view"><BloodStockScreen /></ProtectedRoute>} />
        <Route path="/blood-bank/issue" element={<ProtectedRoute permission="bloodBank.view"><BloodIssueScreen /></ProtectedRoute>} />
        <Route path="/rental/bookings" element={<ProtectedRoute permission="rental.view"><RentalBookingsScreen /></ProtectedRoute>} />
        <Route path="/rental/units" element={<ProtectedRoute permission="rental.view"><RentalUnitsScreen /></ProtectedRoute>} />
        <Route path="/hotel/bookings" element={<ProtectedRoute permission="hotel.view"><HotelBookingsScreen /></ProtectedRoute>} />
        <Route path="/hotel/rooms" element={<ProtectedRoute permission="hotel.view"><HotelRoomsScreen /></ProtectedRoute>} />
        <Route path="/hotel/housekeeping" element={<ProtectedRoute permission="hotel.view"><HotelHousekeepingScreen /></ProtectedRoute>} />
        <Route path="/ai-assistant" element={<ProtectedRoute permission="ai.query"><AiAssistantScreen /></ProtectedRoute>} />
        <Route path="/jewellery/metal-rates" element={<ProtectedRoute permission="jewellery.view"><MetalRatesScreen /></ProtectedRoute>} />
        <Route path="/jewellery/exchanges" element={<ProtectedRoute permission="jewellery.view"><MetalExchangeScreen /></ProtectedRoute>} />
        {/* Phase 25 — Dental */}
        <Route path="/dental/patient/:patientId" element={<ProtectedRoute permission="clinicalNotes.view"><DentalPatientScreen /></ProtectedRoute>} />
        <Route path="/dental/recalls" element={<ProtectedRoute permission="billing.view"><RecallListScreen /></ProtectedRoute>} />
        {/* Phase 26 — Physio */}
        <Route path="/physio/patient/:patientId" element={<ProtectedRoute permission="clinicalNotes.view"><PhysioPatientScreen /></ProtectedRoute>} />
        <Route path="/physio/session-packs" element={<ProtectedRoute permission="billing.view"><SessionPacksScreen /></ProtectedRoute>} />
        {/* Phase 27 — Salon, Gym, Driving School */}
        <Route path="/commission" element={<ProtectedRoute permission="billing.view"><StaffCommissionScreen /></ProtectedRoute>} />
        <Route path="/gym/memberships" element={<ProtectedRoute permission="billing.view"><MembershipsScreen /></ProtectedRoute>} />
        <Route path="/gym/classes" element={<ProtectedRoute permission="billing.view"><BatchClassesScreen /></ProtectedRoute>} />
        <Route path="/driving/learners" element={<ProtectedRoute permission="billing.view"><DrivingSchoolScreen /></ProtectedRoute>} />
        <Route path="/driving/sessions" element={<ProtectedRoute permission="billing.view"><DrivingSchoolScreen /></ProtectedRoute>} />
        {/* Phase 28 — Legal */}
        <Route path="/legal/cases" element={<ProtectedRoute permission="billing.view"><LegalCasesScreen /></ProtectedRoute>} />
        {/* Phase 29 — CA + CS */}
        <Route path="/ca-cs/compliance" element={<ProtectedRoute permission="billing.view"><ComplianceScreen /></ProtectedRoute>} />
        <Route path="/ca-cs/engagements" element={<ProtectedRoute permission="billing.view"><EngagementsScreen /></ProtectedRoute>} />
        <Route path="/cs/roc-filings" element={<ProtectedRoute permission="billing.view"><ROCFilingsScreen /></ProtectedRoute>} />
        <Route path="/professional/time-entries" element={<ProtectedRoute permission="billing.view"><TimeEntryScreen /></ProtectedRoute>} />
        {/* Phase 30 — Architect, Civil, Consultant, Agency */}
        <Route path="/service/leads" element={<ProtectedRoute permission="billing.view"><LeadsScreen /></ProtectedRoute>} />
        <Route path="/service/service-projects" element={<ProtectedRoute permission="billing.view"><ServiceProjectsScreen /></ProtectedRoute>} />
        <Route path="/service/retainers" element={<ProtectedRoute permission="billing.view"><RetainersScreen /></ProtectedRoute>} />
        <Route path="/service/issues" element={<ProtectedRoute permission="billing.view"><IssuesScreen /></ProtectedRoute>} />
        <Route path="/service/drawing-register" element={<ProtectedRoute permission="billing.view"><DrawingRegisterScreen /></ProtectedRoute>} />
        <Route path="/service/site-visits" element={<ProtectedRoute permission="billing.view"><SiteVisitsScreen /></ProtectedRoute>} />
        {/* Phase 31 — Coaching Institute */}
        <Route path="/coaching/students" element={<ProtectedRoute permission="billing.view"><StudentsScreen /></ProtectedRoute>} />
        <Route path="/coaching/batches" element={<ProtectedRoute permission="billing.view"><BatchesScreen /></ProtectedRoute>} />
        <Route path="/coaching/attendance" element={<ProtectedRoute permission="billing.view"><CoachingAttendanceScreen /></ProtectedRoute>} />
        <Route path="/coaching/fees" element={<ProtectedRoute permission="billing.view"><FeesScreen /></ProtectedRoute>} />
        <Route path="/coaching/performances" element={<ProtectedRoute permission="billing.view"><PerformanceScreen /></ProtectedRoute>} />
        <Route path="/coaching/test-scores" element={<ProtectedRoute permission="billing.view"><TestScoresScreen /></ProtectedRoute>} />
        {/* Phase 32 — Photography, Event Management, Real Estate */}
        <Route path="/photo/shoots" element={<ProtectedRoute permission="billing.view"><ShootsScreen /></ProtectedRoute>} />
        <Route path="/events/list" element={<ProtectedRoute permission="billing.view"><EventsScreen /></ProtectedRoute>} />
        <Route path="/realestate/properties" element={<ProtectedRoute permission="billing.view"><PropertiesScreen /></ProtectedRoute>} />
        {/* Phase 33 — Car Service, Tailor Boutique, Pest Control */}
        <Route path="/carservice/jobs" element={<ProtectedRoute permission="billing.view"><CarJobCardsScreen /></ProtectedRoute>} />
        <Route path="/tailor/orders" element={<ProtectedRoute permission="billing.view"><TailoringScreen /></ProtectedRoute>} />
        <Route path="/pest/contracts" element={<ProtectedRoute permission="billing.view"><PestControlScreen /></ProtectedRoute>} />
        {/* Phase 34 — Placement Agency */}
        <Route path="/placement/candidates" element={<ProtectedRoute permission="billing.view"><PlacementScreen /></ProtectedRoute>} />
        {/* Phase 37 — Logistics & Supply Chain */}
        <Route path="/logistics/fleet" element={<ProtectedRoute permission="logistics.view"><FleetScreen /></ProtectedRoute>} />
        <Route path="/logistics/carriers" element={<ProtectedRoute permission="logistics.view"><CarriersScreen /></ProtectedRoute>} />
        <Route path="/logistics/shipments" element={<ProtectedRoute permission="logistics.view"><ShipmentsScreen /></ProtectedRoute>} />
        <Route path="/logistics/grn" element={<ProtectedRoute permission="logistics.view"><GRNScreen /></ProtectedRoute>} />
        <Route path="/logistics/challan" element={<ProtectedRoute permission="logistics.view"><ChallanScreen /></ProtectedRoute>} />
        <Route path="/logistics/freight" element={<ProtectedRoute permission="logistics.view"><FreightLedgerScreen /></ProtectedRoute>} />
        <Route path="/logistics/analytics" element={<ProtectedRoute permission="logistics.view"><LogisticsAnalyticsScreen /></ProtectedRoute>} />
        {/* Industry settings */}
        <Route path="/settings/industry" element={<ProtectedRoute permission="settings.modify"><IndustrySettingsScreen /></ProtectedRoute>} />
        <Route path="/cash-close" element={<ProtectedRoute permission="billing.createInvoice"><CashCloseScreen /></ProtectedRoute>} />
        <Route path="/audit" element={<ProtectedRoute permission="audit.view"><AuditLogsScreen /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute permission="settings.view"><SettingsScreen /></ProtectedRoute>} />
        <Route path="/about" element={<AboutScreen />} />
        <Route path="/manual/*" element={<ManualScreen />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

// Route-level permission guard — renders AccessDeniedScreen if user lacks permission
function ProtectedRoute({ permission, children }: { permission: string; children: React.ReactNode }) {
  const hasPermission = useAuthStore((s) => s.hasPermission)

  if (!hasPermission(permission)) {
    return <AccessDeniedScreen />
  }

  return <>{children}</>
}

function AccessDeniedScreen() {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-64">
      <div className="bg-white rounded-xl border border-slate-200 shadow-card p-8 text-center max-w-sm">
        <div className="w-12 h-12 rounded-xl bg-danger/10 flex items-center justify-center mx-auto mb-4">
          <span className="text-danger font-bold text-xl">!</span>
        </div>
        <h2 className="text-base font-semibold text-dark mb-2">Access Denied</h2>
        <p className="text-sm text-slate-500">You don't have permission to view this page. Contact your administrator.</p>
      </div>
    </div>
  )
}

