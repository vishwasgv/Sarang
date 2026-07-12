import React from 'react'
import { cn } from '@shared/utils/cn'

export interface TabItem<T extends string = string> {
  id: T
  label: string
  icon?: React.ReactNode
}

interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[]
  active: T
  onChange: (id: T) => void
  className?: string
}

// The pill-row tab bar pattern hand-rolled in Memberships/DrivingSchool/
// ProjectsScreen: `flex gap-1 p-1 bg-muted/30 rounded-xl w-fit` with an
// active/inactive button state per tab.
export function Tabs<T extends string = string>({ tabs, active, onChange, className }: TabsProps<T>) {
  return (
    <div role="tablist" className={cn('flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit', className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1',
            active === t.id
              ? 'bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-slate-100'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          )}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  )
}
