import { NextRequest } from 'next/server'
import { getSettings, payloadClient, voteState } from '@/lib/server/contest'
import { clientIp, hashCode, isRateLimited, safeEqual } from '@/lib/server/security'

type Verification = {
  id: string
  codeHash: string
  candidature: string
  expiresAt: string
  attempts?: number
}

/** Étape 2 du vote : vérification du code et enregistrement du vote (un par e-mail). */
export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers)
  if (isRateLimited(`vote-confirm:${ip}`, 15, 15 * 60 * 1000)) {
    return Response.json(
      { success: false, message: 'Trop de tentatives. Patientez quelques minutes.' },
      { status: 429 },
    )
  }

  let body: { email?: string; code?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ success: false, message: 'Requête invalide.' }, { status: 400 })
  }
  const email = String(body.email || '')
    .trim()
    .toLowerCase()
  const code = String(body.code || '').replace(/\D/g, '')

  const payload = await payloadClient()
  const settings = await getSettings(payload)
  if (voteState(settings) !== 'ouvert') {
    return Response.json(
      { success: false, message: 'La période de vote est terminée. Merci pour votre participation.' },
      { status: 403 },
    )
  }

  const found = await payload.find({
    collection: 'vote-verifications',
    where: { email: { equals: email } },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const verification = found.docs[0] as unknown as Verification | undefined
  if (!verification || new Date(verification.expiresAt).getTime() < Date.now()) {
    return Response.json(
      { success: false, message: 'Code expiré ou introuvable. Demandez un nouveau code.' },
      { status: 400 },
    )
  }
  if (Number(verification.attempts || 0) >= 5) {
    return Response.json(
      { success: false, message: 'Trop d’essais avec ce code. Demandez un nouveau code.' },
      { status: 429 },
    )
  }
  if (!safeEqual(verification.codeHash, hashCode(code))) {
    await payload.update({
      collection: 'vote-verifications',
      id: verification.id,
      data: { attempts: Number(verification.attempts || 0) + 1 },
      overrideAccess: true,
    })
    return Response.json({ success: false, message: 'Code incorrect.' }, { status: 400 })
  }

  try {
    await payload.create({
      collection: 'votes',
      data: {
        voterEmail: email,
        candidature: verification.candidature,
        status: 'valide',
        ip,
      },
      overrideAccess: true,
    })
  } catch {
    // Index unique sur l’e-mail : vote déjà enregistré.
    return Response.json(
      { success: false, message: 'Cette adresse e-mail a déjà été utilisée pour voter.' },
      { status: 409 },
    )
  } finally {
    await payload.delete({
      collection: 'vote-verifications',
      where: { email: { equals: email } },
      overrideAccess: true,
    })
  }

  return Response.json({ success: true })
}
