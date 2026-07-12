import React from 'react'
import { cn } from '@shared/utils/cn'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'
type BadgeSize = 'sm' | 'md'

interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  icon?: React.ReactNode
  className?: string
  children: React.ReactNode
}

const variants: Record<BadgeVariant, string> = {
  success: 'bg-success/10 text-success dark:bg-success/15',
  warning: 'bg-warning/10 text-warning dark:bg-warning/15',
  danger: 'bg-danger/10 text-danger dark:bg-danger/15',
  info: 'bg-info/10 text-info dark:bg-info/15',
  neutral: 'bg-muted text-muted-foreground',
  brand: 'bg-brand/10 text-brand dark:bg-brand/15',
}

const sizes: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-sm gap-1.5',
}

// Status-pill primitive — replaces the ~15 separate per-screen
// STATUS_COLORS/SESSION_STATUS_COLORS-style record objects with one
// canonical component. Callers still choose which variant a given status
// maps to (a `Badge` has no opinion about what "COMPLETED" means), but the
// color tokens and pill shape stop being hand-copied everywhere.
export function Badge({ variant = 'neutral', size = 'md', icon, className, children }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full font-medium whitespace-nowrap', variants[variant], sizes[size], className)}>
      {icon}
      {children}
    </span>
  )
}
