import { describe, it, expect } from 'vitest'
import { ServiceError } from '../../errors/service-error'

describe('ServiceError', () => {
  it('stores code and message', () => {
    const err = new ServiceError('INV-001', 'Invoice not found')
    expect(err.code).toBe('INV-001')
    expect(err.message).toBe('Invoice not found')
  })

  it('is an instance of Error', () => {
    const err = new ServiceError('AUTH-001', 'Unauthorized')
    expect(err).toBeInstanceOf(Error)
  })

  it('has name "ServiceError"', () => {
    const err = new ServiceError('SYS-001', 'System error')
    expect(err.name).toBe('ServiceError')
  })

  it('is distinguishable from plain Error in catch blocks', () => {
    function throwServiceError() {
      throw new ServiceError('B-005', 'Negative total')
    }

    try {
      throwServiceError()
    } catch (err) {
      if (err instanceof ServiceError) {
        expect(err.code).toBe('B-005')
        return
      }
      throw new Error('Should have been ServiceError')
    }
  })
})
