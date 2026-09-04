import React from 'react'
import { cn } from '@shared/utils/cn'

type FoodType = 'VEG' | 'EGG' | 'NON_VEG'

type DietMarkSize = 'sm' | 'md'

interface DietMarkProps {
  foodType?: FoodType | string | null
  size?: DietMarkSize
  className?: string
}

const COLORS: Record<FoodType, string> = {
  VEG: 'border-success after:bg-success',
  EGG: 'border-warning after:bg-warning',
  NON_VEG: 'border-danger after:bg-danger',
}

const LABELS: Record<FoodType, string> = {
  VEG: 'Veg',
  EGG: 'Contains Egg',
  NON_VEG: 'Non-Veg',
}

// cn() in this codebase is plain concatenation (no tailwind-merge), so a
// caller-supplied className can't reliably override a baked-in size class --
// a size prop (same pattern as Badge.tsx's own size prop) instead of trying
// to override w-3/h-3 via className.
const SIZES: Record<DietMarkSize, string> = {
  sm: 'w-3 h-3 after:w-1.5 after:h-1.5',
  md: 'w-4 h-4 after:w-2 after:h-2',
}

// Standard Indian restaurant-menu convention (green/yellow/red square with a
// centered dot) — same mark already used on the customer-facing QR menu
// (resources/qr-menu/index.html's dietMarkHtml()). Renders nothing for a
// null/unclassified item, matching that page's own behavior — never guesses.
export function DietMark({ foodType, size = 'sm', className }: DietMarkProps) {
  if (foodType !== 'VEG' && foodType !== 'EGG' && foodType !== 'NON_VEG') return null
  return (
    <span
      title={LABELS[foodType]}
      aria-label={LABELS[foodType]}
      className={cn(
        'relative inline-block shrink-0 rounded-[2px] border-[1.5px]',
        "after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full",
        SIZES[size],
        COLORS[foodType],
        className
      )}
    />
  )
}
