import { BrowserWindow, screen, app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { logger } from '../utils/logger'

// Second-monitor Kitchen Display — a normal BrowserWindow showing the same
// renderer app as the main window, just positioned on a secondary display
// and pointed at the #/kitchen-display route (a sidebar-free, large-font
// KOT board — see router.tsx). Deliberately a plain framed window, not
// `kiosk: true`: staff can close it from the titlebar if needed, no
// lock-in support headache. Input is whatever mouse/keyboard is attached to
// this same billing PC — no touch assumed, see business__restaurant.md.

const isDev = !app.isPackaged

let displayWindow: BrowserWindow | null = null
let openedOnDisplayId: number | null = null

export interface SecondaryDisplayInfo {
  id: number
  label: string
  isPrimary: boolean
}

export function listSecondaryDisplays(): SecondaryDisplayInfo[] {
  const primary = screen.getPrimaryDisplay()
  return screen.getAllDisplays().map((d) => ({
    id: d.id,
    label: `${d.size.width}×${d.size.height}${d.id === primary.id ? ' (primary)' : ''}`,
    isPrimary: d.id === primary.id
  }))
}

export function getKitchenDisplayWindowStatus(): { open: boolean; displayId: number | null } {
  const open = !!displayWindow && !displayWindow.isDestroyed()
  return { open, displayId: open ? openedOnDisplayId : null }
}

export function closeKitchenDisplayWindow(): void {
  if (displayWindow && !displayWindow.isDestroyed()) {
    displayWindow.close()
  }
  displayWindow = null
  openedOnDisplayId = null
}

export function openKitchenDisplayWindow(displayId?: number): { success: boolean; error?: { code: string; message: string } } {
  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()

  let target = displayId !== undefined ? displays.find((d) => d.id === displayId) : undefined
  if (!target) {
    // Default: the first non-primary display. If none exists, fall back to
    // the primary display rather than erroring — a single-monitor setup can
    // still preview the board (e.g. before a second monitor is plugged in).
    target = displays.find((d) => d.id !== primary.id) ?? primary
  }

  // Already open on this exact display — just refocus it instead of
  // spawning a duplicate window.
  if (displayWindow && !displayWindow.isDestroyed() && openedOnDisplayId === target.id) {
    displayWindow.focus()
    return { success: true }
  }
  closeKitchenDisplayWindow()

  const iconPath = isDev
    ? join(__dirname, '../../resources/icon.png')
    : join(process.resourcesPath, 'icon.png')

  displayWindow = new BrowserWindow({
    x: target.bounds.x,
    y: target.bounds.y,
    width: target.bounds.width,
    height: target.bounds.height,
    title: 'Sarang — Kitchen Display',
    backgroundColor: '#F8FAFC',
    show: false,
    autoHideMenuBar: true,
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: isDev
    }
  })
  openedOnDisplayId = target.id

  displayWindow.once('ready-to-show', () => {
    displayWindow?.show()
    displayWindow?.maximize()
  })
  displayWindow.on('closed', () => {
    displayWindow = null
    openedOnDisplayId = null
  })

  if (isDev) {
    displayWindow.loadURL('http://localhost:5173/#/kitchen-display')
  } else {
    displayWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/kitchen-display' })
  }

  return { success: true }
}

// A display physically unplugged while its window is open would otherwise
// leave a BrowserWindow positioned at now-invalid off-screen coordinates —
// close it outright rather than let it strand itself somewhere unreachable.
// Registered lazily via initKitchenDisplayWindowWatcher(), NOT as a
// module-level side effect: this file is statically imported (via
// kitchen-display.handler.ts -> ipc/index.ts) well before app.whenReady()
// fires, and Electron's `screen` module throws if touched before the app is
// ready — a top-level screen.on() call here previously crashed the entire
// main process before any window could open.
let watcherRegistered = false
export function initKitchenDisplayWindowWatcher(): void {
  if (watcherRegistered) return
  watcherRegistered = true
  screen.on('display-removed', (_event, oldDisplay) => {
    if (openedOnDisplayId === oldDisplay.id) {
      logger.info('[KitchenDisplayWindow] Its display was disconnected — closing.')
      closeKitchenDisplayWindow()
    }
  })
}
