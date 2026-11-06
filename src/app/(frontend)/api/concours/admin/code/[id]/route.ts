import { NextRequest } from 'next/server'
import { json, requireAdmin } from '@/lib/server/admin-auth'
import { payloadClient } from '@/lib/server/contest'
import { hashCode, randomCode } from '@/lib/server/security'

/**
 * Génère un nouveau code d’accès pour un candidat (code perdu) et le renvoie à l’administrateur,
 * qui le transmet au candidat (WhatsApp, téléphone). L’ancien code cesse de fonctionner.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const payload = await payloadClient()
  if (!(await requireAdmin(payload, request.headers))) {
    return json({ success: false, message: 'Accès réservé aux administrateurs.' }, 401)
  }
  const code = randomCode(8)
  try {
    await payload.update({
      collection: 'candidatures',
      id,
      data: { accessCodeHash: hashCode(code), codeError: '' },
      overrideAccess: true,
      context: { skipAccessCode: true },
    })
  } catch {
    return json({ success: false, message: 'Candidature introuvable.' }, 404)
  }
  return json({ success: true, code })
}
