import { NextRequest } from 'next/server'
import { type CandidatureDoc, getSettings, payloadClient } from '@/lib/server/contest'
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
    !candidate.accessCodeHash ||
    !safeEqual(candidate.accessCodeHash, hashCode(code))
  ) {
    return Response.json({ success: false, message: GENERIC_ERROR }, { status: 401 })
  }

  // Identifiants corrects : on dit au candidat où en est sa candidature.
  if (candidate.status !== 'preselectionne') {
    const settings = await getSettings(payload)
    const selectionDone = (settings as { selectionStatus?: string }).selectionStatus === 'terminee'
    const message =
      candidate.status === 'refuse' || (selectionDone && settings.preselectionPublished)
        ? 'Votre candidature est bien enregistrée, mais elle ne fait pas partie des candidats présélectionnés. Merci sincèrement pour votre participation : vous pouvez suivre les candidats et voter sur le site.'
        : 'Vos identifiants sont corrects. Votre espace s’ouvrira si votre candidature est présélectionnée : la liste sera publiée sur le site à la clôture des inscriptions.'
    return Response.json({ success: false, message, pending: true }, { status: 403 })
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
