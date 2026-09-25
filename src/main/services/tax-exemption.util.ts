// A customer marked tax exempt may hold a certificate that runs out. After its last day the customer is charged tax again.

/** True while the exemption counts: it is switched on and its certificate (if it has an end date) has not expired. */
export function taxExemptionActive(row: { taxExempt?: boolean | null; taxExemptExpiry?: Date | string | null }, now: Date = new Date()): boolean {
  if (!row.taxExempt) return false
  if (!row.taxExemptExpiry) return true
  const end = new Date(row.taxExemptExpiry)
  if (Number.isNaN(end.getTime())) return true
  // valid through the whole expiry day
  const lastMoment = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999)
  return now.getTime() <= lastMoment.getTime()
}
