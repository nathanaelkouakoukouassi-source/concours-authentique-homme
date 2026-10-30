import { NextRequest } from 'next/server'
import { type CandidatureDoc, payloadClient } from '@/lib/server/contest'
import {
  CANDIDATE_COOKIE,
  clientIp,
  createCandidateSession,
  hashCode,
  isRateLimited,
  safeEqual,
} from '@/lib/server/security'

const GENERIC_ERROR = 'Numéro de candidature ou code d’accès incorrect.'

/** Connexion à l’espace candidat avec le numéro de candidature et le code reçu par e-mail. */
export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers)
  if (isRateLimited(`espace:${ip}`, 8, 15 * 60 * 1000)) {
    return Response.json(
      { success: false, message: 'Trop de tentatives. Patientez quelques minutes.' },
      { status: 429 },
    )
  }

  let body: { numero?: string; code?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ success: false, message: 'Requête invalide.' }, { status: 400 })
  }
  const numero = String(body.numero || '')
    .trim()
    .toUpperCase()
  const code = String(body.code || '').trim()
  if (!numero || !code) {
    return Response.json({ success: false, message: GENERIC_ERROR }, { status: 400 })
  }

  const payload = await payloadClient()
  const found = await payload.find({
    collection: 'candidatures',
    where: { candidateNumber: { equals: numero } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const candidate = found.docs[0] as unknown as CandidatureDoc | undefined

  if (
    !candidate ||
    candidate.status !== 'preselectionne' ||
    !candidate.accessCodeHash ||
    !safeEqual(candidate.accessCodeHash, hashCode(code))
  ) {
    return Response.json({ success: false, message: GENERIC_ERROR }, { status: 401 })
  }

  const session = createCandidateSession(String(candidate.id))
  const response = Response.json({ success: true })
  response.headers.append(
    'Set-Cookie',
    `${CANDIDATE_COOKIE}=${session.token}; Path=/; Max-Age=${session.maxAge}; HttpOnly; Secure; SameSite=Lax`,
  )
  return response
}

export async function DELETE() {
  const response = Response.json({ success: true })
  response.headers.append(
    'Set-Cookie',
    `${CANDIDATE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
  )
  return response
}
