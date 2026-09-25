import { describe, it, expect } from 'vitest'
import { validateCustomFieldValues, type FieldRuleDefinition } from '../custom-field-rules.util'

const def = (over: Partial<FieldRuleDefinition>): FieldRuleDefinition => ({
  id: 'f1', fieldName: 'Field', fieldType: 'TEXT', selectOptions: null, isActive: true,
  isRequired: false, minValue: null, maxValue: null, pattern: null, patternHint: null, ...over
})

describe('custom field rules', () => {
  it('required fields must be filled on create, but only when present on edit', () => {
    const d = [def({ isRequired: true })]
    expect(validateCustomFieldValues(d, {}, true)).toMatch(/required/)
    expect(validateCustomFieldValues(d, { f1: '  ' }, true)).toMatch(/required/)
    expect(validateCustomFieldValues(d, undefined, false)).toBeNull()
    expect(validateCustomFieldValues(d, { f1: '' }, false)).toMatch(/required/)
    expect(validateCustomFieldValues(d, { f1: 'x' }, true)).toBeNull()
  })

  it('numbers respect min and max and must be numbers', () => {
    const d = [def({ fieldType: 'NUMBER', minValue: 1, maxValue: 10 })]
    expect(validateCustomFieldValues(d, { f1: 0 }, false)).toMatch(/at least 1/)
    expect(validateCustomFieldValues(d, { f1: 11 }, false)).toMatch(/at most 10/)
    expect(validateCustomFieldValues(d, { f1: 'abc' }, false)).toMatch(/number/)
    expect(validateCustomFieldValues(d, { f1: 5 }, false)).toBeNull()
  })

  it('text patterns use the hint as the message', () => {
    const d = [def({ pattern: '^[A-Z]{5}[0-9]{4}[A-Z]$', patternHint: 'Enter a PAN like ABCDE1234F' })]
    expect(validateCustomFieldValues(d, { f1: 'bad' }, false)).toBe('Enter a PAN like ABCDE1234F')
    expect(validateCustomFieldValues(d, { f1: 'ABCDE1234F' }, false)).toBeNull()
  })

  it('a broken pattern never blocks saving', () => {
    expect(validateCustomFieldValues([def({ pattern: '([' })], { f1: 'x' }, false)).toBeNull()
  })

  it('select values must be an option; dates must parse; inactive fields are ignored', () => {
    expect(validateCustomFieldValues([def({ fieldType: 'SELECT', selectOptions: ['A', 'B'] })], { f1: 'C' }, false)).toMatch(/options/)
    expect(validateCustomFieldValues([def({ fieldType: 'DATE' })], { f1: 'not a date' }, false)).toMatch(/date/)
    expect(validateCustomFieldValues([def({ isActive: false, isRequired: true })], {}, true)).toBeNull()
  })
})
