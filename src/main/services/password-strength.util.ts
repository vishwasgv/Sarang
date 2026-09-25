// Password strength rules the owner can switch on: a mix of letter cases and digits, and not a very common password.

const COMMON = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'qwerty', 'qwerty123', 'qwertyuiop', '123456', '1234567', '12345678', '123456789', '1234567890',
  '111111', '000000', 'abc123', 'abcd1234', 'iloveyou', 'admin', 'admin123', 'admin@123', 'welcome', 'welcome1', 'letmein', 'sarang', 'sarang123', 'india123'
])

export type PasswordStrengthProblem = 'MIX' | 'COMMON'

export function passwordStrengthProblem(password: string): PasswordStrengthProblem | null {
  if (COMMON.has(password.toLowerCase())) return 'COMMON'
  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasDigit = /[0-9]/.test(password)
  if (!(hasLower && hasUpper && hasDigit)) return 'MIX'
  return null
}

export function passwordStrengthMessage(problem: PasswordStrengthProblem): string {
  return problem === 'COMMON'
    ? 'That password is too common. Choose something less guessable.'
    : 'Password must have a lowercase letter, an uppercase letter and a number.'
}
