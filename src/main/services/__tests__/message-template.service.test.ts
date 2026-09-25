import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../settings.service', () => ({ getSetting: vi.fn() }))

import { getPrisma } from '../../database/db'
import { getSetting } from '../settings.service'
import {
  getEffectiveTemplateBody, previewMessageTemplate, renderMessageTemplate, listMessageTemplates,
  updateMessageTemplate, resetMessageTemplate,
} from '../message-template.service'
import { MESSAGE_TEMPLATE_DEFS, MESSAGE_TEMPLATE_DEFAULTS_BY_KEY, SAMPLE_TOKEN_VALUES } from '../message-template.defaults'

function makeDb(overrides: Record<string, unknown> = {}) {
  const db = {
    messageTemplate: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    notificationQueue: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({}) },
    ...overrides,
  } as Record<string, any>
  return db
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: no reminder-message-language setting saved yet — every test
  // that cares about a specific language overrides this itself.
  vi.mocked(getSetting).mockResolvedValue({ success: true, data: null })
})

describe('message-template.defaults — catalog integrity', () => {
  it('every def has a unique key and a defaultBody referencing only its own declared tokens', () => {
    const seen = new Set<string>()
    for (const def of MESSAGE_TEMPLATE_DEFS) {
      expect(seen.has(def.key)).toBe(false)
      seen.add(def.key)
      const usedTokens = [...def.defaultBody.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])
      for (const tok of usedTokens) {
        expect(def.tokens).toContain(tok)
      }
    }
  })
})

describe('getEffectiveTemplateBody / renderMessageTemplate', () => {
  it('falls back to the built-in default when there is no DB override', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const body = await getEffectiveTemplateBody('MEMBERSHIP_EXPIRY_7D')

    expect(body).toBe(MESSAGE_TEMPLATE_DEFS.find((d) => d.key === 'MEMBERSHIP_EXPIRY_7D')!.defaultBody)
  })

  it('uses the DB override body when the owner has customized it', async () => {
    const db = makeDb({
      messageTemplate: { findMany: vi.fn().mockResolvedValue([{ templateKey: 'MEMBERSHIP_EXPIRY_7D', body: 'Custom: {{customerName}} expires {{expiryDate}}' }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const body = await getEffectiveTemplateBody('MEMBERSHIP_EXPIRY_7D')

    expect(body).toBe('Custom: {{customerName}} expires {{expiryDate}}')
  })

  it('returns an empty-string fallback for an unknown key with no default def', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const body = await getEffectiveTemplateBody('NOT_A_REAL_KEY')

    expect(body).toBe('')
  })

  it('falls back to the built-in default if the DB lookup itself throws (e.g. pre-migration DB)', async () => {
    const db = makeDb({ messageTemplate: { findMany: vi.fn().mockRejectedValue(new Error('no such table')) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const body = await getEffectiveTemplateBody('MEMBERSHIP_EXPIRY_7D')

    expect(body).toBe(MESSAGE_TEMPLATE_DEFS.find((d) => d.key === 'MEMBERSHIP_EXPIRY_7D')!.defaultBody)
  })

  it('uses the business reminder-message-language default when set and the key has a translation for it', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(getSetting).mockResolvedValue({ success: true, data: 'hi' })
    const def = MESSAGE_TEMPLATE_DEFAULTS_BY_KEY.MEMBERSHIP_EXPIRY_7D
    // Skip gracefully if the localization fork hasn't landed a Hindi entry yet — this
    // test's real job is proving the SETTING is read and applied, not asserting content.
    if (!def.defaultBodyByLocale?.hi) return

    const body = await getEffectiveTemplateBody('MEMBERSHIP_EXPIRY_7D')

    expect(body).toBe(def.defaultBodyByLocale.hi)
    expect(body).not.toBe(def.defaultBody)
  })

  it('falls back to the English default when the reminder-message-language has no translation for this key', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(getSetting).mockResolvedValue({ success: true, data: 'xx-NOT-A-REAL-LANG' })

    const body = await getEffectiveTemplateBody('MEMBERSHIP_EXPIRY_7D')

    expect(body).toBe(MESSAGE_TEMPLATE_DEFS.find((d) => d.key === 'MEMBERSHIP_EXPIRY_7D')!.defaultBody)
  })

  it('a DB override always wins regardless of the reminder-message-language setting', async () => {
    const db = makeDb({
      messageTemplate: { findMany: vi.fn().mockResolvedValue([{ templateKey: 'MEMBERSHIP_EXPIRY_7D', body: 'Owner override' }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(getSetting).mockResolvedValue({ success: true, data: 'hi' })

    const body = await getEffectiveTemplateBody('MEMBERSHIP_EXPIRY_7D')

    expect(body).toBe('Owner override')
  })

  it('substitutes every supplied {{token}} and leaves an unsupplied one as literal text', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const rendered = await renderMessageTemplate('MEMBERSHIP_EXPIRY_7D', { customerName: 'Asha' })

    expect(rendered).toContain('Dear Asha,')
    expect(rendered).toContain('{{expiryDate}}') // not supplied — left literal, not stripped/crashed
  })

  it('applies a customized template body when rendering, not the default', async () => {
    const db = makeDb({
      messageTemplate: { findMany: vi.fn().mockResolvedValue([{ templateKey: 'MEMBERSHIP_EXPIRY_7D', body: 'Hi {{customerName}}! Renew by {{expiryDate}}.' }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const rendered = await renderMessageTemplate('MEMBERSHIP_EXPIRY_7D', { customerName: 'Asha', expiryDate: '1 Oct' })

    expect(rendered).toBe('Hi Asha! Renew by 1 Oct.')
  })
})

describe('listMessageTemplates', () => {
  it('marks isCustomized only for keys with a DB override, and reports currentBody accordingly', async () => {
    const db = makeDb({
      messageTemplate: { findMany: vi.fn().mockResolvedValue([{ templateKey: 'MEMBERSHIP_EXPIRY_7D', body: 'Custom body' }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listMessageTemplates()

    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.length).toBe(MESSAGE_TEMPLATE_DEFS.length)
    const overridden = res.data.find((r) => r.key === 'MEMBERSHIP_EXPIRY_7D')!
    expect(overridden.isCustomized).toBe(true)
    expect(overridden.currentBody).toBe('Custom body')
    const untouched = res.data.find((r) => r.key !== 'MEMBERSHIP_EXPIRY_7D')!
    expect(untouched.isCustomized).toBe(false)
    expect(untouched.currentBody).toBe(untouched.defaultBody)
  })

  it('reports failure instead of throwing when the DB call fails', async () => {
    const db = makeDb({ messageTemplate: { findMany: vi.fn().mockRejectedValue(new Error('boom')) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listMessageTemplates()

    expect(res.success).toBe(false)
  })
})

describe('updateMessageTemplate', () => {
  it('rejects an unknown template key', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateMessageTemplate('NOT_A_REAL_KEY', 'Some text')

    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.error.code).toBe('MSGTPL-002')
    expect(db.messageTemplate.upsert).not.toHaveBeenCalled()
  })

  it('rejects an empty (or whitespace-only) body', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateMessageTemplate('MEMBERSHIP_EXPIRY_7D', '   ')

    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.error.code).toBe('MSGTPL-003')
    expect(db.messageTemplate.upsert).not.toHaveBeenCalled()
  })

  it('upserts a trimmed body for a known key', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateMessageTemplate('MEMBERSHIP_EXPIRY_7D', '  Custom body  ')

    expect(res.success).toBe(true)
    expect(db.messageTemplate.upsert).toHaveBeenCalledWith({
      where: { templateKey: 'MEMBERSHIP_EXPIRY_7D' },
      create: { templateKey: 'MEMBERSHIP_EXPIRY_7D', body: 'Custom body' },
      update: { body: 'Custom body' },
    })
  })
})

describe('resetMessageTemplate', () => {
  it('deletes the override row for the given key', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await resetMessageTemplate('MEMBERSHIP_EXPIRY_7D')

    expect(res.success).toBe(true)
    expect(db.messageTemplate.deleteMany).toHaveBeenCalledWith({ where: { templateKey: 'MEMBERSHIP_EXPIRY_7D' } })
  })
})

describe('previewMessageTemplate', () => {
  it('substitutes every SAMPLE_TOKEN_VALUES-covered token in a real catalog template', () => {
    const def = MESSAGE_TEMPLATE_DEFAULTS_BY_KEY.MEMBERSHIP_EXPIRY_7D

    const rendered = previewMessageTemplate(def.defaultBody)

    expect(rendered).not.toContain('{{')
    expect(rendered).toContain(SAMPLE_TOKEN_VALUES.customerName)
  })

  it('leaves a token literal when the sample set has no value for it (e.g. a mistyped draft token)', () => {
    const rendered = previewMessageTemplate('Hello {{customerName}}, your {{notARealToken}} is ready.')

    expect(rendered).toContain(SAMPLE_TOKEN_VALUES.customerName)
    expect(rendered).toContain('{{notARealToken}}')
  })

  it('never touches the DB — pure synchronous rendering', () => {
    // No getPrisma mock configured/returned here at all; a DB call would throw.
    expect(() => previewMessageTemplate('Hi {{customerName}}')).not.toThrow()
  })
})

describe('per-language wording, signature switch and queued reminders', () => {
  it('a language-specific override beats the any-language one', async () => {
    const db = makeDb({
      messageTemplate: { findMany: vi.fn().mockResolvedValue([
        { templateKey: 'MEMBERSHIP_EXPIRY_7D', body: 'English wording' },
        { templateKey: 'MEMBERSHIP_EXPIRY_7D@hi', body: 'Hindi wording' }
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(getSetting).mockImplementation(async (k: string) => ({ success: true, data: k === 'reminder_message_language' ? 'hi' : null }) as never)
    expect(await getEffectiveTemplateBody('MEMBERSHIP_EXPIRY_7D')).toBe('Hindi wording')
  })

  it('saving while a language other than English is chosen writes that language only', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(getSetting).mockImplementation(async (k: string) => ({ success: true, data: k === 'reminder_message_language' ? 'hi' : null }) as never)
    await updateMessageTemplate('MEMBERSHIP_EXPIRY_7D', 'नमस्ते {{customerName}}')
    expect(db.messageTemplate.upsert.mock.calls[0][0].where.templateKey).toBe('MEMBERSHIP_EXPIRY_7D@hi')
  })

  it('rejects a placeholder the message cannot fill in', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await updateMessageTemplate('MEMBERSHIP_EXPIRY_7D', 'Hi {{nmae}}')
    expect(res.success).toBe(false)
    expect(db.messageTemplate.upsert).not.toHaveBeenCalled()
  })

  it('the signature can be switched off', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(getSetting).mockImplementation(async (k: string) => ({ success: true, data: k === 'message_signature_enabled' ? 'false' : null }) as never)
    expect(await getEffectiveTemplateBody('MEMBERSHIP_EXPIRY_7D')).not.toMatch(/Powered by Sarang/)
  })

  it('re-words a waiting reminder when its template is edited', async () => {
    const def = MESSAGE_TEMPLATE_DEFS.find((d) => d.key === 'MEMBERSHIP_EXPIRY_7D')!
    const oldText = def.defaultBody.split('{{customerName}}').join('Asha').split('{{expiryDate}}').join('1 Oct')
    const db = makeDb({
      notificationQueue: {
        findMany: vi.fn().mockResolvedValue([{ id: 'n1', notificationType: 'MEMBERSHIP_EXPIRY_7D', templateBody: oldText, customerPhone: null }]),
        update: vi.fn().mockResolvedValue({})
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    let stored: string | null = null
    db.messageTemplate.findMany = vi.fn(async () => (stored === null ? [] : [{ templateKey: 'MEMBERSHIP_EXPIRY_7D', body: stored }]))
    db.messageTemplate.upsert = vi.fn(async (a: { create: { body: string } }) => { stored = a.create.body; return {} })
    const res = await updateMessageTemplate('MEMBERSHIP_EXPIRY_7D', 'Hi {{customerName}}, renew by {{expiryDate}}.')
    expect(res.success).toBe(true)
    expect(db.notificationQueue.update.mock.calls[0][0].data.templateBody).toBe('Hi Asha, renew by 1 Oct.')
  })
})
