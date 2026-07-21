import { ipcMain } from 'electron'
import { register as registerAuth } from './handlers/auth.handler'
import { register as registerUsers } from './handlers/users.handler'
import { register as registerAudit } from './handlers/audit.handler'
import { register as registerApp } from './handlers/app.handler'
import { register as registerAnalytics } from './handlers/analytics.handler'
import { register as registerTax } from './handlers/tax.handler'
import { register as registerIndustry } from './handlers/industry.handler'
import { register as registerOperations } from './handlers/operations.handler'
import { register as registerReports } from './handlers/reports.handler'
import { register as registerExport } from './handlers/export.handler'
import { register as registerCustomers } from './handlers/customers.handler'
import { register as registerSuppliers } from './handlers/suppliers.handler'
import { register as registerProducts } from './handlers/products.handler'
import { register as registerInventory } from './handlers/inventory.handler'
import { register as registerPurchaseOrders } from './handlers/purchase-orders.handler'
import { register as registerExpenses } from './handlers/expenses.handler'
import { register as registerPayments } from './handlers/payments.handler'
import { register as registerImport } from './handlers/import.handler'
import { register as registerBackup } from './handlers/backup.handler'
import { register as registerBilling } from './handlers/billing.handler'
import { register as registerBatches } from './handlers/batch.handler'
import { register as registerSerials } from './handlers/serial.handler'
import { register as registerVariants } from './handlers/variant.handler'
import { register as registerRawMaterials } from './handlers/raw-material.handler'
import { register as registerBom } from './handlers/bom.handler'
import { register as registerProduction } from './handlers/production.handler'
import { register as registerWorkOrders } from './handlers/work-order.handler'
import { register as registerDispatch } from './handlers/dispatch.handler'
import { register as registerProjects } from './handlers/project.handler'
import { register as registerTickets } from './handlers/service-ticket.handler'
import { register as registerJobCards } from './handlers/job-card.handler'
import { register as registerWorkLogs } from './handlers/work-log.handler'
import { register as registerDocuments } from './handlers/document.handler'
import { register as registerHr } from './handlers/hr.handler'
import { register as registerPayroll } from './handlers/payroll.handler'
import { register as registerRental } from './handlers/rental.handler'
import { register as registerHotel } from './handlers/hotel.handler'
import { register as registerMetalRate } from './handlers/metal-rate.handler'
import { register as registerMetalExchange } from './handlers/metal-exchange.handler'
import { register as registerAi } from './handlers/ai.handler'
import { register as registerDrawingRevision } from './handlers/drawing-revision.handler'
import { register as registerMarketingCampaign } from './handlers/marketing-campaign.handler'
import { register as registerSiteVisit } from './handlers/site-visit.handler'
import { register as registerQuotations } from './handlers/quotation.handler'
import { register as registerCreditNotes } from './handlers/credit-note.handler'
import { register as registerDebitNotes } from './handlers/debit-note.handler'
// Phase 22 — Service Business Foundation
import { register as registerAppointments } from './handlers/appointment.handler'
import { register as registerServiceCatalog } from './handlers/service-catalog.handler'
import { register as registerProviderSchedule } from './handlers/provider-schedule.handler'
import { register as registerNotificationQueue } from './handlers/notification-queue.handler'
// Phase 23 — Veterinary
import { register as registerPets } from './handlers/pet.handler'
import { register as registerVaccinations } from './handlers/vaccination.handler'
// Phase 24 — Medical (GP + Specialist)
import { register as registerVisitNotes } from './handlers/visit-note.handler'
import { register as registerTokenQueue } from './handlers/token-queue.handler'
import { register as registerNormalRange } from './handlers/normal-range.handler'
// Phase 50 — Diagnostic & Pathology Labs
import { register as registerLabTestOrders } from './handlers/lab-test-order.handler'
// Phase 51 — Blood Bank
import { register as registerBloodBank } from './handlers/blood-bank.handler'
// Phase 25 — Dental Clinic
import { register as registerToothRecords } from './handlers/tooth-record.handler'
// Phase 58 §2 — Beauty Salon
import { register as registerProviderSkills } from './handlers/service-provider-skill.handler'
import { register as registerTreatmentPlans } from './handlers/treatment-plan.handler'
import { register as registerRecallRecords } from './handlers/recall-record.handler'
// Phase 26 — Physiotherapy Clinic
import { register as registerTreatmentPhases } from './handlers/treatment-phase.handler'
import { register as registerExercisePrograms } from './handlers/exercise-program.handler'
import { register as registerSessionPacks } from './handlers/session-pack.handler'
// Phase 27 — Salon, Gym/Studio, Driving School
import { register as registerStaffCommission } from './handlers/staff-commission.handler'
import { register as registerMemberships } from './handlers/membership.handler'
import { register as registerBatchClasses } from './handlers/batch-class.handler'
import { register as registerDriving } from './handlers/driving.handler'
// Phase 28 — Legal
import { register as registerLegalCase } from './handlers/legal-case.handler'
import { register as registerHearing } from './handlers/hearing.handler'
import { register as registerTimeEntry } from './handlers/time-entry.handler'
// Phase 29 — CA + CS
import { register as registerComplianceEvent } from './handlers/compliance-event.handler'
import { register as registerClientDocumentChecklist } from './handlers/client-document-checklist.handler'
import { register as registerComplianceTask } from './handlers/compliance-task.handler'
import { register as registerEngagement } from './handlers/engagement.handler'
import { register as registerROCFiling } from './handlers/roc-filing.handler'
import { register as registerBoardMeeting } from './handlers/board-meeting.handler'
import { register as registerBoardResolution } from './handlers/board-resolution.handler'
// Phase 30 — Architect, Civil, Consultant, Agency
import { register as registerLead } from './handlers/lead.handler'
import { register as registerServiceProject } from './handlers/service-project.handler'
import { register as registerMilestone } from './handlers/service-project-milestone.handler'
import { register as registerRetainer } from './handlers/retainer.handler'
import { register as registerIssue } from './handlers/issue.handler'
import { register as registerSprint } from './handlers/sprint.handler'
// Phase 31 — Coaching Institute
import { register as registerStudentProfile } from './handlers/student-profile.handler'
import { register as registerCoachingBatch } from './handlers/coaching-batch.handler'
import { register as registerEnrollment } from './handlers/coaching-batch-enrollment.handler'
import { register as registerCoachingAttendance } from './handlers/coaching-batch-attendance.handler'
import { register as registerCoachingFee } from './handlers/coaching-fee.handler'
import { register as registerCoachingSyllabus } from './handlers/coaching-syllabus.handler'
import { register as registerCoachingProgress } from './handlers/coaching-progress.handler'
import { register as registerPerformance } from './handlers/performance.handler'
import { register as registerStudentTestScore } from './handlers/student-test-score.handler'
// Phase 32 — Photography, Event Management, Real Estate
import { registerShootBooking } from './handlers/shoot-booking.handler'
import { registerDeliveryTracker } from './handlers/delivery-tracker.handler'
import { registerShootChecklist } from './handlers/shoot-checklist.handler'
import { registerShootAddOn } from './handlers/shoot-addon.handler'
import { registerEventBooking } from './handlers/event-booking.handler'
import { registerEventVendorBooking } from './handlers/event-vendor-booking.handler'
import { registerEventRunOfShow } from './handlers/event-run-of-show.handler'
import { registerReservations } from './handlers/reservation.handler'
import { registerProperty } from './handlers/property.handler'
import { registerPropertyInquiry } from './handlers/property-inquiry.handler'
import { registerPropertySiteVisit } from './handlers/property-site-visit.handler'
import { registerPropertyDeal } from './handlers/property-deal.handler'
// Phase 33 — Car Service, Tailor Boutique, Pest Control
import { registerCarJobCard } from './handlers/car-job-card.handler'
import { registerMeasurementRecord } from './handlers/measurement-record.handler'
import { registerTailoringOrder } from './handlers/tailoring-order.handler'
import { registerPestContract } from './handlers/pest-contract.handler'
import { registerPestJobSheet } from './handlers/pest-job-sheet.handler'
// Phase 34 — Placement Agency
import { registerCandidate } from './handlers/candidate.handler'
import { registerJobOrder } from './handlers/job-order.handler'
import { registerInterviewRound } from './handlers/interview-round.handler'
import { registerPlacement } from './handlers/placement.handler'
// Phase 37 — Logistics & Supply Chain
import { registerLogisticsVehicleHandlers } from './handlers/logistics-vehicle.handler'
import { registerLogisticsCarrierHandlers } from './handlers/logistics-carrier.handler'
import { registerLogisticsShipmentHandlers } from './handlers/logistics-shipment.handler'
import { registerLogisticsGrnHandlers } from './handlers/logistics-grn.handler'
import { registerLogisticsChallanHandlers } from './handlers/logistics-challan.handler'
import { registerLogisticsFreightHandlers } from './handlers/logistics-freight.handler'
import { registerLogisticsAnalyticsHandlers } from './handlers/logistics-analytics.handler'
import { register as registerKitchenDisplay } from './handlers/kitchen-display.handler'
import { register as registerRepairTickets } from './handlers/repair-ticket.handler'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function handle(channel: string, handler: (payload: unknown) => Promise<unknown>): void {
  ipcMain.handle(channel, async (_event, payload) => {
    try {
      return await handler(payload)
    } catch (err) {
      console.error(`[IPC] Error in ${channel}:`, err)
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  })
}

export function registerAllIpcHandlers(): void {
  const h: HandleFn = handle

  registerAuth(h)
  registerUsers(h)
  registerAudit(h)
  registerApp(h)
  registerAnalytics(h)
  registerTax(h)
  registerIndustry(h)
  registerOperations(h)
  registerReports(h)
  registerExport(h)
  registerCustomers(h)
  registerSuppliers(h)
  registerProducts(h)
  registerInventory(h)
  registerPurchaseOrders(h)
  registerExpenses(h)
  registerPayments(h)
  registerImport(h)
  registerBackup(h)
  registerBilling(h)
  registerBatches(h)
  registerSerials(h)
  registerVariants(h)
  registerRawMaterials(h)
  registerBom(h)
  registerProduction(h)
  registerWorkOrders(h)
  registerDispatch(h)
  registerProjects(h)
  registerTickets(h)
  registerJobCards(h)
  registerWorkLogs(h)
  registerDocuments(h)
  registerHr(h)
  registerPayroll(h)
  registerRental(h)
  registerHotel(h)
  registerMetalRate(h)
  registerMetalExchange(h)
  registerDrawingRevision(h)
  registerMarketingCampaign(h)
  registerSiteVisit(h)
  registerAi(h)
  registerQuotations(h)
  registerCreditNotes(h)
  registerDebitNotes(h)
  // Phase 22 — Service Business Foundation
  registerAppointments(h)
  registerServiceCatalog(h)
  registerProviderSchedule(h)
  registerNotificationQueue(h)
  // Phase 23 — Veterinary
  registerPets(h)
  registerVaccinations(h)
  // Phase 24 — Medical
  registerVisitNotes(h)
  registerTokenQueue(h)
  registerNormalRange(h)
  // Phase 25 — Dental
  registerToothRecords(h)
  registerTreatmentPlans(h)
  registerRecallRecords(h)
  // Phase 58 §2 — Beauty Salon
  registerProviderSkills(h)
  // Phase 26 — Physio
  registerTreatmentPhases(h)
  registerExercisePrograms(h)
  registerSessionPacks(h)
  // Phase 27 — Salon, Gym/Studio, Driving School
  registerStaffCommission(h)
  registerMemberships(h)
  registerBatchClasses(h)
  registerDriving(h)
  registerLegalCase(h)
  registerHearing(h)
  registerTimeEntry(h)
  // Phase 29 — CA + CS
  registerComplianceEvent(h)
  registerClientDocumentChecklist(h)
  registerComplianceTask(h)
  registerEngagement(h)
  registerROCFiling(h)
  registerBoardMeeting(h)
  registerBoardResolution(h)
  // Phase 30 — Architect, Civil, Consultant, Agency
  registerLead(h)
  registerServiceProject(h)
  registerMilestone(h)
  registerRetainer(h)
  registerIssue(h)
  registerSprint(h)
  // Phase 31 — Coaching Institute
  registerStudentProfile(h)
  registerCoachingBatch(h)
  registerEnrollment(h)
  registerCoachingAttendance(h)
  registerCoachingFee(h)
  registerCoachingSyllabus(h)
  registerCoachingProgress(h)
  registerPerformance(h)
  registerStudentTestScore(h)
  // Phase 32 — Photography, Event Management, Real Estate
  registerShootBooking(h)
  registerDeliveryTracker(h)
  registerShootChecklist(h)
  registerShootAddOn(h)
  registerEventBooking(h)
  registerEventVendorBooking(h)
  registerEventRunOfShow(h)
  registerReservations(h)
  registerProperty(h)
  registerPropertyInquiry(h)
  registerPropertySiteVisit(h)
  registerPropertyDeal(h)
  // Phase 33 — Car Service, Tailor Boutique, Pest Control
  registerCarJobCard(h)
  registerMeasurementRecord(h)
  registerTailoringOrder(h)
  registerPestContract(h)
  registerPestJobSheet(h)
  // Phase 34 — Placement Agency
  registerCandidate(h)
  registerJobOrder(h)
  registerInterviewRound(h)
  registerPlacement(h)
  // Phase 37 — Logistics & Supply Chain
  registerLogisticsVehicleHandlers(h)
  registerLogisticsCarrierHandlers(h)
  registerLogisticsShipmentHandlers(h)
  registerLogisticsGrnHandlers(h)
  registerLogisticsChallanHandlers(h)
  registerLogisticsFreightHandlers(h)
  registerLogisticsAnalyticsHandlers(h)
  // Phase 50 — Diagnostic & Pathology Labs
  registerLabTestOrders(h)
  // Phase 51 — Blood Bank
  registerBloodBank(h)
  registerKitchenDisplay(h)
  // Phase 58 §2 — Electronics repair/RMA
  registerRepairTickets(h)

  console.log('[IPC] All handlers registered')
}
