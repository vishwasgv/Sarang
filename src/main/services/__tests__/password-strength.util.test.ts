import { describe, it, expect } from 'vitest'
import { passwordStrengthProblem } from '../password-strength.util'

describe('password strength', () => {
  it('needs lowercase, uppercase and a digit', () => {
    expect(passwordStrengthProblem('abcdefgh1')).toBe('MIX')
    expect(passwordStrengthProblem('ABCDEFGH1')).toBe('MIX')
    expect(passwordStrengthProblem('Abcdefghi')).toBe('MIX')
    expect(passwordStrengthProblem('Abcdefgh1')).toBeNull()
  })

  it('blocks very common passwords whatever their case', () => {
    expect(passwordStrengthProblem('Password123')).toBe('COMMON')
    expect(passwordStrengthProblem('QWERTY123')).toBe('COMMON')
  })
})
