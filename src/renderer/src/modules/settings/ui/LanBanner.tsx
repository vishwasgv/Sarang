import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

// Shown on a PC when someone on another PC has changed data, so nobody works from a stale screen.
export function LanBanner() {
  const { t } = useTranslation()
  const [by, setBy] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    const off = (window as unknown as { events?: { on: (c: string, l: (...a: unknown[]) => void) => (() => void) | undefined } }).events?.on('lan:changed', (...args: unknown[]) => {
      const info = args[0] as { by?: string | null } | undefined
      setBy(info?.by ?? null)
    })
    return () => { off?.() }
  }, [])

  if (by === undefined) return null
  return (
    <div role="status" className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl bg-slate-900 text-white px-4 py-3 shadow-lg flex items-center gap-3 text-sm">
      <span>{by ? t('lan.changedBy', { name: by }) : t('lan.changed')}</span>
      <button type="button" className="font-semibold underline min-h-[44px] px-2" onClick={() => window.location.reload()}>{t('lan.refresh')}</button>
      <button type="button" aria-label={t('common.close')} className="min-h-[44px] px-2" onClick={() => setBy(undefined)}>×</button>
    </div>
  )
}
