import { NextRequest } from 'next/server'
import { json, requireAdmin } from '@/lib/server/admin-auth'
import { payloadClient } from '@/lib/server/contest'
import { computeFinaleRanking, computePreselectionRanking } from '@/lib/server/results'

/** Classement calculé en direct pour le comité (présélection et finale). */
export async function GET(request: NextRequest) {
  const payload = await payloadClient()
  if (!(await requireAdmin(payload, request.headers))) {
    return json({ success: false, message: 'Accès réservé aux administrateurs.' }, 401)
  }
  const preselection = await computePreselectionRanking(payload)
  const finalists = preselection.slice(0, 3).map((row) => row.id)
  const finale = await computeFinaleRanking(payload, finalists)
  const totalVotes = preselection.reduce((sum, row) => sum + row.votes, 0)
  return json({ success: true, preselection, finale, totalVotes })
}
