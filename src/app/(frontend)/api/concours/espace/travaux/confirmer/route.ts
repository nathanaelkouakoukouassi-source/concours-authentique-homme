import { head } from '@vercel/blob'
import { WORK_RULES, type WorkKind } from '@/lib/works'
import { payloadClient } from '@/lib/server/contest'
import { attachWork, currentCandidate } from '@/lib/server/works'

/** Après l’envoi direct, le navigateur confirme le fichier : on le vérifie puis on l’enregistre. */
export async function POST(request: Request) {
  let body: { kind?: WorkKind; pathname?: string; filename?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ success: false, message: 'Requête invalide.' }, { status: 400 })
  }

  const payload = await payloadClient()
  const candidate = await currentCandidate(payload)
  if (!candidate) {
    return Response.json(
      { success: false, message: 'Veuillez vous reconnecter à votre espace candidat.' },
      { status: 401 },
    )
  }

  const kind = body.kind
  const pathname = String(body.pathname || '')
  if ((kind !== 'video' && kind !== 'pdf') || !pathname.startsWith(`travaux/${candidate.candidateNumber}/`)) {
    return Response.json({ success: false, message: 'Fichier invalide.' }, { status: 400 })
  }

  let size = 0
  try {
    const info = await head(pathname)
    size = info.size
    const typeOk =
      kind === 'video'
        ? info.contentType.startsWith('video/')
        : info.contentType === 'application/pdf'
    if (!typeOk || size > WORK_RULES[kind].maxBytes) {
      return Response.json({ success: false, message: 'Fichier non conforme.' }, { status: 400 })
    }
  } catch {
    return Response.json(
      { success: false, message: 'Fichier introuvable : réessayez l’envoi.' },
      { status: 404 },
    )
  }

  await attachWork(
    payload,
    String(candidate.id),
    kind,
    { pathname, size, filename: String(body.filename || '').slice(0, 200) || undefined },
    new URL(request.url).origin,
  )

  return Response.json({ success: true, size, uploadedAt: new Date().toISOString() })
}
