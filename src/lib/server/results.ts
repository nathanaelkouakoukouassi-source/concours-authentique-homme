import type { Payload } from 'payload'
import type { CandidatureDoc } from './contest'

export type RankingRow = {
  id: string
  candidateNumber: string
  fullName: string
  firstName: string
  lastName: string
  churchName: string
  hasPhoto: boolean
  published: boolean
  juryScore: number | null
  juryCount: number
  votes: number
  votePercent: number
  finalScore: number
  rank: number
}

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits

/**
 * Classement de la présélection (cahier des charges §11) :
 * note finale = note du jury × 0,80 + part du vote public × 0,20 ;
 * égalité départagée par la note du jury.
 */
export async function computePreselectionRanking(payload: Payload): Promise<RankingRow[]> {
  const candidates = (
    await payload.find({
      collection: 'candidatures',
      where: { status: { equals: 'preselectionne' } },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })
  ).docs as unknown as CandidatureDoc[]

  const scores = (
    await payload.find({
      collection: 'jury-scores',
      where: { phase: { equals: 'preselection' } },
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    })
  ).docs as unknown as Array<{ candidature: string; total?: number }>

  const votes = (
    await payload.find({
      collection: 'votes',
      where: { status: { not_equals: 'rejete' } },
      limit: 0,
      pagination: false,
      depth: 0,
      overrideAccess: true,
      select: { candidature: true },
    })
  ).docs as unknown as Array<{ candidature: string }>

  const totalVotes = votes.length
  const rows = candidates.map((candidate) => {
    const id = String(candidate.id)
    const own = scores.filter((score) => String(score.candidature) === id)
    const juryScore = own.length
      ? own.reduce((sum, score) => sum + Number(score.total || 0), 0) / own.length
      : null
    const candidateVotes = votes.filter((vote) => String(vote.candidature) === id).length
    const votePercent = totalVotes ? (candidateVotes / totalVotes) * 100 : 0
    const finalScore = (juryScore ?? 0) * 0.8 + votePercent * 0.2
    return {
      id,
      candidateNumber: candidate.candidateNumber,
      fullName: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
      firstName: candidate.firstName || '',
      lastName: candidate.lastName || '',
      churchName: candidate.churchName || '',
      hasPhoto: Boolean(candidate.photoPathname),
      published: Boolean(candidate.published),
      juryScore: juryScore === null ? null : round(juryScore),
      juryCount: own.length,
      votes: candidateVotes,
      votePercent: round(votePercent),
      finalScore: round(finalScore),
      rank: 0,
    }
  })

  rows.sort((a, b) => b.finalScore - a.finalScore || (b.juryScore ?? 0) - (a.juryScore ?? 0))
  rows.forEach((row, index) => {
    row.rank = index + 1
  })
  return rows
}

export type FinaleRow = {
  id: string
  fullName: string
  churchName: string
  hasPhoto: boolean
  juryScore: number | null
  juryCount: number
  rank: number
}

/** Classement de la grande finale : uniquement la moyenne des notes du jury (§13). */
export async function computeFinaleRanking(
  payload: Payload,
  finalistIds: string[],
): Promise<FinaleRow[]> {
  if (!finalistIds.length) return []
  const candidates = (
    await payload.find({
      collection: 'candidatures',
      where: { id: { in: finalistIds } },
      limit: 10,
      depth: 0,
      overrideAccess: true,
    })
  ).docs as unknown as CandidatureDoc[]
  const scores = (
    await payload.find({
      collection: 'jury-scores',
      where: { phase: { equals: 'finale' } },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
  ).docs as unknown as Array<{ candidature: string; total?: number }>

  const rows = candidates.map((candidate) => {
    const id = String(candidate.id)
    const own = scores.filter((score) => String(score.candidature) === id)
    const juryScore = own.length
      ? own.reduce((sum, score) => sum + Number(score.total || 0), 0) / own.length
      : null
    return {
      id,
      fullName: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
      churchName: candidate.churchName || '',
      hasPhoto: Boolean(candidate.photoPathname),
      juryScore: juryScore === null ? null : round(juryScore),
      juryCount: own.length,
      rank: 0,
    }
  })
  rows.sort((a, b) => (b.juryScore ?? -1) - (a.juryScore ?? -1))
  rows.forEach((row, index) => {
    row.rank = index + 1
  })
  return rows
}
