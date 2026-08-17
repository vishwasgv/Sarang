// Extracted as its own pure, zero-side-effect-import file (mirroring
// manual-match.util.ts's own pattern) so it's directly unit-testable
// without pulling in CustomFieldsEditor.tsx's own react-i18next/ipc-client
// imports, which require a browser `window` this project's plain-node unit
// tests don't provide.
//
// Real bug found+fixed during Phase 66's final self-review: an earlier
// version fetched only active:true definitions, so deactivating a field
// made its already-recorded value invisible on EVERY record forever —
// contradicting this feature's own documented promise ("deactivating
// preserves historical values... fully readable on the records that have
// it"). The value was never lost from the database, just unreachable
// through any UI. An active field always shows (still collectible on every
// record); an inactive field shows ONLY on a record that already carries a
// real value for it, so a record with no history for that retired field
// still sees zero footprint.
export function shouldShowCustomField(field: { id: string; isActive: boolean }, values: Record<string, string | number>): boolean {
  return field.isActive || (values[field.id] !== undefined && values[field.id] !== '')
}
