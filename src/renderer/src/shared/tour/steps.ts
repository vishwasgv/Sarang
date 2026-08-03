import { NAV_ITEMS, type NavItem } from '@shared/ui/layout/Sidebar'
import type { TourStep } from './tour.store'
import { VERTICAL_CONTENT_BY_PATH } from './vertical-content'

// Phase 60 — Interactive Onboarding Tutorial. See
// PHASE_60_TUTORIAL_MASTER_PROMPT.md (repo root) Section 4.
//
// Every step points at the real sidebar nav link for its screen
// (`a[href="<route>"]`) rather than a bespoke element inside each screen —
// the sidebar is always rendered regardless of which screen is active, so
// this needs zero new data-tour attributes scattered across the codebase.
// Advancing navigates to that route so the user can genuinely use the real
// screen; how long they spend there before clicking Next is entirely up to
// them (self-paced, not auto-validated — see the master prompt's Section 1
// for why an auto-detection design was rejected as too fragile across 43
// very different verticals).

// REAL BUG found+fixed 2026-08-04 (live tutorial-mode UAT): this app uses
// HashRouter, so a nav link's actual rendered `href` is `#/billing`, not
// `/billing`. Every targetSelector below was missing that `#`, so
// document.querySelector never found its target on almost any step — the
// highlight ring silently never appeared, and TourOverlay fell back to its
// centered-intro-card position (further broken by an unrelated
// framer-motion transform conflict) for what was supposed to be a
// sidebar-anchored tooltip. Only surfaced as a visible, blocking bug on the
// 'billing' step because its unusually long body text is what finally made
// the wrongly-positioned tooltip overflow off-screen.
const UNIVERSAL_STEPS: TourStep[] = [
  { id: 'dashboard', titleKey: 'tour.universal.dashboardTitle', bodyKey: 'tour.universal.dashboardBody', targetSelector: 'a[href="#/"]', route: '/' },
  { id: 'sidebar', titleKey: 'tour.universal.sidebarTitle', bodyKey: 'tour.universal.sidebarBody', targetSelector: 'nav', route: '/' },
  { id: 'search', titleKey: 'tour.universal.searchTitle', bodyKey: 'tour.universal.searchBody', targetSelector: '[aria-label^="Global search"]', route: '/' },
  { id: 'billing', titleKey: 'tour.universal.billingTitle', bodyKey: 'tour.universal.billingBody', targetSelector: 'a[href="#/billing"]', route: '/billing/new' },
  { id: 'customers', titleKey: 'tour.universal.customersTitle', bodyKey: 'tour.universal.customersBody', targetSelector: 'a[href="#/customers"]', route: '/customers' },
  { id: 'products', titleKey: 'tour.universal.productsTitle', bodyKey: 'tour.universal.productsBody', targetSelector: 'a[href="#/products"]', route: '/products' },
  { id: 'inventory', titleKey: 'tour.universal.inventoryTitle', bodyKey: 'tour.universal.inventoryBody', targetSelector: 'a[href="#/inventory"]', route: '/inventory' },
  { id: 'reports', titleKey: 'tour.universal.reportsTitle', bodyKey: 'tour.universal.reportsBody', targetSelector: 'a[href="#/reports"]', route: '/reports' },
  { id: 'settings', titleKey: 'tour.universal.settingsTitle', bodyKey: 'tour.universal.settingsBody', targetSelector: 'a[href="#/settings"]', route: '/settings' },
  { id: 'backup', titleKey: 'tour.universal.backupTitle', bodyKey: 'tour.universal.backupBody', targetSelector: 'a[href="#/backup"]', route: '/backup' }
]

// Nav paths already covered by a universal step above — excluded from the
// auto-generated vertical segment below so the same screen isn't explained
// twice in one tour.
const UNIVERSAL_PATHS = new Set(UNIVERSAL_STEPS.map((s) => s.route).filter(Boolean))
// Non-business-specific utility screens that aren't worth a dedicated tour
// step (read-only reference material, or already self-explanatory) —
// deliberately excluded, not missed.
const ALWAYS_EXCLUDED_PATHS = new Set(['/manual', '/about', '/ai-assistant'])

/**
 * Generates the vertical-specific segment of the tour by filtering the
 * exact same NAV_ITEMS list (and the same isModuleEnabled/hasPermission
 * checks) the Sidebar itself uses — so every screen a given business type
 * actually has enabled gets a tour step, mechanically, with nothing missed
 * and nothing irrelevant included. Each step uses one shared, translated
 * template sentence (tour.genericExploreScreen) rather than a hand-authored
 * sentence per item — the item's own already-localized nav label fills in
 * the specifics.
 */
export function generateVerticalSteps(
  isModuleEnabled: (module: string) => boolean,
  hasPermission: (key: string) => boolean,
  translateLabel: (item: NavItem) => string
): TourStep[] {
  return NAV_ITEMS
    .filter((item) => {
      if (UNIVERSAL_PATHS.has(item.path) || ALWAYS_EXCLUDED_PATHS.has(item.path)) return false
      if (item.requiredModule && !isModuleEnabled(item.requiredModule)) return false
      if (item.permissionKey && !hasPermission(item.permissionKey)) return false
      return true
    })
    .map((item) => {
      const contentKey = VERTICAL_CONTENT_BY_PATH[item.path]
      if (contentKey) {
        return {
          id: `nav:${item.path}`,
          titleKey: `tour.items.${contentKey}.title`,
          bodyKey: `tour.items.${contentKey}.body`,
          targetSelector: `a[href="#${item.path}"]`,
          route: item.path
        }
      }
      return {
        id: `nav:${item.path}`,
        titleKey: '',
        titleLiteral: translateLabel(item),
        bodyKey: 'tour.genericExploreScreen',
        bodyParams: { label: translateLabel(item) },
        targetSelector: `a[href="#${item.path}"]`,
        route: item.path
      }
    })
}

export function getUniversalSteps(): TourStep[] {
  return UNIVERSAL_STEPS
}
