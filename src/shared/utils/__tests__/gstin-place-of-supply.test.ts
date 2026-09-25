import { describe, it, expect } from 'vitest'
import { stateCodeFromGstin, resolvePartyState, defaultGstTypeForPlaceOfSupply, classifyTaxHead, placeOfSupplyLabel } from '../gst-presentation'

describe('place of supply falls back to the GSTIN state code (row 3.19)', () => {
  it('reads the state code of a structurally valid GSTIN', () => {
    expect(stateCodeFromGstin('27AAPFU0939F1ZV')).toBe('27')
    expect(stateCodeFromGstin(' 29abcde1234f1z5 ')).toBe('29')
    expect(stateCodeFromGstin('25AAPFU0939F1ZV')).toBe('26')
  })
  it('rejects malformed GSTINs and unknown state codes', () => {
    for (const bad of [null, undefined, '', '27AAPFU0939F1Z', '99AAPFU0939F1ZV1', 'AAAAAAAAAAAAAAA', '00AAPFU0939F1ZV', '27AAPFU0939F1XV']) expect(stateCodeFromGstin(bad as never)).toBe('')
  })
  it('a saved state wins; the GSTIN is used only when there is none', () => {
    expect(resolvePartyState('Karnataka', '27AAPFU0939F1ZV')).toBe('Karnataka')
    expect(resolvePartyState('', '27AAPFU0939F1ZV')).toBe('27')
    expect(resolvePartyState(null, 'garbage')).toBe('')
  })
  it('a B2B customer with a GSTIN and no state gets IGST from another state and CGST+SGST from the same state', () => {
    expect(defaultGstTypeForPlaceOfSupply('Maharashtra', resolvePartyState(null, '29AAPFU0939F1ZV'))).toBe('IGST')
    expect(defaultGstTypeForPlaceOfSupply('MH', resolvePartyState(undefined, '27AAPFU0939F1ZV'))).toBe('CGST_SGST')
    expect(classifyTaxHead('GST', 'Maharashtra', resolvePartyState(null, '29AAPFU0939F1ZV'))).toEqual({ head: 'IGST', stateUnknown: false })
  })
  it('labels the place of supply the way returns file it', () => {
    expect(placeOfSupplyLabel(null, '27AAPFU0939F1ZV')).toBe('27-Maharashtra')
    expect(placeOfSupplyLabel('Goa', '27AAPFU0939F1ZV')).toBe('Goa')
    expect(placeOfSupplyLabel(null, null)).toBe('')
  })
})
