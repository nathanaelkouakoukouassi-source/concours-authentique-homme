import { get } from '@vercel/blob'
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Sert la photo privée d’un candidat, uniquement à un membre du comité connecté au back-office.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const payload = await getPayload({ config })

  const { user } = await payload.auth({ headers: request.headers })
  if (!user || user.collection !== 'users') {
    return new Response('Accès réservé au comité.', { status: 401 })
  }

  let pathname: string | undefined
  try {
    const candidature = (await payload.findByID({
      collection: 'candidatures',
      id,
      depth: 0,
      overrideAccess: true,
    })) as { photoPathname?: string }
    pathname = candidature.photoPathname
  } catch {
    return new Response('Candidature introuvable.', { status: 404 })
  }
  if (!pathname) return new Response('Aucune photo.', { status: 404 })

  const result = await get(pathname, {
    access: 'private',
    ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
  })
  if (!result) return new Response('Photo introuvable.', { status: 404 })

  if (result.statusCode === 304) {
    return new Response(null, {
      status: 304,
      headers: { ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' },
    })
  }

  return new Response(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType,
      'X-Content-Type-Options': 'nosniff',
      ETag: result.blob.etag,
      'Cache-Control': 'private, no-cache',
    },
  })
}
