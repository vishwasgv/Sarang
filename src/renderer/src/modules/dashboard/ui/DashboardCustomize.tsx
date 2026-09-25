import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SlidersHorizontal } from 'lucide-react'
import { DASHBOARD_SECTIONS, type DashboardSection } from '../dashboard-sections.util'

interface Props {
  hidden: DashboardSection[]
  onToggle: (section: DashboardSection) => void
}

export function DashboardCustomize({ hidden, onToggle }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:border-brand hover:text-brand transition-colors">
        <SlidersHorizontal size={13} />
        {t('dashboard.customize.button')}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 z-20 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-3 space-y-1">
          <p className="text-xs text-slate-400 mb-1">{t('dashboard.customize.hint')}</p>
          {DASHBOARD_SECTIONS.map((s) => (
            <label key={s} className="flex items-center gap-3 h-11 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-sm text-dark dark:text-slate-100">
              <input type="checkbox" checked={!hidden.includes(s)} onChange={() => onToggle(s)} className="w-4 h-4 accent-brand" />
              {t(`dashboard.customize.sections.${s}`)}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
