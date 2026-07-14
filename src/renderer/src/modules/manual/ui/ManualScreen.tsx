import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import ReactDOMServer from 'react-dom/server'
import Markdown from 'markdown-to-jsx'
import { HelpCircle, Download, ChevronRight } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { useBusinessStore } from '@app/store/business.store'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { MANUAL_CHAPTERS } from '../manifest'
import { getChapterContentWithFallback, getChapterTitle } from '../content-loader'

// No Tailwind typography plugin in this project (tailwind.config.ts plugins: []) — style
// markdown output directly via markdown-to-jsx overrides instead of `prose` classes.
const MARKDOWN_OPTIONS = {
  overrides: {
    h1: { props: { className: 'text-xl font-bold text-dark dark:text-slate-100 mb-3 mt-1' } },
    h2: { props: { className: 'text-lg font-semibold text-dark dark:text-slate-100 mt-6 mb-2' } },
    h3: { props: { className: 'text-base font-semibold text-dark dark:text-slate-100 mt-4 mb-1.5' } },
    p: { props: { className: 'text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3' } },
    ul: { props: { className: 'list-disc list-inside text-sm text-slate-600 dark:text-slate-300 space-y-1 mb-3' } },
    ol: { props: { className: 'list-decimal list-inside text-sm text-slate-600 dark:text-slate-300 space-y-1 mb-3' } },
    li: { props: { className: 'ml-1' } },
    strong: { props: { className: 'font-semibold text-dark dark:text-slate-200' } },
    code: { props: { className: 'bg-slate-100 dark:bg-slate-800 rounded px-1 py-0.5 text-xs font-mono' } },
    table: { props: { className: 'w-full text-sm border-collapse mb-4' } },
    th: { props: { className: 'border border-slate-200 dark:border-slate-700 px-2 py-1 text-left bg-slate-50 dark:bg-slate-800' } },
    td: { props: { className: 'border border-slate-200 dark:border-slate-700 px-2 py-1' } }
  }
}

const GROUP_TITLE_KEYS: Record<string, string> = {
  'getting-started': 'manual.groupGettingStarted',
  universal: 'manual.groupUniversal',
  ai: 'manual.groupAi',
  business: 'manual.groupBusiness'
}
const GROUP_TITLE_FALLBACKS: Record<string, string> = {
  'getting-started': 'Getting Started',
  universal: 'Universal Features',
  ai: 'AI Assistant',
  business: 'Business Types'
}

export function ManualScreen() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const params = useParams<{ '*': string }>()
  const profile = useBusinessStore((s) => s.profile)
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const [exporting, setExporting] = useState(false)

  const activeSlug = params['*'] || 'getting-started'
  const locale = i18n.language

  const activeChapter = MANUAL_CHAPTERS.find((c) => c.slug === activeSlug) ?? MANUAL_CHAPTERS[0]
  const content = getChapterContentWithFallback(locale, activeChapter.slug)

  const grouped = useMemo(() => {
    const groups: Record<string, typeof MANUAL_CHAPTERS> = {}
    for (const chapter of MANUAL_CHAPTERS) {
      groups[chapter.group] = groups[chapter.group] ?? []
      groups[chapter.group].push(chapter)
    }
    return groups
  }, [])

  async function handleDownloadPdf() {
    setExporting(true)
    try {
      const sections = MANUAL_CHAPTERS.map((chapter) => {
        const body = getChapterContentWithFallback(locale, chapter.slug)
        const html = ReactDOMServer.renderToStaticMarkup(<Markdown options={MARKDOWN_OPTIONS}>{body}</Markdown>)
        return `<section style="page-break-after: always;">${html}</section>`
      }).join('\n')

      const html = `<!doctype html><html><head><meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Segoe UI, Arial, sans-serif; color: #1e293b; line-height: 1.55; padding: 24px; }
          h1 { font-size: 22px; border-bottom: 2px solid #00AEEF; padding-bottom: 8px; }
          h2 { font-size: 17px; color: #00AEEF; margin-top: 20px; }
          h3 { font-size: 14px; margin-top: 14px; }
          code { background: #f1f5f9; padding: 1px 4px; border-radius: 4px; font-size: 12px; }
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1px solid #e2e8f0; padding: 6px 8px; font-size: 12px; }
        </style>
      </head><body>${sections}</body></html>`

      const res = await api.export.toPdf({ html, filename: `Sarang-Manual-${locale}.pdf` })
      if (res.success) toastSuccess(t('common.success'), 'Manual exported as PDF.')
      else toastError(t('common.error'), res.error?.message ?? 'Could not export the manual.')
    } catch {
      toastError(t('common.error'), 'Could not export the manual.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Table of contents */}
      <aside className="w-72 shrink-0 border-r border-slate-100 dark:border-slate-800 overflow-y-auto p-4 space-y-5">
        <div className="flex items-center gap-2 px-2">
          <HelpCircle size={18} className="text-brand" />
          <h1 className="text-base font-semibold text-dark dark:text-slate-100">{t('nav.manual', 'Manual')}</h1>
        </div>
        {(['getting-started', 'universal', 'ai', 'business'] as const).map((group) => (
          <div key={group}>
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
              {t(GROUP_TITLE_KEYS[group], GROUP_TITLE_FALLBACKS[group])}
            </p>
            <nav className="space-y-0.5">
              {grouped[group]?.map((chapter) => {
                const isActive = chapter.slug === activeChapter.slug
                const isCurrentBusinessType = chapter.businessTypes?.includes(profile?.businessType ?? '')
                return (
                  <button
                    key={chapter.slug}
                    onClick={() => navigate(`/manual/${chapter.slug}`)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors',
                      isActive
                        ? 'bg-brand-50 dark:bg-brand/10 text-brand font-medium'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    )}
                  >
                    <span className="truncate">{getChapterTitle(locale, chapter.slug, chapter.title)}</span>
                    {isCurrentBusinessType && !isActive && (
                      <span className="text-[10px] uppercase font-semibold text-brand shrink-0">{t('manual.yourType', 'Yours')}</span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>
        ))}
      </aside>

      {/* Chapter content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>{t(GROUP_TITLE_KEYS[activeChapter.group], GROUP_TITLE_FALLBACKS[activeChapter.group])}</span>
              <ChevronRight size={12} />
              <span className="text-slate-600 dark:text-slate-300 font-medium">{getChapterTitle(locale, activeChapter.slug, activeChapter.title)}</span>
            </div>
            {hasPermission('reports.print') && (
              <Button variant="secondary" size="sm" icon={<Download size={14} />} loading={exporting} onClick={handleDownloadPdf}>
                {t('manual.downloadPdf', 'Download Manual (PDF)')}
              </Button>
            )}
          </div>

          <Card padding="lg" className="shadow-sm">
            {content ? (
              <Markdown options={MARKDOWN_OPTIONS}>{content}</Markdown>
            ) : (
              <p className="text-sm text-slate-400">{t('manual.comingSoon', 'This chapter is being written and will be available soon.')}</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
