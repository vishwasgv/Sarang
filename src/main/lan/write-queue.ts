// The database takes one write at a time. When several PCs (and this PC's own window) save at once, their writes wait in
// line here instead of colliding and failing with "busy". Reads never wait. A stuck write is let go after two minutes.
let tail: Promise<unknown> = Promise.resolve()
const LIMIT_MS = 120_000

export function runInWriteQueue<T>(job: () => Promise<T>): Promise<T> {
  const run = tail.then(() => new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('write took too long')), LIMIT_MS)
    job().then((v) => { clearTimeout(timer); resolve(v) }, (e) => { clearTimeout(timer); reject(e) })
  }))
  tail = run.catch(() => undefined)
  return run
}
