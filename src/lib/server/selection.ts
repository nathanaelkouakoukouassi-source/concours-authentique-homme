import type { Payload } from 'payload'
import { scoreCandidature } from './ai-scoring'
import { type CandidatureDoc, type Settings } from './contest'
import { codeBlock, emailConfigured, emailLayout, escapeHtml, sendEmail } from './email'
import { hashCode, randomCode } from './security'

type SelectionSettings = Settings & {
  registrationClosesAt?: string | null
  autoSelectionEnabled?: boolean
  preselectionSize?: number
  autoPublishList?: boolean
  autoNotify?: boolean
  selectionStatus?: 'en-attente' | 'en-cours' | 'terminee' | 'erreur'
  selectionRunAt?: string | null
}

type Candidate = CandidatureDoc & {
  createdAt?: string
  quizScore?: number
  aiScore?: number
  aiScoredAt?: string
  selectionScore?: number
}

const STALE_LOCK_MS = 10 * 60 * 1000

/** Les inscriptions sont-elles encore ouvertes (case cochée et date non dépassée) ? */
export function registrationsAreOpen(settings: SelectionSettings, now = new Date()) {
  if (settings.registrationsOpen === false) return false
  if (settings.registrationClosesAt && now >= new Date(settings.registrationClosesAt)) return false
  return true
}

/** La sélection automatique doit-elle se lancer maintenant ? */
export function selectionIsDue(settings: SelectionSettings, now = new Date()) {
  if (settings.autoSelectionEnabled === false) return false
  if (!settings.registrationClosesAt || now < new Date(settings.registrationClosesAt)) return false
  if (settings.selectionStatus === 'terminee') return false
  if (
    settings.selectionStatus === 'en-cours' &&
    settings.selectionRunAt &&
    now.getTime() - new Date(settings.selectionRunAt).getTime() < STALE_LOCK_MS
  ) {
    return false
  }
  return true
}

async function saveSettings(payload: Payload, data: Record<string, unknown>) {
  await payload.updateGlobal({ slug: 'reglages-concours', data, overrideAccess: true })
}

/**
 * Sélection automatique (choix du comité : entièrement automatique) :
 * 1. ferme les inscriptions ;
 * 2. fait noter par l’IA les réflexions qui ne l’ont pas encore été ;
 * 3. classe les candidatures « Conforme » par note de sélection (QCM /50 + réflexion /50),
 *    à égalité la meilleure réflexion puis l’inscription la plus ancienne ;
 * 4. passe les N premières en « Présélectionné » (fiche publique) ;
 * 5. publie la liste et envoie à chacune son code d’accès, si ces options sont cochées.
 * `force` permet au comité de la lancer avant la date de clôture.
 */
export async function runSelection(
  payload: Payload,
  options: { force?: boolean; origin?: string } = {},
) {
  const settings = (await payload.findGlobal({
    slug: 'reglages-concours',
    depth: 0,
    overrideAccess: true,
  })) as SelectionSettings

  if (!options.force && !selectionIsDue(settings)) {
    return { ok: false, message: 'La sélection n’est pas due.' }
  }
  if (settings.selectionStatus === 'terminee' && !options.force) {
    return { ok: false, message: 'La sélection a déjà été faite.' }
  }

  const log: string[] = [`Lancement : ${new Date().toISOString()}`]
  await saveSettings(payload, {
    selectionStatus: 'en-cours',
    selectionRunAt: new Date().toISOString(),
    registrationsOpen: false,
  })

  try {
    const eligible = (
      await payload.find({
        collection: 'candidatures',
        where: { status: { equals: 'conforme' } },
        limit: 5000,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      })
    ).docs as unknown as Candidate[]
    log.push(`Candidatures conformes : ${eligible.length}`)

    const unscored = eligible.filter((candidate) => !candidate.aiScoredAt)
    let failures = 0
    for (const candidate of unscored) {
      const ok = await scoreCandidature(payload, String(candidate.id))
      if (!ok) failures += 1
    }
    if (failures) {
      throw new Error(
        `${failures} réflexion(s) n’ont pas pu être notées par l’IA (vérifiez ANTHROPIC_API_KEY et le crédit du compte). Relancez la sélection ensuite.`,
      )
    }

    const scored = (
      await payload.find({
        collection: 'candidatures',
        where: { status: { equals: 'conforme' } },
        limit: 5000,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      })
    ).docs as unknown as Candidate[]

    scored.sort(
      (a, b) =>
        Number(b.selectionScore || 0) - Number(a.selectionScore || 0) ||
        Number(b.aiScore || 0) - Number(a.aiScore || 0) ||
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
    )

    const size = Math.max(1, Number(settings.preselectionSize || 10))
    for (const [index, candidate] of scored.entries()) {
      const selected = index < size
      await payload.update({
        collection: 'candidatures',
        id: candidate.id,
        data: {
          selectionRank: index + 1,
          ...(selected ? { status: 'preselectionne', published: true } : {}),
        },
        overrideAccess: true,
      })
    }
    const selected = scored.slice(0, size)
    log.push(
      `Présélectionnés (${selected.length}) : ${selected
        .map((c) => `${c.candidateNumber} (${c.selectionScore}/100)`)
        .join(', ')}`,
    )

    if (settings.autoPublishList !== false) {
      await saveSettings(payload, { preselectionPublished: true })
      log.push('Liste publiée sur le site.')
    }

    if (settings.autoNotify !== false) {
      if (!emailConfigured()) {
        log.push('Codes NON envoyés : l’envoi d’e-mails n’est pas configuré. Utilisez ensuite « Notifier les présélectionnés ».')
      } else {
        let sent = 0
        for (const candidate of selected) {
          if (!candidate.email) continue
          const code = randomCode(8)
          const link = options.origin ? `${options.origin}/espace-candidat` : '/espace-candidat'
          const ok = await sendEmail(
            candidate.email,
            'Félicitations ! Vous êtes présélectionné(e) au concours AUTHENTIQUE HOMME',
            emailLayout(
              'Félicitations ! Vous êtes présélectionné(e).',
              `<p>Bonjour ${escapeHtml(candidate.firstName || '')},</p>
               <p>Votre candidature a été retenue parmi les candidats sélectionnés pour participer au concours <strong>AUTHENTIQUE HOMME</strong>.</p>
               <p>Votre dossier de participation est disponible dans votre espace candidat, directement sur le site.</p>
               ${codeBlock('Votre code d’accès personnel', code)}
               <p>Numéro de candidature : <strong>${escapeHtml(candidate.candidateNumber)}</strong></p>
               <p style="text-align:center;margin:28px 0"><a href="${link}" style="display:inline-block;background:#4736b6;color:white;padding:14px 26px;border-radius:999px;text-decoration:none;font-weight:700">Accéder à mon espace candidat</a></p>
               <p>Gardez ce code confidentiel.</p>
               <p style="margin-top:24px">Le comité d’organisation<br/>Ministère Porteur d’Amour</p>`,
            ),
            process.env.MINISTRY_DESTINATION_EMAIL || process.env.GMAIL_USER,
          )
          if (ok) {
            sent += 1
            await payload.update({
              collection: 'candidatures',
              id: candidate.id,
              data: { accessCodeHash: hashCode(code), codeSentAt: new Date().toISOString() },
              overrideAccess: true,
            })
          }
        }
        log.push(`Codes d’accès envoyés : ${sent}/${selected.length}`)
      }
    }

    log.push(`Terminé : ${new Date().toISOString()}`)
    await saveSettings(payload, {
      selectionStatus: 'terminee',
      selectionRunAt: new Date().toISOString(),
      selectionLog: log.join('\n'),
    })
    return { ok: true, message: log.join('\n') }
  } catch (error) {
    log.push(`ERREUR : ${error instanceof Error ? error.message : String(error)}`)
    await saveSettings(payload, {
      selectionStatus: 'erreur',
      selectionRunAt: new Date().toISOString(),
      selectionLog: log.join('\n'),
    })
    return { ok: false, message: log.join('\n') }
  }
}
