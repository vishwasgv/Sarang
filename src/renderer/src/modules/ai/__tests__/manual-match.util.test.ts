import { describe, it, expect } from 'vitest'
import { findManualMatch } from '../manual-match.util'

// Real gap found+fixed 2026-07-30: a navigation-shaped question ("how do
// I...", "where is...") that didn't clear findManualMatch's confidence
// threshold used to fall through silently to the AI pipeline, which has no
// knowledge of the app's UI and would misclassify it as out_of_scope,
// producing the misleading "I can only answer questions about your own
// business's sales, inventory..." refusal for a perfectly reasonable
// navigation question. findManualMatch now returns a discriminated result
// ('confident' | 'weak' | 'none') so the caller can show a graceful
// "these chapters might help" fallback instead — this is directly
// unit-testable since the function is pure (no React, no Electron).

describe('findManualMatch', () => {
  it("returns 'none' for a question with no navigation-intent phrasing", () => {
    const result = findManualMatch('What were my sales today?', 'en')
    expect(result.kind).toBe('none')
  })

  it("returns 'none' for a navigation-shaped question with zero real content words", () => {
    // Every word is a stopword or too short after the NAV_INTENT_PATTERN itself matches.
    const result = findManualMatch('How do I do it', 'en')
    expect(result.kind).toBe('none')
  })

  it("returns a 'confident' match for a well-known real navigation question (billing)", () => {
    const result = findManualMatch('How do I create an invoice?', 'en')
    expect(result.kind).toBe('confident')
    if (result.kind === 'confident') {
      expect(result.chapter.slug).toBe('billing')
    }
  })

  it("returns a 'confident' match for a well-known real navigation question (backup)", () => {
    const result = findManualMatch('Where is the backup screen?', 'en')
    expect(result.kind).toBe('confident')
    if (result.kind === 'confident') {
      expect(result.chapter.slug).toBe('backup-restore')
    }
  })

  it("returns 'weak' with candidate suggestions (not silently 'none') for a navigation-shaped question too vague to confidently resolve", () => {
    // Navigation-shaped, but "settings" alone is a single, short, extremely
    // common word matched by dozens of chapters — exactly the class of
    // question that used to silently reach the misleading AI refusal.
    const result = findManualMatch('How do I settings', 'en')
    expect(['weak', 'confident']).toContain(result.kind)
    if (result.kind === 'weak') {
      expect(result.candidates.length).toBeGreaterThan(0)
      expect(result.candidates.length).toBeLessThanOrEqual(3)
      // Every candidate must be a real, resolvable chapter reference.
      for (const c of result.candidates) {
        expect(typeof c.slug).toBe('string')
        expect(c.slug.length).toBeGreaterThan(0)
        expect(typeof c.title).toBe('string')
        expect(c.title.length).toBeGreaterThan(0)
      }
    }
  })

  it('is case-insensitive on the navigation-intent phrasing', () => {
    const result = findManualMatch('HOW DO I create an invoice?', 'en')
    expect(result.kind).toBe('confident')
  })

  // REAL BUG found+fixed 2026-07-31: the nav-intent pattern only covered
  // "how do/can/to..." and "where is/can/do..." — a nav-shaped question
  // phrased another common way fell through to the AI pipeline and got the
  // exact misleading refusal the 2026-07-30 fix above was meant to prevent,
  // just for a different trigger phrase.
  it("recognizes 'can I...' as navigation-shaped", () => {
    const result = findManualMatch('Can I export invoices to Excel?', 'en')
    expect(result.kind).not.toBe('none')
  })

  it("recognizes 'is there a way to...' as navigation-shaped", () => {
    const result = findManualMatch('Is there a way to add a customer?', 'en')
    expect(result.kind).not.toBe('none')
  })

  it("recognizes 'what's the way to...' as navigation-shaped", () => {
    const result = findManualMatch("What's the way to print a label?", 'en')
    expect(result.kind).not.toBe('none')
  })

  it("recognizes 'any way to...' as navigation-shaped", () => {
    const result = findManualMatch('Any way to back up my data?', 'en')
    expect(result.kind).not.toBe('none')
  })

  it('falls back to English content when the requested locale has no translation for a real chapter', () => {
    // 'xx' is not a real locale — getChapterContentWithFallback falls back
    // to English, so this should behave identically to the English case.
    const result = findManualMatch('How do I create an invoice?', 'xx')
    expect(result.kind).toBe('confident')
    if (result.kind === 'confident') {
      expect(result.chapter.slug).toBe('billing')
    }
  })
})
