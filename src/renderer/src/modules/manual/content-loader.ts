// Phase 56 — loads Manual chapter Markdown content, bundled into the renderer at
// build time (same "lands in the ASAR automatically" pattern electron-builder.config.ts
// already notes for renderer-bundled static assets — no extraResources/IPC needed).
const rawModules = import.meta.glob('./content/*/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

// Key shape from the glob is './content/<locale>/<slug-with-slashes-flattened>.md' — chapter
// slugs that contain a '/' (e.g. 'business/restaurant') are stored flattened on disk as
// 'business__restaurant.md' since a literal '/' can't appear in the glob's matched filename
// segment; getChapterContent re-derives the flattened form so callers can keep using the
// manifest's real slug.
function toFileSlug(slug: string): string {
  return slug.replace(/\//g, '__')
}

export function getChapterContent(locale: string, slug: string): string | undefined {
  const key = `./content/${locale}/${toFileSlug(slug)}.md`
  return rawModules[key]
}

// Single source of the "current locale, else English" fallback rule — every caller needing a
// chapter's body (the reading pane, the PDF export) goes through this rather than repeating the
// two-step `?? getChapterContent('en', slug)` expression inline.
export function getChapterContentWithFallback(locale: string, slug: string): string {
  return getChapterContent(locale, slug) ?? getChapterContent('en', slug) ?? ''
}

// Every chapter file's own first line is `# <Localized Title>` — read it from the ALREADY-loaded
// locale (falling back to English same as the body) instead of relying on a static, English-only
// title in the manifest. This is what actually localizes the sidebar TOC/breadcrumb/search, not
// just the chapter body.
export function getChapterTitle(locale: string, slug: string, fallbackTitle: string): string {
  const content = getChapterContentWithFallback(locale, slug)
  const match = content.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : fallbackTitle
}
