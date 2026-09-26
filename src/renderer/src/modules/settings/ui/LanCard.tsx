import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Card } from '@shared/ui/molecules/Card'
import { useNotificationStore } from '@app/store/notification.store'

interface Status {
  mode: 'off' | 'server' | 'client'
  port: number
  running: boolean
  addresses: string[]
  connections: Array<{ id: string; user: string | null; ip: string; since: number; lastSeen: number }>
  connectedTo: string | null
  host: string
  seats: number | null
  secret: string | null
  canEdit: boolean
}

// Multi-user on one shop network: one PC (the server) keeps the data, other PCs connect to it. Off by default.
export function LanCard() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [status, setStatus] = useState<Status | null>(null)
  const [mode, setMode] = useState<'off' | 'server' | 'client'>('off')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('47821')
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [testMessage, setTestMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await window.api.lan.getStatus()
    if (!res.success) return
    const s = res.data as Status
    setStatus(s)
    setMode(s.mode)
    setHost(s.host ?? '')
    setPort(String(s.port))
    if (s.secret) setSecret(s.secret)
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!status || status.mode !== 'server') return
    const id = setInterval(() => { void load() }, 5000)
    return () => clearInterval(id)
  }, [status?.mode, load])

  async function save() {
    setBusy(true)
    try {
      const res = await window.api.lan.saveConfig({ mode, port: Number(port) || undefined, host: mode === 'client' ? host : undefined, secret: secret || undefined })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('lan.saveFailed')); return }
      toastSuccess(t('lan.saved'))
      await window.api.lan.restart()
    } finally { setBusy(false) }
  }

  async function test() {
    setTestMessage(null)
    const res = await window.api.lan.testConnection({ host, port: Number(port) || undefined, secret })
    setTestMessage(res.success ? t('lan.testOk') : (res.error?.message ?? t('lan.testFailed')))
  }

  async function newSecret() {
    const res = await window.api.lan.newSecret()
    if (res.success) { setSecret((res.data as { secret: string }).secret); toastSuccess(t('lan.secretChanged')) }
    else toastError(t('common.error'), res.error?.message ?? t('lan.saveFailed'))
  }

  async function disconnect(id: string) {
    await window.api.lan.disconnect({ id })
    await load()
  }

  if (!status) return null
  const canEdit = status.canEdit

  return (
    <Card padding="md" className="space-y-4 max-w-2xl mt-6">
      <div>
        <h3 className="font-semibold text-dark dark:text-slate-100">{t('lan.title')}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('lan.intro')}</p>
      </div>

      <div className="space-y-2" role="radiogroup" aria-label={t('lan.title')}>
        {(['off', 'server', 'client'] as const).map((m) => (
          <label key={m} className="flex items-start gap-3 min-h-[44px] text-sm text-slate-700 dark:text-slate-200">
            <input type="radio" name="lan-mode" className="w-5 h-5 mt-0.5" checked={mode === m} disabled={!canEdit} onChange={() => setMode(m)} />
            <span>
              {t(`lan.mode.${m}`)}
              <span className="block text-xs text-slate-500 dark:text-slate-400">{t(`lan.modeHelp.${m}`)}</span>
            </span>
          </label>
        ))}
      </div>

      {mode === 'server' && (
        <div className="space-y-3">
          <Input label={t('lan.port')} value={port} onChange={(e) => setPort(e.target.value)} disabled={!canEdit} />
          <div>
            <Input label={t('lan.secret')} value={secret} onChange={(e) => setSecret(e.target.value)} disabled={!canEdit} />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('lan.secretHelp')}</p>
            {status.running && canEdit && <Button size="sm" variant="secondary" className="mt-2" onClick={newSecret}>{t('lan.newSecret')}</Button>}
          </div>
          {status.running && (
            <div className="text-sm text-slate-700 dark:text-slate-200 space-y-1">
              <p className="font-medium">{t('lan.running')}</p>
              <p>{t('lan.addresses')}: {status.addresses.length ? status.addresses.map((a) => `${a}:${status.port}`).join(', ') : t('lan.noAddress')}</p>
              <p>{t('lan.seats', { count: status.seats ?? 1 })}</p>
              <p>{t('lan.firewall')}</p>
            </div>
          )}
          {status.running && (
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t('lan.connected')}</p>
              {status.connections.length === 0 && <p className="text-sm text-slate-500">{t('lan.nobody')}</p>}
              <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                {status.connections.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{c.user ?? t('lan.notSignedIn')} <span className="text-slate-500">({c.ip})</span></span>
                    {canEdit && <Button size="sm" variant="secondary" onClick={() => disconnect(c.id)}>{t('lan.disconnect')}</Button>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {mode === 'client' && (
        <div className="space-y-3">
          <Input label={t('lan.serverAddress')} value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.1.10" disabled={!canEdit} />
          <Input label={t('lan.port')} value={port} onChange={(e) => setPort(e.target.value)} disabled={!canEdit} />
          <Input label={t('lan.secret')} value={secret} onChange={(e) => setSecret(e.target.value)} disabled={!canEdit} />
          <div className="flex items-center gap-3">
            <Button size="sm" variant="secondary" onClick={test} disabled={!host || !secret}>{t('lan.test')}</Button>
            {testMessage && <span className="text-sm text-slate-700 dark:text-slate-200">{testMessage}</span>}
          </div>
          {status.connectedTo && <p className="text-sm text-slate-600 dark:text-slate-300">{t('lan.connectedTo', { address: status.connectedTo })}</p>}
        </div>
      )}

      {canEdit && <Button size="sm" onClick={save} loading={busy}>{t('lan.saveRestart')}</Button>}
    </Card>
  )
}
