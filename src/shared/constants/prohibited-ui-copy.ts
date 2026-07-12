// PROHIBITED UI COPY — RULE PM005 and related rules
// These strings MUST NEVER appear in the UI (buttons, toasts, labels, tooltips, errors)
// Sarang RECORDS payments/transactions. It does NOT process, verify, or confirm them.
//
// Run: grep -r "PROHIBITED" src/renderer for any accidental use.

export const PROHIBITED_COPY = [
  // Payment processing language (RULE PM005)
  'Payment successful',
  'Payment confirmed',
  'Transaction complete',
  'Transaction successful',
  'Payment processed',
  'Charging',
  'Processing payment',
  'Verifying payment',
  'Payment verified',
  'Payment approved',
  'Payment declined',
  'Card charged',
  'Deducted from account',

  // Cloud / sync language (no cloud)
  'Syncing',
  'Connected to server',
  'Online mode',
  'Cloud backup complete',

  // AI / prediction language (no AI)
  'AI suggests',
  'Recommended by AI',
  'Smart suggestion',
  'Predicted',

  // Subscription / account language
  'Subscribe',
  'Upgrade your plan',
  'Your trial has expired',
  'Login with Google',
  'Create an account',

  // Compliance overstatements — never claim regulatory approval
  'GST Compliant',
  'Government Approved',
  'Tax Authority Certified',
  'Audit Ready',
  'Certified Software',
  'CA Approved',
  'RBI Compliant',

  // Accuracy guarantees — calculations depend on user data
  '100% Accurate',
  'Error-Free Calculations',
  'Guaranteed Accurate',
  'Zero Error',

  // Security overstatements
  '100% Secure',
  'Hack-Proof',
  'Breach-Proof',
  'Military Grade Security',
  'Unbreakable Encryption',

  // Cloud claims (Sarang is offline-only)
  'Cloud Backup Included',
  'Automatic Cloud Sync',
  'Synced to cloud',
  'Cloud-powered',
] as const

export type ProhibitedCopy = typeof PROHIBITED_COPY[number]
