import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, ChevronDown, LogOut, Lock, Settings, Check, Search, Sun, Moon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'
import { useThemeStore } from '@app/store/theme.store'
import { cn } from '@shared/utils/cn'
import { api, onPushEvent } from '@renderer/services/ipc-client'

interface NotificationItem {
  id: string; title: string; message: string
  notificationType: string; isRead: boolean; createdAt: string
}

interface TopBarProps {
  title?: string
  onSearchClick?: () => void
}

export function TopBar({ title, onSearchClick }: TopBarProps) {
  const user = useAuthStore((s) => s.user)
  const { clear: clearAuth } = useAuthStore()
  const toast = useNotificationStore()
  const { isDark, toggleTheme } = useThemeStore()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const notifRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadNotifications() }, [])

  // R15: Subscribe to real-time push from main process so badge updates immediately on low-stock, etc.
  useEffect(() => {
    return onPushEvent('notifications:new', () => {
      setUnreadCount(c => c + 1)
      loadNotifications()
    })
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    if (notifOpen || menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [notifOpen, menuOpen])

  async function loadNotifications() {
    const [listRes, countRes] = await Promise.all([
      api.notifications.list(),
      api.notifications.getUnreadCount()
    ])
    if (listRes.success) setNotifications((listRes.data as NotificationItem[]) ?? [])
    if (countRes.success) setUnreadCount((countRes.data as number) ?? 0)
  }

  async function handleMarkAllRead() {
    await api.notifications.markAllRead()
    setUnreadCount(0)
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  async function handleMarkRead(id: string) {
    await api.notifications.markRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    setUnreadCount(c => Math.max(0, c - 1))
  }

  async function handleLogout() {
    await api.auth.logout()
    clearAuth()
    setMenuOpen(false)
  }

  function typeColor(type: string) {
    if (type === 'SUCCESS') return 'bg-success/10 text-success'
    if (type === 'WARNING') return 'bg-warning/10 text-warning'
    if (type === 'ERROR') return 'bg-danger/10 text-danger'
    return 'bg-brand/10 text-brand'
  }

  return (
    <header className="h-topbar bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 z-10">
      {/* Page title */}
      <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title ?? 'Dashboard'}</h1>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Global search trigger */}
        <button
          onClick={onSearchClick}
          aria-label="Global search (Ctrl+K)"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-brand hover:text-brand dark:hover:border-brand dark:hover:text-brand transition-colors text-sm"
        >
          <Search size={14} />
          <span className="hidden sm:block text-xs">Search</span>
          <kbd className="hidden sm:block text-[10px] font-semibold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-400">
            Ctrl K
          </kbd>
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(o => !o)}
            aria-label="Notifications"
            className="relative p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-modal z-50 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</p>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs text-brand hover:underline flex items-center gap-1">
                      <Check size={11} /> Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <Bell size={24} className="text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => !n.isRead && handleMarkRead(n.id)}
                        className={cn(
                          'flex items-start gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-800 last:border-0 transition-colors',
                          n.isRead
                            ? 'bg-white dark:bg-slate-900'
                            : 'bg-brand/5 dark:bg-brand/10 cursor-pointer hover:bg-brand/10 dark:hover:bg-brand/15'
                        )}
                      >
                        <div className={cn('mt-0.5 w-2 h-2 rounded-full shrink-0', n.isRead ? 'bg-slate-200 dark:bg-slate-700' : 'bg-brand')} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">{n.title}</p>
                            <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0', typeColor(n.notificationType))}>
                              {n.notificationType}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center text-white text-xs font-semibold">
              {user?.fullName.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <span className="font-medium hidden sm:block">{user?.fullName}</span>
            <ChevronDown size={14} className={cn('transition-transform', menuOpen && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-modal py-1 z-50"
              >
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{user?.fullName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{user?.role.name}</p>
                </div>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => { navigate('/settings'); setMenuOpen(false) }}
                >
                  <Settings size={14} className="text-slate-400" /> Settings
                </button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => { navigate('/settings'); setMenuOpen(false); toast.info('Go to Settings → Security to change your password.') }}
                >
                  <Lock size={14} className="text-slate-400" /> Change Password
                </button>
                <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    onClick={handleLogout}
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}

