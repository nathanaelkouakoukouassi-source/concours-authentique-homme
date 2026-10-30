import { del, list } from '@vercel/blob'
import { cookies } from 'next/headers'
import type { Payload } from 'payload'
import { type WorkKind, STORAGE_SAFE_LIMIT, formatBytes } from '../works'
import { type CandidatureDoc, payloadClient } from './contest'
import { emailConfigured, emailLayout, escapeHtml, sendEmail } from './email'
import { CANDIDATE_COOKIE, readCandidateSession } from './security'

export type WorksSettings = {
  worksUploadOpen?: boolean
  worksClosesAt?: string | null
  submissionDeadline?: string | null
}

export type CandidateWithWorks = CandidatureDoc & {
  videoPathname?: string
  videoSize?: number
  videoFilename?: string
  videoUploadedAt?: string
  pdfPathname?: string
  pdfSize?: number
  pdfFilename?: string
  pdfUploadedAt?: string
}

export function worksUploadIsOpen(settings: WorksSettings, now = new Date()) {
  if (settings.worksUploadOpen === false) return false
  if (settings.worksClosesAt && now >= new Date(settings.worksClosesAt)) return false
  return true
}

/** Candidat présélectionné connecté à son espace, ou null. */
export async function currentCandidate(payload?: Payload) {
  const cookieStore = await cookies()
  const id = readCandidateSession(cookieStore.get(CANDIDATE_COOKIE)?.value)
  if (!id) return null
  const client = payload || (await payloadClient())
  try {
    const candidate = (await client.findByID({
      collection: 'candidatures',
      id,
      depth: 0,
      overrideAccess: true,
    })) as unknown as CandidateWithWorks
    return candidate.status === 'preselectionne' ? candidate : null
  } catch {
    return null
  }
}

/** Taille totale occupée dans le stockage (pour rester sous le quota gratuit). */
export async function storageUsedBytes() {
  let total = 0
  let cursor: string | undefined
  do {
    const page = await list({ cursor, limit: 1000 })
    for (const blob of page.blobs) total += blob.size
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  return total
}

export async function hasRoomFor(bytes: number) {
  return (await storageUsedBytes()) + bytes <= STORAGE_SAFE_LIMIT
}

/** Rattache un fichier déposé à la fiche du candidat (idempotent). */
export async function attachWork(
  payload: Payload,
  candidateId: string,
  kind: WorkKind,
  file: { pathname: string; size: number; filename?: string },
  origin?: string,
) {
  const candidate = (await payload.findByID({
    collection: 'candidatures',
    id: candidateId,
    depth: 0,
    overrideAccess: true,
  })) as unknown as CandidateWithWorks

  const previous = kind === 'video' ? candidate.videoPathname : candidate.pdfPathname
  if (previous === file.pathname) {
    // Déjà enregistré (rappel de Vercel Blob) : on complète seulement la taille et le nom.
    if (file.size || file.filename) {
      await payload.update({
        collection: 'candidatures',
        id: candidateId,
        data: {
          ...(file.size ? { [`${kind}Size`]: file.size } : {}),
          ...(file.filename ? { [`${kind}Filename`]: file.filename } : {}),
        },
        overrideAccess: true,
      })
    }
    return candidate
  }

  const now = new Date().toISOString()
  const hasVideo = kind === 'video' || Boolean(candidate.videoPathname)
  const hasPdf = kind === 'pdf' || Boolean(candidate.pdfPathname)
  const keepStatus = ['verification', 'valides', 'publies'].includes(candidate.worksStatus || '')
  const worksStatus = keepStatus
    ? candidate.worksStatus
    : hasVideo && hasPdf
      ? 'recus'
      : 'incomplets'

  await payload.update({
    collection: 'candidatures',
    id: candidateId,
    data: {
      [`${kind}Pathname`]: file.pathname,
      [`${kind}Size`]: file.size,
      [`${kind}Filename`]: file.filename || file.pathname.split('/').pop(),
      [`${kind}UploadedAt`]: now,
      worksStatus,
    },
    overrideAccess: true,
  })

  // L’ancienne version est supprimée pour préserver le quota gratuit.
  if (previous) {
    try {
      await del(previous)
    } catch {
      // sans incidence
    }
  }

  const destination = process.env.MINISTRY_DESTINATION_EMAIL || process.env.GMAIL_USER
  if (destination && emailConfigured()) {
    const name = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim()
    await sendEmail(
      destination,
      `Travaux reçus — ${candidate.candidateNumber} — ${kind === 'video' ? 'vidéo' : 'document PDF'}`,
      emailLayout(
        'Nouveau dépôt de travaux',
        `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(candidate.candidateNumber)}) a déposé ${kind === 'video' ? 'sa <strong>vidéo</strong>' : 'son <strong>document PDF</strong>'} (${formatBytes(file.size)}).</p>
         <p>Statut des travaux : <strong>${hasVideo && hasPdf ? 'Travaux reçus (vidéo + PDF)' : 'Incomplets — il manque encore un fichier'}</strong></p>
         ${origin ? `<p><a href="${origin}/admin/collections/candidatures/${candidateId}" style="color:#4736b6;font-weight:700">Ouvrir la fiche du candidat</a></p>` : ''}`,
      ),
    )
  }
  return candidate
}
