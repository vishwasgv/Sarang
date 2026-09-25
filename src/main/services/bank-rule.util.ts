// Bank rules: match a statement line by its text, direction and amount, and say which account it belongs to.

export interface BankRuleLike {
  id: string
  name: string
  bankAccountId: string | null
  direction: string // DEBIT (money out) | CREDIT (money in) | ANY
  contains: string
  minAmount: number | null
  maxAmount: number | null
  accountId: string
  priority: number
  isActive: boolean
}

export interface StatementLineLike {
  bankAccountId: string
  description: string
  referenceNumber: string | null
  debitAmount: number
  creditAmount: number
}

export function lineAmount(line: StatementLineLike): number {
  return line.debitAmount > 0 ? line.debitAmount : line.creditAmount
}

export function ruleMatches(rule: BankRuleLike, line: StatementLineLike): boolean {
  if (!rule.isActive) return false
  if (rule.bankAccountId && rule.bankAccountId !== line.bankAccountId) return false
  const out = line.debitAmount > 0
  if (rule.direction === 'DEBIT' && !out) return false
  if (rule.direction === 'CREDIT' && out) return false
  const words = rule.contains.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length > 0) {
    const text = `${line.description} ${line.referenceNumber ?? ''}`.toLowerCase()
    if (!words.every((w) => text.includes(w))) return false
  }
  const amount = lineAmount(line)
  if (rule.minAmount !== null && amount < rule.minAmount) return false
  if (rule.maxAmount !== null && amount > rule.maxAmount) return false
  return true
}

/** The first rule that fits: lowest priority number wins, then the older rule. */
export function firstMatchingRule<T extends BankRuleLike>(rules: T[], line: StatementLineLike): T | null {
  const ordered = [...rules].sort((a, b) => a.priority - b.priority)
  return ordered.find((r) => ruleMatches(r, line)) ?? null
}
