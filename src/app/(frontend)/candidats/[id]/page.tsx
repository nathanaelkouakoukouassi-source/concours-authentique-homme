import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteFrame } from '../../contest-site'
import { VoteBox } from './vote-box'
import {
  type CandidatureDoc,
  getSettings,
  payloadClient,
  publicCandidate,
  voteState,
} from '@/lib/server/contest'

export const dynamic = 'force-dynamic'

async function loadCandidate(id: string) {
  const payload = await payloadClient()
  const settings = await getSettings(payload)
  if (!settings.preselectionPublished) return null
  try {
    const doc = (await payload.findByID({
      collection: 'candidatures',
      id,
      depth: 0,
      overrideAccess: true,
    })) as unknown as CandidatureDoc
    if (doc.status !== 'preselectionne' || !doc.published) return null
    return { candidate: publicCandidate(doc), state: voteState(settings) }
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const loaded = await loadCandidate(id)
  if (!loaded) return { title: 'Candidat | Concours Authentique Homme' }
  return {
    title: `${loaded.candidate.fullName} | Concours Authentique Homme`,
    description: loaded.candidate.reflectionTitle || 'Découvrez sa réflexion et votez.',
  }
}

function videoEmbed(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtu.be')) {
      return `https://www.youtube-nocookie.com/embed/${parsed.pathname.slice(1)}`
    }
    if (parsed.hostname.includes('youtube.com')) {
      const id = parsed.searchParams.get('v') || parsed.pathname.split('/').pop()
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
    }
    if (parsed.hostname.includes('vimeo.com')) {
      const id = parsed.pathname.split('/').filter(Boolean).pop()
      return id ? `https://player.vimeo.com/video/${id}` : null
    }
  } catch {
    return null
  }
  return null
}

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const loaded = await loadCandidate(id)
  if (!loaded) notFound()
  const { candidate, state } = loaded
  const embed = candidate.worksPublished && candidate.videoUrl ? videoEmbed(candidate.videoUrl) : null
  const references = candidate.biblicalReferences
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return (
    <SiteFrame>
      <main>
        <section className="brand-hero px-5 py-12 text-white sm:px-6 sm:py-16">
          <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-[18rem_1fr]">
            <div className="liquid-glass mx-auto w-full max-w-xs overflow-hidden rounded-[2rem] border border-white/20 p-2">
              {candidate.hasPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/concours/photo/${candidate.id}`}
                  alt={`Photo de ${candidate.fullName}`}
                  className="aspect-[4/5] w-full rounded-[1.6rem] object-cover"
                />
              ) : (
                <div className="grid aspect-[4/5] place-items-center rounded-[1.6rem] bg-white/10 font-serif text-7xl">
                  {candidate.fullName.slice(0, 1)}
                </div>
              )}
            </div>
            <div>
              <Link href="/#candidats" className="text-sm font-bold text-gold-light">
                ← Tous les candidats
              </Link>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-gold-light">
                Candidat Authentique Homme
              </p>
              <h1 className="mt-3 font-serif text-5xl font-semibold leading-tight sm:text-6xl">
                {candidate.fullName}
              </h1>
              <p className="mt-4 text-lg text-white/85">{candidate.churchName}</p>
              <p className="text-white/65">{candidate.churchRole}</p>
              {candidate.educationLevel && (
                <p className="mt-1 text-sm text-white/55">Niveau d’études : {candidate.educationLevel}</p>
              )}
            </div>
          </div>
        </section>

        <section className="px-5 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-[1fr_22rem]">
            <div className="grid gap-6">
              {candidate.worksPublished ? (
                <>
                  <article className="liquid-card rounded-[2rem] border border-line p-6 sm:p-9">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-dark">
                      Sa réflexion
                    </p>
                    <h2 className="mt-3 font-serif text-4xl font-semibold text-wine">
                      {candidate.reflectionTitle || 'Réflexion'}
                    </h2>
                    {candidate.reflectionSummary && (
                      <p className="mt-5 whitespace-pre-line text-base leading-8 text-muted sm:text-lg">
                        {candidate.reflectionSummary}
                      </p>
                    )}
                    {references.length > 0 && (
                      <div className="mt-6 flex flex-wrap gap-2">
                        {references.map((reference) => (
                          <span
                            key={reference}
                            className="rounded-full border border-gold/40 bg-gold-soft px-3 py-1.5 text-sm font-semibold text-wine"
                          >
                            {reference}
                          </span>
                        ))}
                      </div>
                    )}
                    {candidate.fullText && (
                      <details className="group mt-8 rounded-2xl border border-line bg-white p-5">
                        <summary className="cursor-pointer list-none text-center text-sm font-extrabold uppercase tracking-wider text-wine">
                          <span className="group-open:hidden">Lire l’intégralité du travail</span>
                          <span className="hidden group-open:inline">Replier le texte</span>
                        </summary>
                        <div className="mt-6 whitespace-pre-line text-base leading-8 text-ink">
                          {candidate.fullText}
                        </div>
                      </details>
                    )}
                  </article>
                  {embed && (
                    <article className="overflow-hidden rounded-[2rem] border border-line bg-black">
                      <iframe
                        src={embed}
                        title={`Vidéo de ${candidate.fullName}`}
                        className="aspect-video w-full"
                        loading="lazy"
                        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowFullScreen
                      />
                    </article>
                  )}
                </>
              ) : (
                <article className="liquid-card rounded-[2rem] border border-line p-8 text-center">
                  <p className="font-serif text-2xl font-semibold text-wine">Travaux bientôt en ligne</p>
                  <p className="mt-3 text-muted">
                    La vidéo et le texte de ce candidat seront publiés après validation du comité.
                  </p>
                </article>
              )}
            </div>
            <aside className="lg:sticky lg:top-28">
              <VoteBox candidateId={candidate.id} candidateName={candidate.fullName} state={state} />
            </aside>
          </div>
        </section>
      </main>
    </SiteFrame>
  )
}
