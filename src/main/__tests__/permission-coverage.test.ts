import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

// Pure static-text analysis, not a runtime import of seed.ts or the handlers —
// avoids needing to mock Prisma/Electron just to check what strings appear in
// source. This test exists because the exact same bug (a permission key
// referenced by requirePermission() but never added to seed.ts's PERMISSIONS
// array, silently locking every role including Admin out of the feature
// forever) shipped independently in Phase 13 (inventory.add/adjust), Phase 14
// (inventory.manage), Phase 15 (sales.view/sales.manage), and Phase 20
// (billing.void) — four separate times across four separate phases. This one
// test structurally prevents a fifth.

const HANDLERS_DIR = join(__dirname, '..', 'ipc', 'handlers')
const SEED_FILE = join(__dirname, '..', 'database', 'seed.ts')

function getSeededPermissionKeys(): Set<string> {
  const seedSource = readFileSync(SEED_FILE, 'utf8')
  const keys = new Set<string>()
  const pattern = /permissionKey:\s*'([a-zA-Z0-9.]+)'/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(seedSource))) {
    keys.add(match[1])
  }
  return keys
}

function getReferencedPermissionKeys(): Map<string, string[]> {
  // key -> list of "file.ts:line" locations that reference it
  const referenced = new Map<string, string[]>()
  const files = readdirSync(HANDLERS_DIR).filter(f => f.endsWith('.ts'))
  const pattern = /requirePermission\(\s*'([a-zA-Z0-9.]+)'/g

  for (const file of files) {
    const filePath = join(HANDLERS_DIR, file)
    const content = readFileSync(filePath, 'utf8')
    const lines = content.split('\n')
    lines.forEach((line, idx) => {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(line))) {
        const key = match[1]
        const loc = `${file}:${idx + 1}`
        if (!referenced.has(key)) referenced.set(key, [])
        referenced.get(key)!.push(loc)
      }
    })
  }
  return referenced
}

describe('permission coverage — every requirePermission() key must be seeded', () => {
  it('finds at least one handler file to scan (sanity check the scan itself is working)', () => {
    const files = readdirSync(HANDLERS_DIR).filter(f => f.endsWith('.ts'))
    expect(files.length).toBeGreaterThan(10)
  })

  it('finds at least one seeded permission key (sanity check seed.ts parsing is working)', () => {
    const seeded = getSeededPermissionKeys()
    expect(seeded.size).toBeGreaterThan(10)
  })

  it('every permission key referenced by requirePermission() exists in seed.ts', () => {
    const seeded = getSeededPermissionKeys()
    const referenced = getReferencedPermissionKeys()

    const missing: string[] = []
    for (const [key, locations] of referenced.entries()) {
      if (!seeded.has(key)) {
        missing.push(`'${key}' referenced at ${locations.join(', ')}`)
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `${missing.length} permission key(s) are referenced by requirePermission() but never seeded in database/seed.ts — every role, including Admin, is permanently locked out of these actions:\n` +
        missing.map(m => `  - ${m}`).join('\n')
      )
    }
    expect(missing).toEqual([])
  })
})
