import { after } from 'next/server'
import { type ContestData, ContestSite } from './contest-site'
import { publicQuiz } from '@/lib/quiz'
import {
  churchRoleLabel,
  getPublishedCandidates,
  getQuiz,
  getReflectionPrompt,
  getSettings,
  payloadClient,
  voteState,
} from '@/lib/server/contest'
import { registrationsAreOpen, runSelection, selectionIsDue } from '@/lib/server/selection'
import { computeFinaleRanking, computePreselectionRanking } from '@/lib/server/results'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function HomePage() {
  let data: ContestData | undefined
  try {
    const payload = await payloadClient()
    const settings = await getSettings(payload)

    // Déclenchement de la sélection automatique dès la première visite après la clôture
    // (la tâche planifiée quotidienne sert de filet de sécurité).
    if (selectionIsDue(settings as never)) {
      const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : undefined
      after(async () => {
        await runSelection(payload, { origin })
      })
    }
    const published = await getPublishedCandidates(payload, settings)
    const cards = published.map((candidate) => ({
      id: String(candidate.id),
      fullName: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
      churchName: candidate.churchName || '',
      churchRole: churchRoleLabel(candidate) || '',
      hasPhoto: Boolean(candidate.photoPathname),
    }))
    const byId = new Map(cards.map((card) => [card.id, card]))

    const needsRanking =
      settings.resultsPublished || settings.finalistsPublished || settings.laureatesPublished
    const ranking = needsRanking ? await computePreselectionRanking(payload) : []
    const finalistIds = ranking.slice(0, 3).map((row) => row.id)

    const results = settings.resultsPublished
      ? ranking
          .filter((row) => byId.has(row.id))
          .map((row) => ({
            ...byId.get(row.id)!,
            rank: row.rank,
            votePercent: row.votePercent,
            juryScore: row.juryScore,
            finalScore: row.finalScore,
          }))
      : null

    const finalists = settings.finalistsPublished
      ? finalistIds.map((id) => byId.get(id)).filter((card) => card !== undefined)
      : null

    let laureates: ContestData['laureates'] = null
    if (settings.laureatesPublished) {
      const finale = await computeFinaleRanking(payload, finalistIds)
      laureates = finale
        .filter((row) => byId.has(row.id))
        .map((row) => ({ ...byId.get(row.id)!, rank: row.rank }))
    }

    data = {
      cfg: {
        registrationsOpen: registrationsAreOpen(settings as never),
        registrationDeadline: settings.registrationDeadline || null,
        minimumAge: settings.minimumAge || null,
      },
      voteState: voteState(settings),
      candidates: cards,
      results,
      showJuryScore: settings.showJuryScore !== false,
      finalists,
      laureates,
      quiz: publicQuiz(getQuiz(settings)),
      reflectionPrompt: getReflectionPrompt(settings),
    }
  } catch {
    // Base indisponible : la page reste lisible avec les valeurs par défaut.
    data = undefined
  }

  return <ContestSite data={data} />
}
