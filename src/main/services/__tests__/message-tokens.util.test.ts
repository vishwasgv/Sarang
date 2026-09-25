import { describe, it, expect } from 'vitest'
import { checkTemplateBody, templateProblemMessage, extractParams, rerenderMessage, stripSignature, splitTemplateKey, substitute } from '../message-tokens.util'

describe('template placeholders', () => {
  it('finds placeholders the message can never fill in', () => {
    expect(checkTemplateBody('Hi {{name}}, {{nmae}} on {{date}}', ['name', 'date']).unknown).toEqual(['nmae'])
    expect(templateProblemMessage('Hi {{name}}', ['name'])).toBeNull()
    expect(templateProblemMessage('Hi {{nmae}}', ['name'])).toMatch(/\{\{nmae\}\}/)
  })

  it('catches brackets that do not pair up', () => {
    expect(templateProblemMessage('Hi {{name}', ['name'])).toMatch(/not written correctly/)
    expect(templateProblemMessage('Hi {name}', ['name'])).toMatch(/not written correctly/)
    expect(templateProblemMessage('Hi {{ name }}', ['name'])).toBeNull()
  })
})

describe('re-wording a queued reminder', () => {
  const oldBody = 'Dear {{name}}, your visit is on {{date}} at {{time}}. Thanks!'
  const rendered = substitute(oldBody, { name: 'Rohan', date: '28 Sep', time: '4:30 PM' })

  it('reads the values back out of the finished message', () => {
    expect(extractParams(oldBody, rendered)).toEqual({ name: 'Rohan', date: '28 Sep', time: '4:30 PM' })
  })

  it('builds the message again from a new wording', () => {
    expect(rerenderMessage(oldBody, 'Hello {{name}}! See you {{date}}.', rendered)).toBe('Hello Rohan! See you 28 Sep.')
  })

  it('leaves a message alone when it no longer fits the old template (already edited)', () => {
    expect(rerenderMessage(oldBody, 'New {{name}}', 'something else entirely')).toBeNull()
  })

  it('leaves it alone when the new wording needs a value that is not known', () => {
    expect(rerenderMessage(oldBody, 'Hi {{name}} {{serviceTitle}}', rendered)).toBeNull()
  })

  it('works when the text has punctuation and regex characters', () => {
    const body = 'Total (approx.) {{amount}} + tax?'
    expect(rerenderMessage(body, '{{amount}} only', substitute(body, { amount: '₹1,250.00' }))).toBe('₹1,250.00 only')
  })
})

describe('signature and keys', () => {
  it('removes the closing Powered by Sarang line only', () => {
    expect(stripSignature('Dear Sam, see you soon. Thank you! Powered by Sarang | www.aszurex.com')).toBe('Dear Sam, see you soon. Thank you!')
    expect(stripSignature('Nothing to remove.')).toBe('Nothing to remove.')
  })

  it('splits stored keys into template and language', () => {
    expect(splitTemplateKey('GRN_POSTED@hi')).toEqual({ key: 'GRN_POSTED', lang: 'hi' })
    expect(splitTemplateKey('GRN_POSTED')).toEqual({ key: 'GRN_POSTED', lang: null })
  })
})
