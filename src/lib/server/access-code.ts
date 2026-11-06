import type { Payload } from 'payload'
import type { CandidatureDoc } from './contest'
import { codeBlock, emailConfigured, emailLayout, escapeHtml, sendEmail } from './email'
import { hashCode, randomCode } from './security'

export function siteOrigin(fallback?: string) {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  return fallback || ''
}

/**
 * Génère un nouveau code d’accès, l’envoie par e-mail au candidat présélectionné
 * et enregistre son empreinte. Renvoie un message d’erreur, ou null si tout va bien.
 */
export async function sendAccessCode(
  payload: Payload,
  candidate: CandidatureDoc,
  options: { origin?: string; submissionDeadline?: string | null; regenerate?: boolean } = {},
): Promise<string | null> {
  // Le candidat a déjà reçu son code à l’inscription : on le prévient sans le changer.
  const keepCode = Boolean(candidate.accessCodeHash) && !options.regenerate
  if (!emailConfigured()) {
    return 'envoi d’e-mails non configuré (GMAIL_USER et GMAIL_APP_PASSWORD manquants dans Vercel)'
  }
  if (!candidate.email) return 'pas d’adresse e-mail'

  const code = keepCode ? '' : randomCode(8)
  const origin = siteOrigin(options.origin)
  const link = `${origin}/espace-candidat`
  const ok = await sendEmail(
    candidate.email,
    'Félicitations ! Vous êtes présélectionné(e) au concours AUTHENTIQUE HOMME',
    emailLayout(
      'Félicitations ! Vous êtes présélectionné(e).',
      `<p>Bonjour ${escapeHtml(candidate.firstName || '')},</p>
       <p>Votre candidature a été retenue parmi les candidats sélectionnés pour participer au concours <strong>AUTHENTIQUE HOMME</strong>.</p>
       <p>Votre dossier de participation (règlement, sujet, consignes et modalités) est disponible dans votre espace candidat, où vous déposerez aussi vos travaux.</p>
       ${
         keepCode
           ? '<p style="margin:24px 0;padding:16px;border-radius:14px;background:#fff0df;text-align:center">Connectez-vous avec votre numéro de candidature et le <strong>code d’accès qui vous a été remis à la fin de votre inscription</strong>.<br/>Code perdu ? Répondez à cet e-mail : le comité vous en communiquera un nouveau.</p>'
           : codeBlock('Votre code d’accès personnel', code)
       }
       <p>Numéro de candidature : <strong>${escapeHtml(candidate.candidateNumber)}</strong></p>
       <p style="text-align:center;margin:28px 0"><a href="${link}" style="display:inline-block;background:#4736b6;color:white;padding:14px 26px;border-radius:999px;text-decoration:none;font-weight:700">Accéder à mon espace candidat</a></p>
       <p>Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur : ${escapeHtml(link)}</p>
       ${options.submissionDeadline ? `<p>Date limite de soumission des travaux : <strong>${escapeHtml(options.submissionDeadline)}</strong></p>` : ''}
       <p>Gardez ce code confidentiel : il donne accès à votre dossier.</p>
       <p style="margin-top:24px">Le comité d’organisation<br/>Ministère Porteur d’Amour</p>`,
    ),
    process.env.MINISTRY_DESTINATION_EMAIL || process.env.GMAIL_USER,
  )
  if (!ok) return 'l’envoi de l’e-mail a échoué (vérifiez le mot de passe d’application Gmail)'

  await payload.update({
    collection: 'candidatures',
    id: candidate.id,
    data: {
      ...(keepCode ? {} : { accessCodeHash: hashCode(code) }),
      codeSentAt: new Date().toISOString(),
      codeError: '',
    },
    overrideAccess: true,
    context: { skipAccessCode: true },
  })
  return null
}
