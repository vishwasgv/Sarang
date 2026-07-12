import React from 'react'
import { cn } from '@shared/utils/cn'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-300 dark:text-slate-600">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{title}</p>
      {description && (
        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mb-4">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  )
}
