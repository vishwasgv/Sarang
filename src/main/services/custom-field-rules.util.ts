// Checks the values typed into custom fields against the rules the owner set on each field.

export interface FieldRuleDefinition {
  id: string
  fieldName: string
  fieldType: string
  selectOptions: string[] | null
  isActive: boolean
  isRequired: boolean
  minValue: number | null
  maxValue: number | null
  pattern: string | null
  patternHint: string | null
}

const isBlank = (v: unknown) => v === undefined || v === null || String(v).trim() === ''

/**
 * Returns the first problem found, or null when every value is fine.
 * `mustBeComplete` (creating a record) means required fields have to be filled;
 * when editing, only fields present in `values` are checked so older records are not blocked.
 */
export function validateCustomFieldValues(
  defs: FieldRuleDefinition[],
  values: Record<string, string | number> | undefined,
  mustBeComplete: boolean
): string | null {
  for (const d of defs) {
    if (!d.isActive) continue
    const present = values !== undefined && Object.prototype.hasOwnProperty.call(values, d.id)
    const v = present ? values![d.id] : undefined
    if (isBlank(v)) {
      if (d.isRequired && (mustBeComplete || present)) return `${d.fieldName} is required.`
      continue
    }
    if (d.fieldType === 'NUMBER') {
      const n = Number(v)
      if (!Number.isFinite(n)) return `${d.fieldName} must be a number.`
      if (d.minValue !== null && n < d.minValue) return `${d.fieldName} must be at least ${d.minValue}.`
      if (d.maxValue !== null && n > d.maxValue) return `${d.fieldName} must be at most ${d.maxValue}.`
    } else if (d.fieldType === 'DATE') {
      if (Number.isNaN(new Date(String(v)).getTime())) return `${d.fieldName} must be a valid date.`
    } else if (d.fieldType === 'SELECT') {
      if (d.selectOptions && !d.selectOptions.includes(String(v))) return `${d.fieldName} must be one of the listed options.`
    } else if (d.pattern) {
      let ok = true
      try { ok = new RegExp(d.pattern).test(String(v)) } catch { ok = true }
      if (!ok) return d.patternHint?.trim() || `${d.fieldName} is not in the expected format.`
    }
  }
  return null
}
