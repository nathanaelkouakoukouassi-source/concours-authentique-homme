import { NextRequest } from 'next/server'
import { payloadClient } from '@/lib/server/contest'
import { runSelection } from '@/lib/server/selection'

export const maxDuration = 60

/**
 * Tâche planifiée Vercel (vercel.json → crons) : lance la sélection automatique
 * si la date de clôture est passée. Sans effet sinon.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Non autorisé.', { status: 401 })
  }
  const payload = await payloadClient()
  const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : new URL(request.url).origin
  const result = await runSelection(payload, { origin })
  return Response.json({ ok: result.ok, message: result.message })
}
