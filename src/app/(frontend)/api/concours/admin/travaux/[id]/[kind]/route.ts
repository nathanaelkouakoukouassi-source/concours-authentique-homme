import { get } from '@vercel/blob'
import { NextRequest } from 'next/server'
import { isAdminUser, isJuryUser } from '@/lib/access'
import { payloadClient } from '@/lib/server/contest'
import type { CandidateWithWorks } from '@/lib/server/works'

export const maxDuration = 60

/** Vidéo ou PDF déposé par un candidat — réservé au comité et au jury connectés. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; kind: string }> },
) {
  const { id, kind } = await context.params
  if (kind !== 'video' && kind !== 'pdf') return new Response('Type inconnu.', { status: 400 })

  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: request.headers })
  if (!isAdminUser(user as never) && !isJuryUser(user as never)) {
    return new Response('Accès réservé au comité.', { status: 401 })
  }

  let candidate: CandidateWithWorks
  try {
    candidate = (await payload.findByID({
      collection: 'candidatures',
      id,
      depth: 0,
      overrideAccess: true,
    })) as unknown as CandidateWithWorks
  } catch {
    return new Response('Candidature introuvable.', { status: 404 })
  }
  if (isJuryUser(user as never) && candidate.status !== 'preselectionne') {
    return new Response('Accès refusé.', { status: 403 })
  }

  const pathname = kind === 'video' ? candidate.videoPathname : candidate.pdfPathname
  if (!pathname) return new Response('Aucun fichier déposé.', { status: 404 })

  const result = await get(pathname, { access: 'private' })
  if (!result || result.statusCode !== 200) return new Response('Fichier introuvable.', { status: 404 })

  const download = request.nextUrl.searchParams.get('telecharger') === '1'
  const extension = pathname.split('.').pop() || (kind === 'pdf' ? 'pdf' : 'mp4')
  const filename = `${candidate.candidateNumber}-${kind === 'video' ? 'video' : 'document'}.${extension}`
  return new Response(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType,
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
