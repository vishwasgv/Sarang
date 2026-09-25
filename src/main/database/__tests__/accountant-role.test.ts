import { describe, it, expect, vi } from 'vitest'

vi.mock('../db', () => ({ getPrisma: vi.fn() }))

import { ROLE_PERMISSIONS, PERMISSIONS } from '../seed'

const CHANGES_THINGS = /(create|update|modify|delete|disable|record|reverse|manage|reconcile|approve|void|adjust|import|assign|restore|cancel|edit|post|receive|process|issue|write|submit|pay|refund|override|lock)/i

describe('the Accountant role', () => {
  const list = ROLE_PERMISSIONS.Accountant

  it('exists and only holds permissions that are real', () => {
    const known = new Set(PERMISSIONS.map((p) => p.permissionKey))
    expect(list.length).toBeGreaterThan(20)
    expect(list.filter((k) => !known.has(k))).toEqual([])
  })

  it('cannot create, change, delete, approve or post anything', () => {
    const risky = list.filter((k) => k !== 'auth.changeOwnPassword' && CHANGES_THINGS.test(k.split('.')[1] ?? ''))
    expect(risky).toEqual([])
  })

  it('cannot see users, roles, settings, backups or the licence', () => {
    expect(list.filter((k) => /^(users|roles|settings|backup|license)\./.test(k))).toEqual([])
  })

  it('can read the books and reports', () => {
    for (const k of ['journalEntries.view', 'chartOfAccounts.view', 'reports.financial', 'reports.tax', 'bankReconciliation.view', 'customers.viewLedger']) expect(list).toContain(k)
  })
})
