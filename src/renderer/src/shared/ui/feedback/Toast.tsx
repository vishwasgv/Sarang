import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useNotificationStore } from '@app/store/notification.store'
import { cn } from '@shared/utils/cn'

const toastConfig = {
  success: { icon: CheckCircle, bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', icon_color: 'text-success' },
  error: { icon: AlertCircle, bg: 'bg-red-50 border-red-200', text: 'text-red-800', icon_color: 'text-danger' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', icon_color: 'text-warning' },
  info: { icon: Info, bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon_color: 'text-brand' }
}

export function ToastContainer() {
  const { toasts, removeToast } = useNotificationStore()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const config = toastConfig[toast.type]
          const Icon = config.icon
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-float',
                config.bg
              )}
            >
              <Icon className={cn('mt-0.5 shrink-0', config.icon_color)} size={16} />
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium', config.text)}>{toast.title}</p>
                {toast.message && (
                  <p className={cn('text-xs mt-0.5 opacity-80', config.text)}>{toast.message}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className={cn('shrink-0 opacity-60 hover:opacity-100 transition-opacity', config.text)}
              >
                <X size={14} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
