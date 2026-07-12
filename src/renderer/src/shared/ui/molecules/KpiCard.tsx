import React from 'react'
import { cn } from '@shared/utils/cn'
import { Card } from './Card'

type KpiColor = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface KpiCardProps {
  label: string
  value: React.ReactNode
  icon?: React.ReactNode
  color?: KpiColor
  className?: string
}

const valueColors: Record<KpiColor, string> = {
  brand: 'text-brand',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  neutral: 'text-slate-900 dark:text-slate-100',
}

// The stat-tile pattern repeated across every KPI bar in the app (Memberships,
// DrivingSchool, Appointments, TimeEntry, ...): a big number/value, a small
// label underneath, optional icon and accent color.
export function KpiCard({ label, value, icon, color = 'neutral', className }: KpiCardProps) {
  return (
    <Card padding="md" className={cn('space-y-1', className)}>
      <div className="flex items-center gap-2">
        {icon && <span className={valueColors[color]}>{icon}</span>}
        <p className={cn('text-2xl font-bold', valueColors[color])}>{value}</p>
      </div>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
    </Card>
  )
}
