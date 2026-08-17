import { describe, it, expect } from 'vitest'
import { shouldShowCustomField } from '../custom-fields.util'

// Real gap found+fixed during Phase 66's own final self-review: an earlier
// version fetched only active:true definitions, so deactivating a field
// made its already-recorded value invisible on EVERY record forever —
// contradicting this feature's own documented promise ("deactivating
// preserves historical values... fully readable on the records that have
// it"). The value was never lost from the database, just unreachable
// through any UI. This directly unit-tests the fix's own predicate, since
// this codebase has no renderer-component test infrastructure to render
// the editor itself — the same "extract the pure logic" pattern
// manual-match.util.test.ts already established.
describe('shouldShowCustomField', () => {
  it('always shows an active field, even on a record with no value yet', () => {
    expect(shouldShowCustomField({ id: 'f1', isActive: true }, {})).toBe(true)
  })

  it('shows an inactive field on a record that already has a value for it', () => {
    expect(shouldShowCustomField({ id: 'f1', isActive: false }, { f1: 'Gold' })).toBe(true)
  })

  it('hides an inactive field on a record that never had a value for it', () => {
    expect(shouldShowCustomField({ id: 'f1', isActive: false }, {})).toBe(false)
  })

  it('hides an inactive field whose value was explicitly cleared to an empty string', () => {
    expect(shouldShowCustomField({ id: 'f1', isActive: false }, { f1: '' })).toBe(false)
  })

  it('shows an inactive NUMBER field whose real value is 0 (not treated as empty)', () => {
    expect(shouldShowCustomField({ id: 'f1', isActive: false }, { f1: 0 })).toBe(true)
  })

  it('is unaffected by other fields present in the same values object', () => {
    expect(shouldShowCustomField({ id: 'f2', isActive: false }, { f1: 'Gold' })).toBe(false)
  })
})
