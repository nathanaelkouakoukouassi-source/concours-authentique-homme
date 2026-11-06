import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { SiteFrame } from '../contest-site'
import { LoginForm, LogoutButton } from './forms'
import { WorksUpload } from './works-upload'
import { type CandidateWithWorks, worksUploadIsOpen } from '@/lib/server/works'
import { type CandidatureDoc, getSettings, payloadClient } from '@/lib/server/contest'
import { computePreselectionRanking } from '@/lib/server/results'
import { CANDIDATE_COOKIE, readCandidateSession } from '@/lib/server/security'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Espace candidat | Concours Authentique Homme',
  robots: { index: false, follow: false },
}

async function loadSession() {
  const cookieStore = await cookies()
  const candidateId = readCandidateSession(cookieStore.get(CANDIDATE_COOKIE)?.value)
  if (!candidateId) return null
  const payload = await payloadClient()
  try {
    const candidate = (await payload.findByID({
      collection: 'candidatures',
      id: candidateId,
      depth: 0,
      overrideAccess: true,
    })) as unknown as CandidateWithWorks
    if (candidate.status !== 'preselectionne') return null
    const settings = await getSettings(payload)
    let isFinalist = false
    if (settings.finalistsPublished) {
      const ranking = await computePreselectionRanking(payload)
      isFinalist = ranking.slice(0, 3).some((row) => row.id === String(candidate.id))
    }
    return { candidate, settings, isFinalist }
  } catch {
    return null
  }
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line py-3 last:border-b-0 sm:flex-row sm:justify-between">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-semibold text-ink">{value || 'Communiqué prochainement'}</span>
    </div>
  )
}

export default async function CandidateSpacePage() {
  const session = await loadSession()

  if (!session) {
    return (
      <SiteFrame>
        <main className="px-5 py-14 sm:py-20">
          <section className="liquid-card mx-auto max-w-lg rounded-[2rem] border border-line p-7 sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold-dark">
              Espace candidat
            </p>
            <h1 className="mt-3 font-serif text-4xl font-semibold text-wine">
              Accédez à votre dossier
            </h1>
            <p className="mt-4 leading-7 text-muted">
              Réservé aux dix candidats présélectionnés. Saisissez votre numéro de candidature et
              le code d’accès affichés à la fin de votre inscription.
            </p>
            <LoginForm />
          </section>
        </main>
      </SiteFrame>
    )
  }

  const { candidate, settings, isFinalist } = session
  const dossierReady = Boolean(settings.dossierPathname) && settings.dossierEnabled !== false

  return (
    <SiteFrame>
      <main>
        <section className="brand-hero px-5 py-12 text-white sm:px-6 sm:py-16">
          <div className="mx-auto max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-gold-light">
              Espace candidat · {candidate.candidateNumber}
            </p>
            <h1 className="mt-4 font-serif text-4xl font-semibold uppercase leading-tight sm:text-5xl">
              {isFinalist
                ? 'Finaliste — Qualifié pour la grande finale'
                : 'Félicitations ! Vous êtes présélectionné(e).'}
            </h1>
            <p className="mt-5 max-w-2xl leading-7 text-white/80">
              {isFinalist
                ? 'Félicitations ! Vous êtes qualifié(e) pour la grande finale du concours AUTHENTIQUE HOMME.'
                : 'Votre candidature a été retenue parmi les dix candidats sélectionnés pour participer au concours AUTHENTIQUE HOMME.'}
            </p>
            <div className="mt-6">
              <LogoutButton />
            </div>
          </div>
        </section>

        <section className="px-5 py-10 sm:px-6 sm:py-14">
          <div className="mx-auto grid max-w-4xl gap-6">
            {isFinalist && settings.finalTopic && (
              <article className="rounded-[2rem] bg-gold p-7 text-wine-dark sm:p-9">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em]">
                  Sujet de la grande finale
                </p>
                <p className="mt-3 whitespace-pre-line font-serif text-2xl font-semibold leading-snug">
                  {settings.finalTopic}
                </p>
              </article>
            )}

            <article className="liquid-card rounded-[2rem] border border-line p-6 sm:p-9">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-dark">
                Mon dossier de participation
              </p>
              <h2 className="mt-3 font-serif text-3xl font-semibold text-wine">
                Règlement, sujet, consignes et modalités
              </h2>
              <p className="mt-3 leading-7 text-muted">
                Le dossier officiel contient le règlement, le sujet de réflexion, les consignes de
                réalisation et les modalités de soumission.
              </p>
              {dossierReady ? (
                <a
                  href="/api/concours/espace/dossier"
                  className="mt-6 inline-flex min-h-14 items-center rounded-full bg-wine px-7 py-4 text-sm font-extrabold uppercase tracking-wider text-white transition hover:bg-wine-dark"
                >
                  Télécharger le dossier PDF
                </a>
              ) : (
                <p className="mt-6 rounded-2xl bg-cream p-4 text-sm font-semibold text-wine">
                  Le dossier sera disponible ici très prochainement.
                </p>
              )}
            </article>

            {settings.instructions && (
              <article className="liquid-card rounded-[2rem] border border-line p-6 sm:p-9">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-dark">
                  Consignes du comité
                </p>
                <p className="mt-4 whitespace-pre-line leading-7 text-ink">{settings.instructions}</p>
              </article>
            )}

            <article className="liquid-card rounded-[2rem] border border-line p-6 sm:p-9">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-gold-dark">
                Mes informations
              </p>
              <InfoRow label="Numéro de candidature" value={candidate.candidateNumber} />
              <InfoRow
                label="Statut"
                value={isFinalist ? 'Finaliste' : 'Présélectionné(e)'}
              />
              <InfoRow label="Date limite de soumission" value={settings.submissionDeadline} />
              <InfoRow label="WhatsApp officiel du concours" value={settings.whatsappNumber} />
            </article>

            <article id="travaux" className="rounded-[2rem] border border-gold/40 bg-gold-soft p-6 sm:p-9">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-gold-dark">
                Déposer mes travaux
              </p>
              <h2 className="mt-3 font-serif text-3xl font-semibold text-wine">
                Votre vidéo et votre document écrit
              </h2>
              <p className="mt-3 leading-7 text-muted">
                Déposez vos deux fichiers directement ici : ils sont transmis au comité de façon
                privée. Vous pouvez remplacer un fichier jusqu’à la date limite
                {settings.submissionDeadline ? ` (${settings.submissionDeadline})` : ''}. Restez sur
                cette page pendant l’envoi, de préférence en Wi-Fi.
              </p>
              <WorksUpload
                candidateNumber={candidate.candidateNumber}
                open={worksUploadIsOpen(settings as never)}
                video={{
                  size: candidate.videoSize,
                  uploadedAt: candidate.videoUploadedAt,
                  filename: candidate.videoFilename,
                }}
                pdf={{
                  size: candidate.pdfSize,
                  uploadedAt: candidate.pdfUploadedAt,
                  filename: candidate.pdfFilename,
                }}
              />
              {settings.whatsappNumber && (
                <p className="mt-5 text-xs leading-5 text-muted">
                  Un problème pour envoyer ? Contactez le comité sur WhatsApp au{' '}
                  <strong className="text-ink">{settings.whatsappNumber}</strong> en indiquant votre
                  numéro de candidature.
                </p>
              )}
            </article>
          </div>
        </section>
      </main>
    </SiteFrame>
  )
}
