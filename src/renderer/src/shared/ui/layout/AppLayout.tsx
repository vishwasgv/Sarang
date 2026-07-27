import React, { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { ToastContainer } from '@shared/ui/feedback/Toast'
import { CommandPalette } from '@shared/ui/CommandPalette'
import { TourOverlay } from '@shared/ui/organisms/TourOverlay'
import { TutorialBanner } from '@shared/ui/organisms/TutorialBanner'
import { api } from '@renderer/services/ipc-client'
import { useStartTour } from '@shared/tour/useStartTour'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/billing': 'Bills',
  '/billing/new': 'New Bill',
  '/payments': 'Payment History',
  '/products': 'Products',
  '/inventory': 'Inventory',
  '/inventory/movements': 'Stock Movements',
  '/purchase-orders': 'Purchase Orders',
  '/customers': 'Customers',
  '/suppliers': 'Suppliers',
  '/expenses': 'Expenses',
  '/reports': 'Reports',
  '/cash-close': 'Cash Close',
  '/backup': 'Backup & Recovery',
  '/import': 'Import Data',
  '/audit': 'Audit Logs',
  '/settings': 'Settings',
  '/returns': 'Process Return',
  '/restaurant/tables': 'Tables',
  '/restaurant/kot': 'Kitchen Orders',
  '/restaurant/recipes': 'Recipes',
  '/distributor/bulk-order': 'Bulk Order',
  '/distributor/outstanding': 'Outstanding Analytics',
}

export function AppLayout() {
  const location = useLocation()
  const [cmdOpen, setCmdOpen] = useState(false)
  const [tutorialActive, setTutorialActive] = useState(false)
  const [tourAutoStarted, setTourAutoStarted] = useState(false)
  const { startTour, isLoaded } = useStartTour()

  // Phase 60 — checked once per app session; whether tutorial mode is
  // active never changes mid-session (entering/exiting both go through a
  // full relaunch, see tutorial.service.ts), so a one-time check is enough.
  useEffect(() => {
    api.tutorial.isActive().then((res) => { if (res.success && res.data) setTutorialActive(true) }).catch(() => {})
  }, [])

  // Auto-start the guided walkthrough once we're actually inside a
  // tutorial session AND the industry template has finished loading (the
  // vertical-step generator needs isModuleEnabled to be populated first —
  // starting too early would silently generate zero vertical steps).
  useEffect(() => {
    if (tutorialActive && isLoaded && !tourAutoStarted) {
      if (startTour()) setTourAutoStarted(true)
    }
  }, [tutorialActive, isLoaded, tourAutoStarted, startTour])

  // Derive title from pathname (handles dynamic segments like /billing/:id)
  const title = Object.entries(PAGE_TITLES)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([path]) => location.pathname === path || location.pathname.startsWith(path + '/'))
    ?.[1] ?? 'Sarang'

  // Global Ctrl+K listener
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex flex-col h-screen bg-surface dark:bg-slate-950 overflow-hidden">
      {tutorialActive && <TutorialBanner />}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar title={title} onSearchClick={() => setCmdOpen(true)} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-surface dark:bg-slate-950">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
        <ToastContainer />
        <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
        <TourOverlay />
      </div>
    </div>
  )
}
