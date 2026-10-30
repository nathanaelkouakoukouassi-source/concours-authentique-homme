import { get } from '@vercel/blob'
import { cookies } from 'next/headers'
import { type CandidatureDoc, getSettings, payloadClient } from '@/lib/server/contest'
import { CANDIDATE_COOKIE, readCandidateSession } from '@/lib/server/security'

/** Téléchargement du dossier officiel, réservé aux présélectionnés connectés à leur espace. */
export async function GET() {
  const cookieStore = await cookies()
  const candidateId = readCandidateSession(cookieStore.get(CANDIDATE_COOKIE)?.value)
  if (!candidateId) return new Response('Veuillez vous connecter à votre espace.', { status: 401 })

  const payload = await payloadClient()
  let candidate: CandidatureDoc
  try {
    candidate = (await payload.findByID({
      collection: 'candidatures',
      id: candidateId,
      depth: 0,
      overrideAccess: true,
    })) as unknown as CandidatureDoc
  } catch {
    return new Response('Candidature introuvable.', { status: 404 })
  }
  if (candidate.status !== 'preselectionne') {
    return new Response('Accès réservé aux candidats présélectionnés.', { status: 403 })
  }

  const settings = await getSettings(payload)
  if (!settings.dossierPathname || settings.dossierEnabled === false) {
    return new Response('Le dossier n’est pas encore disponible.', { status: 404 })
  }

  const result = await get(settings.dossierPathname, { access: 'private' })
  if (!result || result.statusCode !== 200) {
    return new Response('Le dossier est momentanément indisponible.', { status: 404 })
  }

  await payload.update({
    collection: 'candidatures',
    id: candidate.id,
    data: {
      dossierDownloadedAt: candidate.dossierDownloadedAt || new Date().toISOString(),
      dossierDownloads: Number(candidate.dossierDownloads || 0) + 1,
    },
    overrideAccess: true,
  })

  return new Response(result.stream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Dossier-Authentique-Homme-${candidate.candidateNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
