import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

// Messages between two Sarang PCs are sealed with AES-256-GCM using a key made from the shared secret the owner sets
// on the server PC. The address and port are not secret; without the secret a message cannot be read or forged.
const SALT = 'sarang-lan-v1'
const keys = new Map<string, Buffer>()

function keyFor(secret: string): Buffer {
  let k = keys.get(secret)
  if (!k) {
    k = scryptSync(secret, SALT, 32)
    keys.set(secret, k)
  }
  return k
}

export function seal(secret: string, value: unknown): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyFor(secret), iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')
}

export function open<T = unknown>(secret: string, text: string): T {
  const raw = Buffer.from(text, 'base64')
  if (raw.length < 29) throw new Error('bad message')
  const decipher = createDecipheriv('aes-256-gcm', keyFor(secret), raw.subarray(0, 12))
  decipher.setAuthTag(raw.subarray(12, 28))
  const plain = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()])
  return JSON.parse(plain.toString('utf8')) as T
}

export interface RpcRequest {
  channel: string
  payload: unknown
  conn?: string
}

export interface RpcDownload { tempName: string; suggestedName: string; base64: string }

export interface RpcResponse {
  conn: string
  result: unknown
  downloads?: RpcDownload[]
}

export interface PollResponse { seq: number; by: string | null; at: number }

export const LAN_DEFAULT_PORT = 47821
