import { NextRequest } from 'next/server'
import { json, requireAdmin } from '@/lib/server/admin-auth'
import { type CandidatureDoc, getSettings, payloadClient } from '@/lib/server/contest'
import { sendAccessCode } from '@/lib/server/access-code'
import { emailConfigured } from '@/lib/server/email'

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
          'L’envoi d’e-mails n’est pas encore configuré (variables GMAIL_USER et GMAIL_APP_PASSWORD à ajouter dans Vercel).',
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

  let sent = 0
  let skipped = 0
  const failed: string[] = []

  for (const candidate of candidates) {
    if (mode === 'nouveaux' && candidate.codeSentAt) {
      skipped += 1
      continue
    }
    const error = await sendAccessCode(payload, candidate, {
      origin: new URL(request.url).origin,
      submissionDeadline: settings.submissionDeadline,
    })
    if (error) {
      failed.push(`${candidate.candidateNumber} (${error})`)
      continue
    }
    sent += 1
  }

  return json({ success: true, total: candidates.length, sent, skipped, failed })
}
