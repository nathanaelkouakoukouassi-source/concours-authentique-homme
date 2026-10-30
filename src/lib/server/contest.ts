import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

export type Settings = {
  registrationsOpen?: boolean
  registrationDeadline?: string | null
  minimumAge?: string | null
  preselectionPublished?: boolean
  dossierPathname?: string | null
  dossierFilename?: string | null
  dossierEnabled?: boolean
  submissionDeadline?: string | null
  whatsappNumber?: string | null
  instructions?: string | null
  voteStatus?: 'a-venir' | 'ouvert' | 'clos' | 'validation' | 'publies'
  voteOpensAt?: string | null
  voteClosesAt?: string | null
  juryLocked?: boolean
  resultsPublished?: boolean
  showJuryScore?: boolean
  finalistsPublished?: boolean
  finalTopic?: string | null
  laureatesPublished?: boolean
}

export type CandidatureDoc = {
  id: string
  candidateNumber: string
  fullName?: string
  firstName?: string
  lastName?: string
  email?: string
  status?: string
  published?: boolean
  churchName?: string
  churchRole?: string
  churchRoleOther?: string
  educationLevel?: string
  publishEducation?: boolean
  photoPathname?: string
  worksStatus?: string
  reflectionTitle?: string
  reflectionSummary?: string
  biblicalReferences?: string
  fullText?: string
  videoUrl?: string
  accessCodeHash?: string
  codeSentAt?: string
  dossierDownloadedAt?: string
  dossierDownloads?: number
}

export async function payloadClient() {
  return getPayload({ config })
}

export async function getSettings(payload?: Payload): Promise<Settings> {
  const client = payload || (await payloadClient())
  try {
    return (await client.findGlobal({
      slug: 'reglages-concours',
      depth: 0,
      overrideAccess: true,
    })) as Settings
  } catch {
    return {}
  }
}

export type VoteState = 'a-venir' | 'ouvert' | 'clos' | 'validation' | 'publies'

/** État effectif du vote, en tenant compte des dates d’ouverture et de clôture. */
export function voteState(settings: Settings, now = new Date()): VoteState {
  const status = settings.voteStatus || 'a-venir'
  const opens = settings.voteOpensAt ? new Date(settings.voteOpensAt) : null
  const closes = settings.voteClosesAt ? new Date(settings.voteClosesAt) : null
  if (status === 'ouvert') {
    if (opens && now < opens) return 'a-venir'
    if (closes && now >= closes) return 'clos'
    return 'ouvert'
  }
  if (status === 'a-venir' && opens && now >= opens && (!closes || now < closes)) return 'ouvert'
  return status
}

export function churchRoleLabel(candidate: CandidatureDoc) {
  return candidate.churchRole === 'Autre' ? candidate.churchRoleOther : candidate.churchRole
}

/** Données publiques d’un candidat — jamais de téléphone, d’e-mail ni de données internes. */
export function publicCandidate(candidate: CandidatureDoc) {
  return {
    id: String(candidate.id),
    candidateNumber: candidate.candidateNumber,
    fullName: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
    churchName: candidate.churchName || '',
    churchRole: churchRoleLabel(candidate) || '',
    educationLevel: candidate.publishEducation ? candidate.educationLevel || '' : '',
    hasPhoto: Boolean(candidate.photoPathname),
    reflectionTitle: candidate.reflectionTitle || '',
    reflectionSummary: candidate.reflectionSummary || '',
    biblicalReferences: candidate.biblicalReferences || '',
    fullText: candidate.fullText || '',
    videoUrl: candidate.videoUrl || '',
    worksPublished: candidate.worksStatus === 'publies',
  }
}

export type PublicCandidate = ReturnType<typeof publicCandidate>

/** Candidats présélectionnés visibles publiquement (si la liste est publiée). */
export async function getPublishedCandidates(payload: Payload, settings: Settings) {
  if (!settings.preselectionPublished) return [] as CandidatureDoc[]
  const result = await payload.find({
    collection: 'candidatures',
    where: {
      and: [{ status: { equals: 'preselectionne' } }, { published: { equals: true } }],
    },
    sort: 'lastName',
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs as unknown as CandidatureDoc[]
}
