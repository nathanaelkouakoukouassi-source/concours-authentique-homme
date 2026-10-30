import { createHash, createHmac, randomInt, timingSafeEqual } from 'crypto'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function serverSecret() {
  const mongo = process.env.MONGODB_URI || process.env.MONGODB_URL || ''
  return (
    process.env.PAYLOAD_SECRET ||
    createHash('sha256').update(`payload-secret:${mongo}`).digest('hex')
  )
}

export function randomCode(length: number, alphabet = CODE_ALPHABET) {
  let code = ''
  for (let index = 0; index < length; index += 1) code += alphabet[randomInt(alphabet.length)]
  return code
}

export function randomDigits(length: number) {
  return randomCode(length, '0123456789')
}

export function hashCode(code: string) {
  return createHmac('sha256', serverSecret())
    .update(code.trim().toUpperCase().replace(/\s|-/g, ''))
    .digest('hex')
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/* Session de l’espace candidat : cookie signé « id.expiration.signature ». */

export const CANDIDATE_COOKIE = 'ah_candidat'
const SESSION_HOURS = 6

function sign(value: string) {
  return createHmac('sha256', serverSecret()).update(`candidate-session:${value}`).digest('hex')
}

export function createCandidateSession(candidatureId: string) {
  const expires = Date.now() + SESSION_HOURS * 3600 * 1000
  const value = `${candidatureId}.${expires}`
  return { token: `${value}.${sign(value)}`, maxAge: SESSION_HOURS * 3600 }
}

export function readCandidateSession(token: string | undefined | null) {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [id, expires, signature] = parts
  if (!safeEqual(signature, sign(`${id}.${expires}`))) return null
  if (Number(expires) < Date.now()) return null
  return id
}

/* Limitation simple des tentatives (par instance serveur). */

const buckets = new Map<string, number[]>()

export function isRateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const recent = (buckets.get(key) || []).filter((timestamp) => now - timestamp < windowMs)
  if (recent.length >= limit) {
    buckets.set(key, recent)
    return true
  }
  recent.push(now)
  buckets.set(key, recent)
  return false
}

export function clientIp(headers: Headers) {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
  )
}
