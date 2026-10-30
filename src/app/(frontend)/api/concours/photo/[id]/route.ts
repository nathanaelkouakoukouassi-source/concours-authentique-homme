import { get } from '@vercel/blob'
import { NextRequest } from 'next/server'
import { isAdminUser, isJuryUser } from '@/lib/access'
import { type CandidatureDoc, getSettings, payloadClient } from '@/lib/server/contest'

/**
 * Photo d’un candidat, stockée en privé.
 * Publique uniquement pour un candidat présélectionné dont la fiche est publiée
 * (et la liste publiée) ; sinon réservée au comité et au jury connectés.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const payload = await payloadClient()

  let candidate: CandidatureDoc
  try {
    candidate = (await payload.findByID({
      collection: 'candidatures',
      id,
      depth: 0,
      overrideAccess: true,
    })) as unknown as CandidatureDoc
  } catch {
    return new Response('Candidature introuvable.', { status: 404 })
  }

  const settings = await getSettings(payload)
  const isPublic =
    Boolean(settings.preselectionPublished) &&
    candidate.status === 'preselectionne' &&
    Boolean(candidate.published)

  if (!isPublic) {
    const { user } = await payload.auth({ headers: request.headers })
    const allowed =
      isAdminUser(user as never) ||
      (isJuryUser(user as never) && candidate.status === 'preselectionne')
    if (!allowed) return new Response('Accès réservé au comité.', { status: 401 })
  }

  if (!candidate.photoPathname) return new Response('Aucune photo.', { status: 404 })

  const result = await get(candidate.photoPathname, {
    access: 'private',
    ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
  })
  if (!result) return new Response('Photo introuvable.', { status: 404 })

  const cacheControl = isPublic ? 'public, max-age=300' : 'private, no-cache'
  if (result.statusCode === 304) {
    return new Response(null, {
      status: 304,
      headers: { ETag: result.blob.etag, 'Cache-Control': cacheControl },
    })
  }

  return new Response(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType,
      'X-Content-Type-Options': 'nosniff',
      ETag: result.blob.etag,
      'Cache-Control': cacheControl,
    },
  })
}
