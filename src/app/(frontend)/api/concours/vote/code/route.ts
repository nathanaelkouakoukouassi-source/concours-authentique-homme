import { NextRequest } from 'next/server'
import { EMAIL_PATTERN } from '@/lib/candidature-schema'
import {
  type CandidatureDoc,
  getSettings,
  payloadClient,
  voteState,
} from '@/lib/server/contest'
import { codeBlock, emailConfigured, emailLayout, escapeHtml, sendEmail } from '@/lib/server/email'
import { clientIp, hashCode, isRateLimited, randomDigits } from '@/lib/server/security'

/** Étape 1 du vote : envoi d’un code à 6 chiffres à l’adresse du votant. */
export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers)
  if (isRateLimited(`vote-code:${ip}`, 6, 15 * 60 * 1000)) {
    return Response.json(
      { success: false, message: 'Trop de demandes. Patientez quelques minutes.' },
      { status: 429 },
    )
  }

  let body: { email?: string; candidateId?: string; website?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ success: false, message: 'Requête invalide.' }, { status: 400 })
  }
  if (body.website) return Response.json({ success: true })

  const email = String(body.email || '')
    .trim()
    .toLowerCase()
  if (!EMAIL_PATTERN.test(email)) {
    return Response.json(
      { success: false, message: 'Indiquez une adresse e-mail valide.' },
      { status: 400 },
    )
  }
  if (isRateLimited(`vote-code-email:${email}`, 3, 30 * 60 * 1000)) {
    return Response.json(
      { success: false, message: 'Un code vient déjà d’être envoyé à cette adresse. Vérifiez vos e-mails.' },
      { status: 429 },
    )
  }

  const payload = await payloadClient()
  const settings = await getSettings(payload)
  const state = voteState(settings)
  if (state === 'a-venir') {
    return Response.json(
      { success: false, message: 'Le vote n’est pas encore ouvert. Revenez à la date annoncée.' },
      { status: 403 },
    )
  }
  if (state !== 'ouvert') {
    return Response.json(
      { success: false, message: 'La période de vote est terminée. Merci pour votre participation.' },
      { status: 403 },
    )
  }

  let candidate: CandidatureDoc
  try {
    candidate = (await payload.findByID({
      collection: 'candidatures',
      id: String(body.candidateId || ''),
      depth: 0,
      overrideAccess: true,
    })) as unknown as CandidatureDoc
  } catch {
    return Response.json({ success: false, message: 'Candidat introuvable.' }, { status: 404 })
  }
  if (candidate.status !== 'preselectionne' || !candidate.published || !settings.preselectionPublished) {
    return Response.json({ success: false, message: 'Candidat introuvable.' }, { status: 404 })
  }

  const already = await payload.find({
    collection: 'votes',
    where: { voterEmail: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (already.docs.length) {
    return Response.json(
      { success: false, message: 'Cette adresse e-mail a déjà été utilisée pour voter.' },
      { status: 409 },
    )
  }

  if (!emailConfigured()) {
    return Response.json(
      { success: false, message: 'Le vote est momentanément indisponible. Réessayez plus tard.' },
      { status: 503 },
    )
  }

  const code = randomDigits(6)
  await payload.delete({
    collection: 'vote-verifications',
    where: { email: { equals: email } },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'vote-verifications',
    data: {
      email,
      codeHash: hashCode(code),
      candidature: candidate.id,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      attempts: 0,
    },
    overrideAccess: true,
  })

  const name = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim()
  const ok = await sendEmail(
    email,
    `Votre code de vote : ${code}`,
    emailLayout(
      'Confirmez votre vote',
      `<p>Vous avez choisi de voter pour <strong>${escapeHtml(name)}</strong> au concours AUTHENTIQUE HOMME.</p>
       ${codeBlock('Votre code de confirmation (valable 15 minutes)', code)}
       <p>Saisissez ce code sur le site pour valider votre vote. Si vous n’êtes pas à l’origine de cette demande, ignorez simplement cet e-mail.</p>`,
    ),
  )
  if (!ok) {
    return Response.json(
      { success: false, message: 'L’envoi du code a échoué. Vérifiez l’adresse et réessayez.' },
      { status: 502 },
    )
  }

  return Response.json({ success: true })
}
