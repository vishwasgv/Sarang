import { useIndustryStore } from '@app/store/industry.store'

// Founder ask (2026-09-23): the word "Customer" reads wrong for the 5
// clinic verticals (GP/Specialist/Dental/Vet/Physio) — a doctor's front
// desk thinks in "Patients", not "Customers". Every other vertical
// (retail, services, everything else) must keep "Customer" exactly as-is.
//
// Gated on the `doctor_pad` module flag rather than hardcoding the 5
// business-type strings a second time — doctor_pad is already enabled on
// exactly those 5 verticals and nowhere else (see
// industry-template.service.ts), so this can never drift out of sync with
// that list. Matches this codebase's "config flags only, no
// template-specific if/else" convention.
//
// Deliberately scoped to the highest-visibility labels a doctor's front
// desk actually reads day to day (nav, list screen, the picker used when
// booking a visit, the detail screen's own header/breadcrumbs) — NOT the
// deeper retail/credit vocabulary those same screens also carry (Credit
// Limit, Ledger, Interest Accrued, Risk Tier), which stays "Customer"-
// flavoured everywhere since renaming those to "Patient X" would read
// worse, not better, and those features are rarely used by a clinic.
export function usePatientNoun() {
  const isDoctorVertical = useIndustryStore((s) => s.isModuleEnabled('doctor_pad'))
  // Vet Clinic correction: this Customer row is the pet's OWNER, not the
  // patient — the pet (a separate Pet record) is. Calling the owner list
  // "Patients" would be actively wrong, not just imprecise, so Vet Clinic
  // gets its own correct noun ("Owner") while the other 4 clinic verticals
  // (where the Customer row IS the person being treated) get "Patient".
  const businessType = useIndustryStore((s) => s.businessType)
  const isVetClinic = businessType === 'VET_CLINIC'
  const noun = isVetClinic ? 'Owner' : 'Patient'
  // Medical fields (allergies/blood group/etc.) belong to the PATIENT —
  // correct for GP/Specialist/Dental/Physio (Customer IS the patient), but
  // wrong for Vet Clinic's owner record (the pet is the patient, and this
  // pass doesn't add pet-level medical fields) — so that section/capability
  // is gated on this, not on isDoctorVertical alone.
  const hasPatientMedicalRecord = isDoctorVertical && !isVetClinic

  return {
    isDoctorVertical,
    isVetClinic,
    hasPatientMedicalRecord,
    singular: isDoctorVertical ? noun : 'Customer',
    plural: isDoctorVertical ? `${noun}s` : 'Customers',
    searchPlaceholder: isDoctorVertical ? 'Search by name or phone…' : 'Search by name or phone...',
    addNew: isDoctorVertical ? `Add New ${noun}` : 'Add New Customer',
  }
}
