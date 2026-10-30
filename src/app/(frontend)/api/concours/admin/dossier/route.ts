import { del, put } from '@vercel/blob'
import { NextRequest } from 'next/server'
import { json, requireAdmin } from '@/lib/server/admin-auth'
import { getSettings, payloadClient } from '@/lib/server/contest'

const MAX_BYTES = 4 * 1024 * 1024

/** Import du dossier officiel (PDF) dans le stockage privé. Réservé aux administrateurs. */
export async function POST(request: NextRequest) {
  const payload = await payloadClient()
  if (!(await requireAdmin(payload, request.headers))) {
    return json({ success: false, message: 'Accès réservé aux administrateurs.' }, 401)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return json({ success: false, message: 'Fichier illisible.' }, 400)
  }
  const file = form.get('file')
  if (!(file instanceof File) || !file.size) {
    return json({ success: false, message: 'Aucun fichier reçu.' }, 400)
  }
  if (file.type !== 'application/pdf') {
    return json({ success: false, message: 'Le dossier doit être un fichier PDF.' }, 400)
  }
  if (file.size > MAX_BYTES) {
    return json(
      { success: false, message: 'Le PDF dépasse 4 Mo : compressez-le puis réessayez.' },
      413,
    )
  }

  const previous = await getSettings(payload)
  const blob = await put('dossier/dossier-officiel-authentique-homme.pdf', file, {
    access: 'private',
    contentType: 'application/pdf',
    addRandomSuffix: true,
  })

  await payload.updateGlobal({
    slug: 'reglages-concours',
    data: { dossierPathname: blob.pathname, dossierFilename: file.name },
    overrideAccess: true,
  })

  if (previous.dossierPathname && previous.dossierPathname !== blob.pathname) {
    try {
      await del(previous.dossierPathname)
    } catch {
      // L’ancienne version reste stockée ; sans incidence pour les candidats.
    }
  }

  return json({ success: true, filename: file.name })
}

/** Aperçu du dossier pour l’administrateur. */
export async function GET(request: NextRequest) {
  const payload = await payloadClient()
  if (!(await requireAdmin(payload, request.headers))) {
    return new Response('Accès réservé aux administrateurs.', { status: 401 })
  }
  const settings = await getSettings(payload)
  if (!settings.dossierPathname) return new Response('Aucun dossier importé.', { status: 404 })
  const { get } = await import('@vercel/blob')
  const result = await get(settings.dossierPathname, { access: 'private' })
  if (!result || result.statusCode !== 200) return new Response('Introuvable.', { status: 404 })
  return new Response(result.stream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="dossier-authentique-homme.pdf"',
      'Cache-Control': 'private, no-store',
    },
  })
}
