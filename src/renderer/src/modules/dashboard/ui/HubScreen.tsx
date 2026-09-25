import React, { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { NAV_GROUPS, groupOf, useVisibleNavItems, type NavGroupId } from '@shared/ui/layout/Sidebar'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'

type HubGroup = 'sales' | 'purchases' | 'accounting' | 'inventory'
const HUB_GROUPS: HubGroup[] = ['sales', 'purchases', 'accounting', 'inventory']

interface Stat { key: string; type: 'money' | 'number'; value: number; danger?: boolean }
interface DueBill { id: string; billNumber: string; supplier: string; dueDate: string; balance: number; overdue: boolean }
interface Summary { stats: Stat[]; dueBills?: DueBill[] }

// One overview page for a menu group: a few numbers, what is due, and a tile for every screen of the group.
export function HubScreen() {
  const { t } = useTranslation()
  const { group } = useParams()
  const items = useVisibleNavItems()
  const [summary, setSummary] = useState<Summary | null>(null)
  const valid = HUB_GROUPS.includes(group as HubGroup)

  useEffect(() => {
    if (!valid) return
    let alive = true
    window.api.hubs.summary({ group: group as HubGroup }).then((res) => {
      if (alive && res.success && res.data) setSummary(res.data as Summary)
    }).catch(() => { /* the tiles still work without the numbers */ })
    return () => { alive = false }
  }, [group, valid])

  if (!valid) return <Navigate to="/" replace />

  const def = NAV_GROUPS.find((g) => g.id === (group as NavGroupId))
  const tiles = items.filter((i) => groupOf(i) === group && !i.path.startsWith('/hub/'))

  return (
    <div className="p-6 space-y-6 overflow-auto h-full dark:bg-slate-950">
      <h1 className="text-xl font-bold text-dark dark:text-slate-100">{t(`hub.${group}`)}</h1>

      {summary && summary.stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {summary.stats.map((s) => (
            <Card key={s.key} padding="md">
              <div className="text-xs font-semibold text-slate-400 uppercase mb-1">{t(`hub.stat.${s.key}`)}</div>
              <div className={`text-xl font-bold ${s.danger ? 'text-danger' : 'text-dark dark:text-slate-100'}`}>{s.type === 'money' ? formatCurrency(s.value) : s.value}</div>
            </Card>
          ))}
        </div>
      )}

      {summary?.dueBills && (
        <Card padding="md" className="space-y-3">
          <h2 className="font-semibold text-dark dark:text-slate-100">{t('hub.dueBills')}</h2>
          {summary.dueBills.length === 0 ? (
            <p className="text-sm text-slate-500">{t('hub.noDueBills')}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {summary.dueBills.map((b) => (
                  <tr key={b.id} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="py-2"><Link to={`/bills/${b.id}`} className="text-brand font-medium hover:underline">{b.billNumber}</Link></td>
                    <td className="py-2 text-slate-600 dark:text-slate-300">{b.supplier}</td>
                    <td className="py-2 text-slate-500">{formatDate(b.dueDate)}{b.overdue && <Badge variant="danger" className="ms-2">{t('hub.overdue')}</Badge>}</td>
                    <td className="py-2 text-end font-semibold">{formatCurrency(b.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase mb-3">{t('hub.goTo')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {tiles.map((i) => (
            <Link key={i.path} to={i.path} className="min-h-[64px] flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-brand transition-colors">
              <i.icon size={20} className="text-brand shrink-0" />
              <span className="text-sm font-medium text-dark dark:text-slate-100">{i.i18nKey ? t(i.i18nKey) : i.label}</span>
            </Link>
          ))}
        </div>
        {def && tiles.length === 0 && <p className="text-sm text-slate-500">{def.label}</p>}
      </div>
    </div>
  )
}
