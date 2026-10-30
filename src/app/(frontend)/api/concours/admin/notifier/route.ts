import { NextRequest } from 'next/server'
import { json, requireAdmin } from '@/lib/server/admin-auth'
import { type CandidatureDoc, getSettings, payloadClient } from '@/lib/server/contest'
import { codeBlock, emailConfigured, emailLayout, escapeHtml, sendEmail } from '@/lib/server/email'
import { hashCode, randomCode } from '@/lib/server/security'

/**
 * Envoie à chaque candidat présélectionné un e-mail avec son code d’accès personnel
 * à l’espace candidat (cahier des charges §7). Aucun PDF n’est joint.
 * mode « nouveaux » : seulement ceux qui n’ont pas encore reçu de code ; « tous » : renvoie à tous.
 */
export async function POST(request: NextRequest) {
  const payload = await payloadClient()
  if (!(await requireAdmin(payload, request.headers))) {
    return json({ success: false, message: 'Accès réservé aux administrateurs.' }, 401)
  }
  if (!emailConfigured()) {
    return json(
      {
        success: false,
        message:
          'L’envoi d’e-mails n’est pas encore configuré (clé RESEND_API_KEY manquante dans Vercel).',
      },
      503,
    )
  }

  let mode = 'nouveaux'
  try {
    const body = (await request.json()) as { mode?: string }
    if (body.mode === 'tous') mode = 'tous'
  } catch {
    // corps vide : mode par défaut
  }

  const settings = await getSettings(payload)
  const candidates = (
    await payload.find({
      collection: 'candidatures',
      where: { status: { equals: 'preselectionne' } },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })
  ).docs as unknown as CandidatureDoc[]

  const origin = new URL(request.url).origin
  let sent = 0
  let skipped = 0
  const failed: string[] = []

  for (const candidate of candidates) {
    if (mode === 'nouveaux' && candidate.codeSentAt) {
      skipped += 1
      continue
    }
    if (!candidate.email) {
      failed.push(`${candidate.candidateNumber} (pas d’e-mail)`)
      continue
    }
    const code = randomCode(8)
    const html = emailLayout(
      'Félicitations ! Vous êtes présélectionné(e).',
      `<p>Bonjour ${escapeHtml(candidate.firstName || '')},</p>
       <p>Votre candidature a été retenue parmi les dix candidats sélectionnés pour participer au concours <strong>AUTHENTIQUE HOMME</strong>.</p>
       <p>Votre dossier de participation (règlement, sujet, consignes et modalités de soumission) est disponible dans votre espace candidat, directement sur le site.</p>
       ${codeBlock('Votre code d’accès personnel', code)}
       <p>Numéro de candidature : <strong>${escapeHtml(candidate.candidateNumber)}</strong></p>
       <p style="text-align:center;margin:28px 0">
         <a href="${origin}/espace-candidat" style="display:inline-block;background:#4736b6;color:white;padding:14px 26px;border-radius:999px;text-decoration:none;font-weight:700">Accéder à mon espace candidat</a>
       </p>
       ${settings.submissionDeadline ? `<p>Date limite de soumission des travaux : <strong>${escapeHtml(settings.submissionDeadline)}</strong></p>` : ''}
       <p>Gardez ce code confidentiel : il donne accès à votre dossier.</p>
       <p style="margin-top:24px">Le comité d’organisation<br/>Ministère Porteur d’Amour</p>`,
    )
    const ok = await sendEmail(
      candidate.email,
      'Félicitations ! Vous êtes présélectionné(e) au concours AUTHENTIQUE HOMME',
      html,
      process.env.MINISTRY_DESTINATION_EMAIL,
    )
    if (!ok) {
      failed.push(candidate.candidateNumber)
      continue
    }
    await payload.update({
      collection: 'candidatures',
      id: candidate.id,
      data: { accessCodeHash: hashCode(code), codeSentAt: new Date().toISOString() },
      overrideAccess: true,
    })
    sent += 1
  }

  return json({ success: true, total: candidates.length, sent, skipped, failed })
}
