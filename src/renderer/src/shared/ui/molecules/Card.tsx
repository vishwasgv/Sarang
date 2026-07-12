import React from 'react'
import { cn } from '@shared/utils/cn'

type CardPadding = 'none' | 'sm' | 'md' | 'lg'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding
  hoverable?: boolean
}

const paddings: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
}

// Container primitive — replaces the `bg-white dark:bg-slate-900 rounded-xl
// border border-slate-200 dark:border-slate-700` div hand-rolled at the top
// of nearly every list-item/panel/KPI-tile across the app.
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ padding = 'md', hoverable, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900',
          hoverable && 'transition-colors hover:border-slate-300 dark:hover:border-slate-600',
          paddings[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'
