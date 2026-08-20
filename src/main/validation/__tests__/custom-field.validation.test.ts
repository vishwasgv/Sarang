import { describe, it, expect } from 'vitest'
import { CreateCustomFieldDefinitionSchema, ListCustomFieldDefinitionsSchema } from '../custom-field.validation'

// Phase 67 §9.1 — General item 2 widened entityType from a strict 5-value
// enum to also accept a namespaced CUSTOM_DOCUMENT:<id> pattern. This locks
// in that BOTH halves still behave correctly — the 5 existing built-in
// entity forms (Invoice/Customer/Supplier/Product/Expense) must keep
// working exactly as before, and the new pattern must be precisely
// validated (a real cuid, not arbitrary text), not loosened into an
// anything-goes string.
describe('custom-field.validation — widened entityType', () => {
  it('still accepts every original built-in entity type', () => {
    for (const entityType of ['INVOICE', 'CUSTOMER', 'SUPPLIER', 'PRODUCT', 'EXPENSE']) {
      const res = CreateCustomFieldDefinitionSchema.safeParse({ entityType, fieldName: 'Test', fieldType: 'TEXT' })
      expect(res.success).toBe(true)
    }
  })

  it('accepts a genuine CUSTOM_DOCUMENT:<cuid> namespaced value', () => {
    const res = CreateCustomFieldDefinitionSchema.safeParse({
      entityType: 'CUSTOM_DOCUMENT:cmt0jf1om00wnbwqse9h64ohe', fieldName: 'Visitor Name', fieldType: 'TEXT'
    })
    expect(res.success).toBe(true)
  })

  it('rejects a garbage entityType that matches neither the built-in list nor the namespaced pattern', () => {
    const res = CreateCustomFieldDefinitionSchema.safeParse({ entityType: 'NOT_A_REAL_TYPE', fieldName: 'Test', fieldType: 'TEXT' })
    expect(res.success).toBe(false)
  })

  it('rejects a CUSTOM_DOCUMENT prefix with a malformed ID (too short, or non-alphanumeric)', () => {
    const tooShort = CreateCustomFieldDefinitionSchema.safeParse({ entityType: 'CUSTOM_DOCUMENT:abc', fieldName: 'Test', fieldType: 'TEXT' })
    const badChars = CreateCustomFieldDefinitionSchema.safeParse({ entityType: 'CUSTOM_DOCUMENT:abc-123!', fieldName: 'Test', fieldType: 'TEXT' })
    expect(tooShort.success).toBe(false)
    expect(badChars.success).toBe(false)
  })

  it('ListCustomFieldDefinitionsSchema accepts the namespaced pattern too, matching create', () => {
    const res = ListCustomFieldDefinitionsSchema.safeParse({ entityType: 'CUSTOM_DOCUMENT:cmt0jf1om00wnbwqse9h64ohe' })
    expect(res.success).toBe(true)
  })

  it('still omits entityType safely on list (optional filter)', () => {
    const res = ListCustomFieldDefinitionsSchema.safeParse({})
    expect(res.success).toBe(true)
  })
})
