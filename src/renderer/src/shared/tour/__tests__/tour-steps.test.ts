import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
// The sidebar module reads browser globals when it loads; give it harmless stand-ins (the tests never render anything).
vi.hoisted(() => {
  const g = globalThis as Record<string, unknown>
  const store = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
  g.window = g.window ?? { localStorage: store, addEventListener: () => undefined, matchMedia: () => ({ matches: false, addEventListener: () => undefined }) }
  g.localStorage = g.localStorage ?? store
  g.document = g.document ?? { documentElement: { classList: { add: () => undefined, remove: () => undefined }, setAttribute: () => undefined }, addEventListener: () => undefined }
})

import { NAV_ITEMS } from '@shared/ui/layout/Sidebar'
import { getUniversalSteps, generateVerticalSteps } from '../steps'
import { VERTICAL_CONTENT } from '../vertical-content'

// The guided tour points at real screens. These checks fail when a step or its text points at something that no longer exists.
const en = JSON.parse(readFileSync(resolve(__dirname, '../../../i18n/locales/en.json'), 'utf8')) as { tour: { universal: Record<string, string>; items: Record<string, { title?: string; body?: string }> } }
const routerSource = readFileSync(resolve(__dirname, '../../../app/router.tsx'), 'utf8')
const routes = new Set([...routerSource.matchAll(/path="([^"]+)"/g)].map((m) => m[1]))

// A route like /invoices/:id is matched by its pattern; the tour only ever uses fixed paths.
const routeExists = (path: string) => path === '/' || routes.has(path) || [...routes].some((r) => r.includes(':') && new RegExp('^' + r.replace(/:[^/]+/g, '[^/]+') + '$').test(path))

describe('guided tour', () => {
  const all = generateVerticalSteps(() => true, () => true, (item) => item.label)

  it('every universal step has text in the language file and a screen to go to', () => {
    for (const step of getUniversalSteps()) {
      expect(en.tour.universal[step.titleKey.replace('tour.universal.', '')], step.titleKey).toBeTruthy()
      expect(en.tour.universal[step.bodyKey.replace('tour.universal.', '')], step.bodyKey).toBeTruthy()
      if (step.route) expect(routeExists(step.route), `route ${step.route}`).toBe(true)
    }
  })

  it('every generated step points at a screen that exists', () => {
    const missing = all.filter((s) => s.route && !routeExists(s.route)).map((s) => s.route)
    expect(missing).toEqual([])
  })

  it('every hand-written tour item is a real sidebar screen with a title and a body', () => {
    const navPaths = new Set(NAV_ITEMS.map((i) => i.path))
    const unknown = VERTICAL_CONTENT.filter((e) => !navPaths.has(e.path)).map((e) => e.path)
    expect(unknown).toEqual([])
    const noText = VERTICAL_CONTENT.filter((e) => !en.tour.items[e.key]?.title || !en.tour.items[e.key]?.body).map((e) => e.key)
    expect(noText).toEqual([])
  })

  it('no two tour items share a path or a text key', () => {
    const paths = VERTICAL_CONTENT.map((e) => e.path)
    const keys = VERTICAL_CONTENT.map((e) => e.key)
    expect(new Set(paths).size).toBe(paths.length)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('the first sale comes early: dashboard, sidebar, search, Ask Sarang, then billing', () => {
    const ids = getUniversalSteps().map((s) => s.id)
    expect(ids.slice(0, 5)).toEqual(['dashboard', 'sidebar', 'search', 'askSarang', 'billing'])
  })

  it('the new accounting, stock and overview screens have hand-written text, not the generic sentence', () => {
    const generic = all.filter((s) => s.bodyKey === 'tour.genericExploreScreen').map((s) => s.route)
    for (const path of ['/expenses/claims', '/accounting/bank-rules', '/accounting/gst-payments', '/accounting/gst-returns', '/accounting/branch-summaries', '/inventory/stock-takes', '/inventory/journal', '/inventory/bins', '/hub/sales', '/hub/purchases', '/hub/accounting', '/hub/inventory', '/bills']) {
      expect(generic, path).not.toContain(path)
    }
  })
})
