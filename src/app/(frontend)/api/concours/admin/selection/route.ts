import { NextRequest } from 'next/server'
import { json, requireAdmin } from '@/lib/server/admin-auth'
import { aiConfigured } from '@/lib/server/ai-scoring'
import { payloadClient } from '@/lib/server/contest'
import { emailConfigured } from '@/lib/server/email'
import { runSelection } from '@/lib/server/selection'

export const maxDuration = 60

/** État de la sélection et compteurs pour le panneau du back-office. */
export async function GET(request: NextRequest) {
  const payload = await payloadClient()
  if (!(await requireAdmin(payload, request.headers))) {
    return json({ success: false, message: 'Accès réservé aux administrateurs.' }, 401)
  }
  const count = async (where: Record<string, unknown>) =>
    (
      await payload.count({
        collection: 'candidatures',
        where: where as never,
        overrideAccess: true,
      })
    ).totalDocs
  const [total, conformes, notees, preselectionnes] = await Promise.all([
    count({}),
    count({ status: { equals: 'conforme' } }),
    count({ and: [{ status: { equals: 'conforme' } }, { aiScoredAt: { exists: true } }] }),
    count({ status: { equals: 'preselectionne' } }),
  ])
  return json({
    success: true,
    total,
    conformes,
    notees,
    preselectionnes,
    aiReady: aiConfigured(),
    emailReady: emailConfigured(),
  })
}

/** Lancement manuel de la sélection (avant ou après la date de clôture). */
export async function POST(request: NextRequest) {
  const payload = await payloadClient()
  if (!(await requireAdmin(payload, request.headers))) {
    return json({ success: false, message: 'Accès réservé aux administrateurs.' }, 401)
  }
  const result = await runSelection(payload, {
    force: true,
    origin: new URL(request.url).origin,
  })
  return json({ success: result.ok, message: result.message })
}
