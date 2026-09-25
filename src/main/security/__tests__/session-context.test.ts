import { describe, it, expect } from 'vitest'
import { createSessionHolder, readSession, runWithSession, writeSession } from '../session-context'

const alice = { userId: 'a', username: 'alice', roleId: 'r1' }
const bob = { userId: 'b', username: 'bob', roleId: 'r2' }
const tick = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('session context', () => {
  it('outside any request the local window session is used', () => {
    writeSession(alice)
    expect(readSession()).toEqual(alice)
    writeSession(null)
    expect(readSession()).toBeNull()
  })

  it('a remote connection has its own session and never touches the local one', async () => {
    writeSession(alice)
    const remote = createSessionHolder()
    await runWithSession(remote, async () => {
      expect(readSession()).toBeNull()
      writeSession(bob)
      await tick(1)
      expect(readSession()).toEqual(bob)
    })
    expect(readSession()).toEqual(alice)
    writeSession(null)
  })

  it('two overlapping remote requests keep their own sessions across awaits', async () => {
    const h1 = createSessionHolder()
    const h2 = createSessionHolder()
    h1.session = alice
    h2.session = bob
    const seen: string[] = []
    await Promise.all([
      runWithSession(h1, async () => { await tick(5); seen.push('1:' + readSession()?.username) }),
      runWithSession(h2, async () => { await tick(1); seen.push('2:' + readSession()?.username) })
    ])
    expect(seen.sort()).toEqual(['1:alice', '2:bob'])
  })

  it('logout in one connection does not log out another', async () => {
    const h1 = createSessionHolder()
    const h2 = createSessionHolder()
    h1.session = alice
    h2.session = bob
    runWithSession(h1, () => writeSession(null))
    expect(h1.session).toBeNull()
    expect(h2.session).toEqual(bob)
  })
})
