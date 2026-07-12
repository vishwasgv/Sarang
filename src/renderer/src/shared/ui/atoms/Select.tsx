import React from 'react'
import { cn } from '@shared/utils/cn'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  required?: boolean
}

// Styled wrapper around a native <select> — same visual treatment as
// Input.tsx (48px height, focus ring, dark mode) so screens stop repeating
// the same ~200-character className string on every dropdown.
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, className, required, id, children, ...props }, ref) => {
    const generatedId = React.useId()
    const selectId = id ?? generatedId

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="text-base font-semibold text-slate-700 dark:text-slate-300">
            {label}
            {required && <span className="text-danger ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={!!error}
          className={cn(
            'w-full h-12 rounded-lg border bg-white dark:bg-slate-800 px-4 text-base text-slate-900 dark:text-slate-100',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent',
            'disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:cursor-not-allowed disabled:text-slate-500',
            error ? 'border-danger focus:ring-danger' : 'border-slate-200 dark:border-slate-700',
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-sm text-danger">{error}</p>}
        {hint && !error && <p className="text-sm text-slate-500">{hint}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'
