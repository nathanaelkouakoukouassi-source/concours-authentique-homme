'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'
import {
  CHURCH_ROLES,
  COMMITMENTS,
  EDUCATION_LEVELS,
  EMAIL_PATTERN,
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  REQUIRED_BY_STEP,
  SITUATIONS,
  isValidPhone,
} from '@/lib/candidature-schema'
import { REFLECTION_MAX_WORDS, REFLECTION_MIN_WORDS, countWords } from '@/lib/quiz-rules'

/* ------------------------------------------------------------------ */
/* Paramètres du concours — à compléter par le comité (cahier §23)     */
/* ------------------------------------------------------------------ */
const MINISTRY_URL = process.env.NEXT_PUBLIC_MINISTRY_URL || ''

/* Données fournies par le serveur (réglages du back-office, candidats et résultats publiés). */
export type PublicCard = {
  id: string
  fullName: string
  churchName: string
  churchRole: string
  hasPhoto: boolean
}

export type ResultRow = PublicCard & {
  rank: number
  votePercent: number
  juryScore: number | null
  finalScore: number
}

export type ContestData = {
  cfg: {
    registrationsOpen: boolean
    registrationDeadline: string | null
    registrationClosesAt?: string | null
    minimumAge: string | null
  }
  voteState: 'a-venir' | 'ouvert' | 'clos' | 'validation' | 'publies'
  candidates: PublicCard[]
  results: ResultRow[] | null
  showJuryScore: boolean
  finalists: PublicCard[] | null
  laureates: (PublicCard & { rank: number })[] | null
  quiz: Array<{ question: string; options: string[] }>
  reflectionPrompt: string
}

const defaultData: ContestData = {
  cfg: { registrationsOpen: true, registrationDeadline: null, minimumAge: null },
  voteState: 'a-venir',
  candidates: [],
  results: null,
  showJuryScore: true,
  finalists: null,
  laureates: null,
  quiz: [],
  reflectionPrompt: '',
}

const ContestDataContext = createContext<ContestData>(defaultData)
const useContestData = () => useContext(ContestDataContext)

const VOTE_LABELS: Record<ContestData['voteState'], string> = {
  'a-venir': 'Le vote du public n’est pas encore ouvert.',
  ouvert: 'Le vote du public est ouvert : choisissez votre candidat !',
  clos: 'La période de vote est terminée. Merci pour votre participation.',
  validation: 'Le vote est clos : résultats en cours de validation par le comité.',
  publies: 'Les résultats sont publiés.',
}

type Phase = 'inscriptions' | 'selection' | 'liste' | 'vote' | 'deliberation' | 'finalistes' | 'laureats'

const PHASES: Array<{ key: Phase; label: string }> = [
  { key: 'inscriptions', label: 'Inscriptions et QCM' },
  { key: 'liste', label: 'Les 10 présélectionnés' },
  { key: 'vote', label: 'Vote du public' },
  { key: 'deliberation', label: 'Calcul jury + public' },
  { key: 'finalistes', label: 'Les 3 finalistes' },
  { key: 'laureats', label: 'Grande finale' },
]

/** Étape du concours déduite de ce que le comité a publié. */
function currentPhase(data: ContestData): Phase {
  if (data.laureates?.length) return 'laureats'
  if (data.finalists?.length) return 'finalistes'
  if (!data.candidates.length) return data.cfg.registrationsOpen ? 'inscriptions' : 'selection'
  if (data.voteState === 'ouvert') return 'vote'
  if (data.voteState === 'a-venir') return 'liste'
  return 'deliberation'
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Abidjan',
    })
  } catch {
    return null
  }
}

function PhaseStrip() {
  const data = useContestData()
  const phase = currentPhase(data)
  const activeIndex = PHASES.findIndex((item) => item.key === (phase === 'selection' ? 'inscriptions' : phase))
  const closes = formatDate(data.cfg.registrationClosesAt)
  const messages: Record<Phase, string> = {
    inscriptions: closes
      ? `Les inscriptions sont ouvertes jusqu’au ${closes}.`
      : 'Les inscriptions sont ouvertes.',
    selection: 'Les inscriptions sont closes : classement de l’épreuve en cours.',
    liste: 'Les 10 présélectionnés sont connus. Le vote du public ouvrira prochainement.',
    vote: 'Le vote du public est ouvert : découvrez les candidats et votez !',
    deliberation: 'Le vote est clos : calcul des résultats (jury 80 % + public 20 %).',
    finalistes: 'Les 3 finalistes sont annoncés. Rendez-vous à la grande finale !',
    laureats: 'Les lauréats sont proclamés. Merci à tous !',
  }
  return (
    <section className="border-b border-line bg-cream px-5 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <p className="text-center text-sm font-bold text-wine sm:text-base">
          <span className="mr-2 text-xs font-extrabold uppercase tracking-[0.2em] text-gold-dark">
            En ce moment
          </span>
          {messages[phase]}
        </p>
        <ol className="mx-auto mt-4 grid max-w-5xl grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Étapes du concours">
          {PHASES.map((item, index) => (
            <li
              key={item.key}
              aria-current={index === activeIndex ? 'step' : undefined}
              className={`rounded-xl px-2 py-2 text-center text-[0.7rem] font-bold leading-tight sm:text-xs ${index === activeIndex ? 'bg-wine text-white' : index < activeIndex ? 'bg-white text-wine' : 'bg-white/60 text-muted/70'}`}
            >
              <span className="block text-[0.65rem] opacity-70">{index + 1}</span>
              {item.label}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function CandidatePhoto({ card, className }: { card: PublicCard; className?: string }) {
  if (!card.hasPhoto) {
    return (
      <div className={`grid place-items-center bg-wine/10 font-serif text-4xl text-wine ${className || ''}`}>
        {card.fullName.slice(0, 1)}
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/concours/photo/${card.id}`}
      alt={`Photo de ${card.fullName}`}
      loading="lazy"
      className={`object-cover ${className || ''}`}
    />
  )
}

type View = 'home' | 'form'
type SubmitState = 'idle' | 'sending' | 'success' | 'error'

const STEPS = [
  { title: 'Identité', short: 'Identité' },
  { title: 'Informations religieuses', short: 'Foi' },
  { title: 'Parcours académique et professionnel', short: 'Parcours' },
  { title: 'Épreuve de sélection', short: 'Épreuve' },
  { title: 'Engagements et validation', short: 'Validation' },
]

const pillars = [
  {
    word: 'Comprendre',
    text: 'Saisir les combats réels de l’homme d’aujourd’hui : l’échec, la honte, la pression sociale, familiale et émotionnelle.',
  },
  {
    word: 'Démontrer',
    text: 'Interpréter les Écritures avec rigueur et argumenter, textes à l’appui, la pertinence d’une réponse biblique.',
  },
  {
    word: 'Restaurer',
    text: 'Proposer des solutions concrètes, applicables dans la vie de l’homme, de sa famille et de la société.',
  },
]

const journey = [
  ['Inscription', 'Candidature en ligne avec un QCM biblique et une courte réflexion.'],
  ['Présélection', 'Les dix meilleures candidatures conformes sont retenues automatiquement.'],
  ['Travaux', 'Préparation d’une vidéo et d’un document écrit sur le sujet imposé.'],
  ['Vote & jury', 'Le public vote en ligne, le jury évalue chaque réflexion.'],
  ['Finalistes', 'Annonce des trois meilleurs scores pondérés.'],
  ['Grande finale', 'Un nouveau sujet, défendu en présentiel devant jury et public.'],
  ['Lauréats', 'Proclamation des trois lauréats et remise des prix.'],
]

const criteria = [
  ['Compréhension de la problématique', 15],
  ['Maîtrise et interprétation des textes bibliques', 25],
  ['Pertinence des solutions bibliques proposées', 25],
  ['Démonstration concrète et applicabilité', 20],
  ['Argumentation et défense', 10],
  ['Originalité et qualité de présentation', 5],
] as const

const documentOutline = [
  'Titre de la réflexion',
  'Introduction',
  'Compréhension de la problématique',
  'Références bibliques',
  'Analyse des textes',
  'Interprétation des enseignements',
  'Solutions bibliques proposées',
  'Démonstration de leur application concrète',
  'Conclusion',
]

const prizes = [
  { rank: '1er prix', amount: '100 000', featured: true },
  { rank: '2e prix', amount: '50 000', featured: false },
  { rank: '3e prix', amount: '30 000', featured: false },
]

const rules = [
  {
    title: 'Qui peut participer ?',
    body: [
      'Le concours est réservé aux personnes se déclarant chrétiennes, qui renseignent le nom de leur église et fournissent des informations personnelles et des coordonnées exactes.',
      'Le niveau d’études, la situation professionnelle et la fonction dans l’église sont des informations de profil : ils ne constituent jamais un critère d’élimination.',
    ],
  },
  {
    title: 'Comment se déroule la présélection ?',
    body: [
      'Chaque candidature est vérifiée automatiquement (identité, photo, coordonnées, appartenance chrétienne, église, engagements). À la clôture des inscriptions, les candidatures conformes sont classées selon l’épreuve de sélection : un QCM biblique sur 50 points et une courte réflexion sur 50 points, notée par une intelligence artificielle selon un barème fixe. Les dix meilleures sont retenues automatiquement.',
      'Les dix candidats présélectionnés sont prévenus par e-mail et téléchargent leur dossier officiel directement sur le site, depuis leur espace candidat.',
    ],
  },
  {
    title: 'Comment transmettre ses travaux ?',
    body: [
      'Les candidats présélectionnés envoient leur vidéo et leur document PDF au numéro WhatsApp officiel du concours, communiqué dans leur espace candidat, avec la mention « AUTHENTIQUE HOMME — Soumission de travail », leurs nom et prénoms et leur numéro de candidature.',
      'Les travaux ne sont publiés sur le site qu’après validation du comité.',
    ],
  },
  {
    title: 'Comment fonctionne le vote du public ?',
    body: [
      'Le vote se fait en ligne, pendant la période officielle uniquement. Chaque votant confirme son numéro de téléphone par un code reçu par SMS : un seul vote par numéro vérifié.',
      'Le vote du public compte pour 20 % du score de présélection, l’évaluation du jury pour 80 %. En cas d’égalité, la note du jury départage les candidats.',
    ],
  },
  {
    title: 'Et la grande finale ?',
    body: [
      'Les trois finalistes reçoivent un nouveau sujet et défendent leur réflexion en présentiel pendant la conférence Authentique Homme des 3 Jours de Reconnaissance.',
      'Le classement final est déterminé par les seules évaluations du jury ; la note de la finale est distincte de celle de la présélection.',
    ],
  },
  {
    title: 'Mes données sont-elles protégées ?',
    body: [
      'Votre numéro de téléphone et votre adresse e-mail ne sont jamais publiés. Seuls votre photo, votre nom, votre église et votre fonction dans l’église peuvent apparaître si vous êtes présélectionné(e) ; votre niveau d’études uniquement si vous l’autorisez.',
      'Les informations servent exclusivement à la gestion du concours et ne sont accessibles qu’aux personnes autorisées du comité.',
    ],
  },
]

/* ------------------------------------------------------------------ */
/* Éléments communs                                                    */
/* ------------------------------------------------------------------ */

function MinistryLogo({ className = 'w-32 sm:w-48' }: { className?: string }) {
  return (
    <Image
      src="/brand/ministere-porteur-amour-logo.png"
      alt="Logo du Ministère Porteur d’Amour"
      width={721}
      height={209}
      sizes="200px"
      className={`h-auto object-contain ${className}`}
      priority
      unoptimized
    />
  )
}

function SectionIntro({
  eyebrow,
  title,
  children,
  light = false,
  center = false,
}: {
  eyebrow: string
  title: ReactNode
  children?: ReactNode
  light?: boolean
  center?: boolean
}) {
  return (
    <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-3xl'}>
      <p
        className={`text-xs font-bold uppercase tracking-[0.24em] ${light ? 'text-gold-light' : 'text-gold-dark'}`}
      >
        {eyebrow}
      </p>
      <h2
        className={`mt-3 font-serif text-4xl font-semibold leading-tight sm:text-5xl ${light ? 'text-white' : 'text-wine'}`}
      >
        {title}
      </h2>
      {children && (
        <div
          className={`mt-5 text-base leading-8 sm:text-lg ${light ? 'text-white/75' : 'text-muted'}`}
        >
          {children}
        </div>
      )}
    </div>
  )
}

function Header({ onApply }: { onApply: () => void }) {
  const { cfg } = useContestData()
  return (
    <header className="liquid-nav sticky top-0 z-50 border-b border-white/10 px-3 text-white sm:px-6">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3">
        <Link href="/" aria-label="Accueil du concours Authentique Homme">
          <MinistryLogo />
        </Link>
        <nav aria-label="Navigation principale" className="flex items-center gap-2">
          <a
            href="/#candidats"
            className="hidden rounded-full border border-white/25 px-5 py-2.5 text-sm font-bold transition hover:border-gold hover:bg-white/10 md:block"
          >
            Candidats
          </a>
          <Link
            href="/espace-candidat"
            className="rounded-full border border-white/25 px-3 py-2.5 text-sm font-bold transition hover:border-gold hover:bg-white/10 sm:px-5"
          >
            <span className="sm:hidden">Espace</span>
            <span className="hidden sm:inline">Espace candidat</span>
          </Link>
          {MINISTRY_URL && (
            <a
              href={MINISTRY_URL}
              className="hidden rounded-full border border-white/25 px-5 py-2.5 text-sm font-bold transition hover:border-gold hover:bg-white/10 lg:block"
            >
              Le Ministère
            </a>
          )}
          <button
            type="button"
            onClick={onApply}
            disabled={!cfg.registrationsOpen}
            className="rounded-full bg-gold px-4 py-2.5 text-sm font-extrabold text-wine-dark transition hover:bg-gold-light disabled:opacity-60 sm:px-5"
          >
            Devenir candidat
          </button>
        </nav>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="bg-wine-dark px-5 py-12 text-white">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <MinistryLogo className="w-48" />
          <p className="mt-4 font-serif text-2xl font-semibold">Authentique Homme</p>
          <p className="mt-1 text-xs uppercase tracking-widest text-gold-light">
            Comprendre • Démontrer • Restaurer
          </p>
        </div>
        <div className="grid gap-2 text-sm text-white/70 md:text-right">
          <p>Un concours du Ministère Porteur d’Amour</p>
          <p>3 Jours de Reconnaissance — 18, 19 et 20 décembre 2026</p>
          {MINISTRY_URL && (
            <a href={MINISTRY_URL} className="font-bold text-white underline decoration-white/20 underline-offset-4">
              Découvrir le Ministère Porteur d’Amour
            </a>
          )}
          <a
            href="mailto:ministereporteurdamour@gmail.com"
            className="break-all font-bold text-gold-light underline decoration-white/20 underline-offset-4"
          >
            ministereporteurdamour@gmail.com
          </a>
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-7xl border-t border-white/10 pt-6 text-xs text-white/45">
        © {new Date().getFullYear()} Ministère Porteur d’Amour. Tous droits réservés.
      </p>
    </footer>
  )
}

/* ------------------------------------------------------------------ */
/* Page de présentation                                                */
/* ------------------------------------------------------------------ */

const sectionLinks = [
  ['#concours', 'Le concours'],
  ['#sujet', 'Le sujet'],
  ['#etapes', 'Les étapes'],
  ['#travaux', 'Les travaux'],
  ['#evaluation', 'L’évaluation'],
  ['#recompenses', 'Récompenses'],
  ['#reglement', 'Règlement'],
  ['#candidats', 'Candidats'],
]

function ContestHome({ onApply }: { onApply: () => void }) {
  const { cfg, candidates, voteState, results, showJuryScore, finalists, laureates } =
    useContestData()
  return (
    <main>
      {/* Hero */}
      <section className="brand-hero relative isolate overflow-hidden px-5 py-14 text-white sm:py-20 lg:py-24">
        <div
          className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_12%_18%,rgba(251,178,87,0.4),transparent_26%),radial-gradient(circle_at_88%_80%,rgba(209,198,217,0.25),transparent_30%)]"
          aria-hidden="true"
        />
        <div
          className="absolute -left-32 bottom-0 size-80 rounded-full border border-gold/20"
          aria-hidden="true"
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-gold-light">
              Concours · 3 Jours de Reconnaissance 2026
            </p>
            <h1 className="mt-5 font-serif text-5xl font-semibold uppercase leading-[0.92] tracking-wide sm:text-7xl lg:text-8xl">
              Authentique
              <br />
              Homme
            </h1>
            <p className="mt-5 font-serif text-2xl italic text-gold-light sm:text-3xl">
              La Parole de Dieu face aux réalités de l’homme.
            </p>
            <div className="my-7 h-1 w-20 rounded-full bg-gold" />
            <p className="max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
              Une compétition qui invite la jeunesse à explorer les Écritures, comprendre les
              combats de l’homme et démontrer comment les vérités bibliques peuvent apporter des
              réponses concrètes aux réalités de notre société.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onApply}
                disabled={!cfg.registrationsOpen}
                className="min-h-14 rounded-full bg-gold px-7 py-4 text-sm font-extrabold uppercase tracking-wider text-wine-dark shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:bg-gold-light disabled:opacity-60"
              >
                {cfg.registrationsOpen ? 'Devenir candidat' : 'Inscriptions closes'}
              </button>
              <a
                href="#candidats"
                className="flex min-h-14 items-center justify-center rounded-full border border-white/30 px-7 py-4 text-sm font-extrabold uppercase tracking-wider transition hover:border-gold hover:bg-white/10"
              >
                Découvrir les candidats
              </a>
            </div>
            <p className="mt-6 text-sm text-white/60">
              Organisé par le Ministère Porteur d’Amour
              {cfg.registrationDeadline &&
                ` · Inscriptions jusqu’au ${cfg.registrationDeadline}`}
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div
              className="absolute -inset-4 -rotate-2 rounded-[2.5rem] border border-gold/45 bg-gold/10"
              aria-hidden="true"
            />
            <div className="liquid-glass relative overflow-hidden rounded-[2rem] border border-white/20 p-2">
              <div className="grid aspect-[4/3] place-items-center rounded-[1.6rem] bg-wine-dark p-8">
                <Image
                  src="/organs/authentique-homme.png"
                  alt="Logo Authentique Homme"
                  width={1095}
                  height={437}
                  sizes="(max-width: 1024px) 80vw, 30vw"
                  className="h-auto w-full object-contain"
                  priority
                  unoptimized
                />
              </div>
              <dl className="grid grid-cols-3 divide-x divide-white/15 px-2 py-5 text-center">
                {[
                  ['10', 'présélectionnés'],
                  ['3', 'finalistes'],
                  ['180K', 'FCFA de prix'],
                ].map(([value, label]) => (
                  <div key={label} className="px-1">
                    <dt className="sr-only">{label}</dt>
                    <dd className="font-serif text-3xl font-semibold text-gold-light">{value}</dd>
                    <dd className="mt-1 text-[0.7rem] uppercase tracking-wider text-white/65">
                      {label}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="absolute -bottom-5 right-4 rounded-2xl bg-gold px-5 py-3 text-xs font-extrabold uppercase tracking-[0.18em] text-wine-dark shadow-xl">
              Comprendre · Démontrer · Restaurer
            </div>
          </div>
        </div>
      </section>

      <PhaseStrip />

      {/* Sous-navigation */}
      <nav
        aria-label="Sections du concours"
        className="sticky top-20 z-40 border-b border-line bg-white/90 backdrop-blur"
      >
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] sm:px-6">
          {sectionLinks.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="shrink-0 rounded-full px-4 py-2 text-sm font-bold text-muted transition hover:bg-cream hover:text-wine"
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      {/* Le concours */}
      <section id="concours" className="scroll-mt-36 bg-white px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <SectionIntro eyebrow="Le principe" title="Ce n’est pas un concours de prédication.">
            <p>
              AUTHENTIQUE HOMME est une compétition de réflexion, d’analyse biblique et de
              démonstration de solutions concrètes. Les candidats montrent comment les
              enseignements de la Bible peuvent restaurer l’homme face aux pressions sociales,
              émotionnelles, familiales et personnelles.
            </p>
            <p className="mt-4">
              Un exercice de compréhension, d’interprétation, d’argumentation et de propositions
              applicables — porté par la conviction que la Parole de Dieu parle aux réalités
              d’aujourd’hui.
            </p>
          </SectionIntro>
          <div className="grid gap-4">
            {pillars.map((pillar, index) => (
              <article
                key={pillar.word}
                className="liquid-card flex gap-5 rounded-[1.75rem] border border-line p-6 sm:p-7"
              >
                <span className="font-serif text-4xl font-semibold text-gold/50">
                  0{index + 1}
                </span>
                <div>
                  <h3 className="font-serif text-3xl font-semibold text-wine">{pillar.word}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted">{pillar.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Le sujet */}
      <section id="sujet" className="brand-hero scroll-mt-36 px-5 py-16 text-white sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-gold-light">
            Sujet de la première phase
          </p>
          <h2 className="mt-4 font-serif text-4xl font-semibold uppercase leading-tight sm:text-6xl">
            L’homme face à l’échec et à la honte
          </h2>
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-gold/50 bg-white/10 px-5 py-2.5">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-gold-light">
              Texte biblique principal
            </span>
            <span className="font-serif text-xl font-semibold">Luc 15 : 11-32</span>
          </div>
          <figure className="liquid-glass mt-10 rounded-[2rem] border border-white/15 p-7 sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-light">
              Problématique
            </p>
            <blockquote className="mt-4 font-serif text-2xl font-semibold leading-snug sm:text-4xl">
              « Comment un homme qui a connu l’échec, la honte et la déchéance peut-il retrouver sa
              dignité, reconstruire son identité et reprendre sa place dans la société à la
              lumière de la Parole de Dieu ? »
            </blockquote>
          </figure>
        </div>
      </section>

      {/* Les étapes */}
      <section id="etapes" className="scroll-mt-36 bg-cream px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <SectionIntro eyebrow="Le parcours" title="Sept étapes, de l’inscription au sacre." />
          <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {journey.map(([title, text], index) => (
              <li
                key={title}
                className={`liquid-card relative overflow-hidden rounded-[1.5rem] border p-6 ${index === journey.length - 1 ? 'border-gold/60 sm:col-span-2 lg:col-span-1' : 'border-line'}`}
              >
                <span
                  className={`grid size-10 place-items-center rounded-full text-sm font-extrabold ${index === journey.length - 1 ? 'bg-gold text-wine-dark' : 'bg-wine text-white'}`}
                >
                  {index + 1}
                </span>
                <h3 className="mt-5 font-serif text-2xl font-semibold text-wine">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Les travaux */}
      <section id="travaux" className="scroll-mt-36 bg-white px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <SectionIntro eyebrow="Pour les dix présélectionnés" title="Deux productions à réaliser.">
            <p>
              Chaque candidat présélectionné prépare une vidéo et un document écrit, puis les
              transmet au numéro WhatsApp officiel du concours.
            </p>
          </SectionIntro>
          <div className="mt-11 grid gap-5 lg:grid-cols-2">
            <article className="rounded-[2rem] bg-wine p-7 text-white shadow-xl shadow-wine/15 sm:p-10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-light">
                Production A
              </p>
              <h3 className="mt-3 font-serif text-4xl font-semibold">Une vidéo de présentation</h3>
              <p className="mt-2 text-lg font-bold text-gold-light">5 minutes maximum</p>
              <ul className="mt-6 grid gap-3 text-sm leading-6 text-white/80">
                {[
                  'Une présentation claire et structurée',
                  'L’analyse de la problématique',
                  'Les fondements bibliques et leur interprétation',
                  'Des solutions concrètes et la démonstration de leur applicabilité',
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
            <article className="liquid-card rounded-[2rem] border border-line p-7 sm:p-10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-dark">
                Production B
              </p>
              <h3 className="mt-3 font-serif text-4xl font-semibold text-wine">
                Un document écrit
              </h3>
              <p className="mt-2 text-lg font-bold text-gold-dark">Format PDF</p>
              <ol className="mt-6 grid gap-2 text-sm leading-6 text-muted sm:grid-cols-2">
                {documentOutline.map((item, index) => (
                  <li key={item} className="flex gap-3">
                    <span className="w-5 shrink-0 font-extrabold text-wine">{index + 1}.</span>
                    {item}
                  </li>
                ))}
              </ol>
            </article>
          </div>
        </div>
      </section>

      {/* L'évaluation */}
      <section id="evaluation" className="scroll-mt-36 bg-cream px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div>
            <SectionIntro eyebrow="L’évaluation" title="Le jury d’abord, le public aussi.">
              <p>
                Le score de présélection combine l’évaluation du jury et le vote du public. Les
                trois meilleurs scores accèdent à la grande finale.
              </p>
            </SectionIntro>
            <div className="mt-9" aria-label="Pondération : 80 % jury, 20 % public">
              <div className="flex h-16 overflow-hidden rounded-2xl text-sm font-extrabold">
                <div className="flex w-4/5 items-center justify-between bg-wine px-5 text-white">
                  <span>Jury</span>
                  <span className="font-serif text-2xl">80 %</span>
                </div>
                <div className="flex w-1/5 items-center justify-center bg-gold text-wine-dark">
                  <span className="font-serif text-2xl">20 %</span>
                </div>
              </div>
              <p className="mt-2 text-right text-xs font-bold uppercase tracking-wider text-gold-dark">
                Vote du public
              </p>
            </div>
            <div className="mt-8 rounded-2xl border border-line bg-white p-5 text-sm leading-7 text-muted">
              <p className="font-bold text-wine">Exemple de calcul</p>
              <p className="mt-2">
                Note du jury 85/100, part du vote public 70 % :<br />
                (85 × 0,80) + (70 × 0,20) ={' '}
                <strong className="text-wine">82/100</strong>.
              </p>
              <p className="mt-2 text-xs">
                La part du vote public est le pourcentage des votes valides obtenus par le
                candidat. En cas d’égalité, la note du jury départage.
              </p>
            </div>
          </div>
          <div className="liquid-card rounded-[2rem] border border-line p-6 sm:p-9">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-dark">
              Grille du jury — 100 points
            </p>
            <ul className="mt-6 grid gap-5">
              {criteria.map(([label, points]) => (
                <li key={label}>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm font-semibold text-ink">{label}</span>
                    <span className="font-serif text-2xl font-semibold text-wine">{points}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-gold"
                      style={{ width: `${(points / 25) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Récompenses */}
      <section id="recompenses" className="scroll-mt-36 bg-white px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <SectionIntro eyebrow="Récompenses" title="180 000 FCFA à remporter." center>
            <p>Chaque prix est accompagné de nombreux lots offerts par nos partenaires.</p>
          </SectionIntro>
          <div className="mx-auto mt-11 grid max-w-5xl items-end gap-5 md:grid-cols-3">
            {prizes.map((prize) => (
              <article
                key={prize.rank}
                className={`rounded-[2rem] p-7 text-center sm:p-9 ${prize.featured ? 'bg-gold text-wine-dark shadow-xl shadow-gold/20 md:order-2 md:pb-14 md:pt-12' : 'liquid-card border border-line text-wine'} ${prize.rank === '2e prix' ? 'md:order-1' : ''} ${prize.rank === '3e prix' ? 'md:order-3' : ''}`}
              >
                <p className="text-xs font-extrabold uppercase tracking-[0.22em]">{prize.rank}</p>
                <p className="mt-4 font-serif text-5xl font-semibold sm:text-6xl">
                  {prize.amount}
                </p>
                <p className="mt-1 text-sm font-bold">FCFA</p>
                <p
                  className={`mt-5 text-sm leading-6 ${prize.featured ? 'text-wine-dark/75' : 'text-muted'}`}
                >
                  + lots offerts par les partenaires
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Règlement */}
      <section id="reglement" className="scroll-mt-36 bg-cream px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <SectionIntro eyebrow="Règlement" title="L’essentiel à savoir avant de candidater." />
            <div className="mt-8 rounded-2xl border border-gold/35 bg-gold-soft p-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-gold-dark">
                Conditions obligatoires
              </p>
              <ul className="mt-4 grid gap-2 text-sm leading-6 text-muted">
                {[
                  'Être chrétien(ne)',
                  'Renseigner le nom de son église',
                  'Fournir ses informations personnelles et ses coordonnées',
                  'Accepter le règlement',
                  'Certifier l’exactitude des informations',
                  ...(cfg.minimumAge
                    ? [`Avoir au moins ${cfg.minimumAge}`]
                    : []),
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="text-wine">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              {!cfg.registrationDeadline && (
                <p className="mt-5 text-xs leading-5 text-muted">
                  Le calendrier détaillé (clôture des inscriptions, vote, finale) sera communiqué
                  par le comité d’organisation.
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-3">
            {rules.map((rule) => (
              <details
                key={rule.title}
                className="group rounded-2xl border border-line bg-white p-5 open:border-gold/50 open:shadow-lg open:shadow-wine/5 sm:p-6"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-serif text-xl font-semibold text-wine sm:text-2xl">
                  {rule.title}
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-cream text-lg text-wine transition group-open:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <div className="mt-4 grid gap-3 text-sm leading-7 text-muted">
                  {rule.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Candidats */}
      <section id="candidats" className="scroll-mt-36 bg-white px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-7xl">
          {candidates.length > 0 ? (
            <SectionIntro eyebrow="Les présélectionnés" title="Découvrez les candidats Authentique Homme" center>
              <p>
                Dix candidats, une même ambition : démontrer comment la Parole de Dieu peut apporter
                des réponses concrètes aux réalités de l’homme.
                {voteState === 'ouvert'
                  ? ' Découvrez leurs réflexions et votez pour désigner, avec le jury, les trois finalistes.'
                  : ' Découvrez leurs profils et leurs réflexions.'}
              </p>
            </SectionIntro>
          ) : (
            <SectionIntro eyebrow="Les présélectionnés" title="Les 10 présélectionnés seront dévoilés ici" center>
              <p>
                {cfg.registrationsOpen
                  ? `À la clôture des inscriptions${formatDate(cfg.registrationClosesAt) ? `, le ${formatDate(cfg.registrationClosesAt)},` : ''} les dix meilleures candidatures à l’épreuve de sélection (QCM biblique et courte réflexion) seront publiées ici.`
                  : 'Les inscriptions sont closes : le classement de l’épreuve de sélection est en cours et la liste sera publiée ici très bientôt.'}
              </p>
            </SectionIntro>
          )}
          {candidates.length > 0 && (
            <p
              className={`mx-auto mt-8 max-w-xl rounded-full px-5 py-3 text-center text-sm font-bold ${voteState === 'ouvert' ? 'bg-gold text-wine-dark' : 'bg-cream text-wine'}`}
            >
              {voteState === 'a-venir'
                ? 'Le vote du public ouvrira prochainement.'
                : voteState === 'ouvert'
                  ? VOTE_LABELS.ouvert
                  : finalists?.length
                    ? 'Le vote est clos : les trois finalistes sont annoncés ci-dessous.'
                    : 'Le vote est clos : calcul des résultats (jury 80 % + public 20 %) en cours.'}
            </p>
          )}
          {candidates.length > 0 ? (
            <div className="mx-auto mt-10 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {candidates.map((card) => (
                <article
                  key={card.id}
                  className="liquid-card group flex flex-col overflow-hidden rounded-[1.75rem] border border-line transition hover:-translate-y-1 hover:border-gold/60"
                >
                  <CandidatePhoto card={card} className="aspect-[4/5] w-full" />
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-serif text-2xl font-semibold text-wine">{card.fullName}</h3>
                    <p className="mt-1 text-sm font-semibold text-ink">{card.churchName}</p>
                    <p className="text-sm text-muted">{card.churchRole}</p>
                    <Link
                      href={`/candidats/${card.id}`}
                      className="mt-5 rounded-full bg-wine px-4 py-3 text-center text-xs font-extrabold uppercase tracking-wider text-white transition hover:bg-wine-dark"
                    >
                      {voteState === 'ouvert' ? 'Découvrir et voter' : 'Découvrir sa réflexion'}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <>
              <div className="mx-auto mt-10 grid max-w-3xl grid-cols-5 gap-2 sm:gap-4">
                {Array.from({ length: 10 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex aspect-square flex-col items-center justify-center rounded-xl border border-dashed border-line bg-cream text-center sm:rounded-2xl"
                  >
                    <span className="font-serif text-xl font-semibold text-gold/60 sm:text-3xl">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="mt-1 hidden text-[0.65rem] font-bold uppercase tracking-wider text-muted/70 sm:block">
                      À dévoiler
                    </span>
                  </div>
                ))}
              </div>
              <p className="mx-auto mt-8 max-w-xl text-center text-sm leading-6 text-muted">
                Les candidats retenus reçoivent par e-mail un code pour accéder à leur{' '}
                <Link href="/espace-candidat" className="font-semibold text-wine underline decoration-gold underline-offset-4">
                  espace candidat
                </Link>
                {' '}et y télécharger leur dossier. Le vote du public s’ouvrira ensuite.
              </p>
            </>
          )}
        </div>
      </section>

      {laureates && laureates.length > 0 && (
        <section id="laureats" className="scroll-mt-36 bg-gold px-5 py-16 text-wine-dark sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.24em]">Grande finale</p>
            <h2 className="mt-3 font-serif text-4xl font-semibold sm:text-6xl">Les lauréats Authentique Homme</h2>
            <div className="mt-11 grid gap-5 md:grid-cols-3">
              {laureates.map((card) => (
                <article key={card.id} className="overflow-hidden rounded-[2rem] bg-white text-left shadow-xl shadow-wine/10">
                  <CandidatePhoto card={card} className="aspect-[4/3] w-full" />
                  <div className="p-6">
                    <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-gold-dark">
                      {card.rank === 1 ? '1er prix — 100 000 FCFA' : card.rank === 2 ? '2e prix — 50 000 FCFA' : '3e prix — 30 000 FCFA'}
                    </p>
                    <h3 className="mt-2 font-serif text-3xl font-semibold text-wine">{card.fullName}</h3>
                    <p className="mt-1 text-sm text-muted">{card.churchName}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {finalists && finalists.length > 0 && (
        <section id="finalistes" className="brand-hero scroll-mt-36 px-5 py-16 text-white sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-gold-light">Annonce officielle</p>
            <h2 className="mt-3 font-serif text-4xl font-semibold sm:text-6xl">Ils sont les trois finalistes !</h2>
            <div className="mt-11 grid gap-5 md:grid-cols-3">
              {finalists.map((card, index) => (
                <article key={card.id} className="liquid-glass overflow-hidden rounded-[2rem] border border-white/15 text-left">
                  <CandidatePhoto card={card} className="aspect-[4/3] w-full" />
                  <div className="p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-light">{index + 1}{index === 0 ? 'er' : 'e'} de la présélection</p>
                    <h3 className="mt-2 font-serif text-3xl font-semibold">{card.fullName}</h3>
                    <p className="mt-1 text-sm text-white/70">{card.churchName}</p>
                  </div>
                </article>
              ))}
            </div>
            <p className="mx-auto mt-8 max-w-2xl text-white/75">
              Rendez-vous à la grande finale, pendant la conférence Authentique Homme des 3 Jours de
              Reconnaissance.
            </p>
          </div>
        </section>
      )}

      {results && results.length > 0 && (
        <section id="resultats" className="scroll-mt-36 bg-cream px-5 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-5xl">
            <SectionIntro eyebrow="Résultats de la présélection" title="Le classement officiel." center>
              <p>
                Score final sur 100 = note du jury × 0,80 + part du vote public × 0,20. La part du
                vote public est le pourcentage des votes valides obtenus par le candidat : ce n’est
                pas son score final.
              </p>
            </SectionIntro>
            <div className="mt-10 overflow-hidden rounded-[1.75rem] border border-line bg-white">
              {results.map((row) => (
                <div
                  key={row.id}
                  className={`flex items-center gap-4 border-b border-line p-4 last:border-b-0 sm:p-5 ${row.rank <= 3 ? 'bg-gold-soft/60' : ''}`}
                >
                  <span className="w-8 shrink-0 text-center font-serif text-3xl font-semibold text-wine">{row.rank}</span>
                  <CandidatePhoto card={row} className="size-14 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink">{row.fullName}</p>
                    <p className="truncate text-sm text-muted">{row.churchName}</p>
                  </div>
                  <div className="hidden text-right text-xs text-muted sm:block">
                    <p>Public : <strong className="text-ink">{row.votePercent} %</strong></p>
                    {showJuryScore && row.juryScore !== null && (
                      <p>Jury : <strong className="text-ink">{row.juryScore}/100</strong></p>
                    )}
                  </div>
                  <div className="shrink-0 rounded-2xl bg-wine px-3 py-2 text-center text-white">
                    <p className="font-serif text-2xl font-semibold leading-none">{row.finalScore}</p>
                    <p className="text-[0.6rem] uppercase tracking-wider text-white/70">/100</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Appel final */}
      <section className="brand-hero px-5 py-16 text-center text-white sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <p className="font-serif text-3xl font-semibold leading-tight sm:text-5xl">
            Et si votre réflexion aidait un homme à se relever ?
          </p>
          <p className="mx-auto mt-5 max-w-xl text-white/75">
            L’inscription prend une vingtaine de minutes, épreuve de sélection comprise. Préparez
            une photo récente et le nom de votre église.
          </p>
          <button
            type="button"
            onClick={onApply}
            disabled={!cfg.registrationsOpen}
            className="mt-9 min-h-14 rounded-full bg-gold px-8 py-4 text-sm font-extrabold uppercase tracking-wider text-wine-dark transition hover:-translate-y-0.5 hover:bg-gold-light disabled:opacity-60"
          >
            Je dépose ma candidature
          </button>
        </div>
      </section>
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* Formulaire d'inscription en 4 étapes                                 */
/* ------------------------------------------------------------------ */

type Values = Record<string, string>

const inputClass =
  'h-12 w-full rounded-xl border bg-white px-4 font-normal outline-none transition placeholder:text-muted/60 focus:border-gold focus:ring-4 focus:ring-gold/10'

function FieldShell({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      <span>
        {label} {required && <span className="text-wine">*</span>}
      </span>
      {children}
      {hint && !error && <span className="text-xs font-normal text-muted">{hint}</span>}
      {error && (
        <span role="alert" className="text-xs font-semibold text-red-700">
          {error}
        </span>
      )}
    </label>
  )
}

function TextInput({
  name,
  label,
  values,
  errors,
  onChange,
  required,
  type = 'text',
  autoComplete,
  placeholder,
  hint,
}: {
  name: string
  label: string
  values: Values
  errors: Values
  onChange: (name: string, value: string) => void
  required?: boolean
  type?: 'text' | 'email' | 'tel'
  autoComplete?: string
  placeholder?: string
  hint?: string
}) {
  return (
    <FieldShell label={label} required={required} error={errors[name]} hint={hint}>
      <input
        className={`${inputClass} ${errors[name] ? 'border-red-400' : 'border-line'}`}
        name={name}
        type={type}
        value={values[name] || ''}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={Boolean(errors[name])}
        onChange={(event) => onChange(name, event.target.value)}
      />
    </FieldShell>
  )
}

function SelectInput({
  name,
  label,
  options,
  values,
  errors,
  onChange,
  required,
}: {
  name: string
  label: string
  options: readonly string[]
  values: Values
  errors: Values
  onChange: (name: string, value: string) => void
  required?: boolean
}) {
  return (
    <FieldShell label={label} required={required} error={errors[name]}>
      <select
        className={`${inputClass} ${errors[name] ? 'border-red-400' : 'border-line'}`}
        name={name}
        value={values[name] || ''}
        aria-invalid={Boolean(errors[name])}
        onChange={(event) => onChange(name, event.target.value)}
      >
        <option value="" disabled>
          Sélectionnez une option
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

function StepHeading({ index, title, text }: { index: number; title: string; text: string }) {
  return (
    <div className="border-b border-line pb-5">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-gold-dark">
        Étape {index + 1} sur {STEPS.length}
      </p>
      <h2 className="mt-2 font-serif text-3xl font-semibold text-wine sm:text-4xl">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
    </div>
  )
}

function validateStep(
  step: number,
  values: Values,
  photo: File | null,
  commitments: string[],
  quizLength: number,
) {
  const errors: Values = {}
  const required = [...REQUIRED_BY_STEP[step]]
  if (step === 1 && values.isChristian !== 'Oui') {
    required.splice(1)
  }
  if (step === 1 && values.churchRole === 'Autre') required.push('churchRoleOther')
  if (step === 2 && values.situation === 'Autre') required.push('situationOther')
  for (const field of required) {
    if (!values[field]?.trim()) errors[field] = 'Ce champ est obligatoire.'
  }
  if (step === 0) {
    if (!photo) errors.photo = 'Ajoutez une photo de vous.'
    if (values.phone && !isValidPhone(values.phone)) {
      errors.phone = 'Indiquez un numéro valide, avec l’indicatif si vous êtes hors de Côte d’Ivoire.'
    }
    if (values.email && !EMAIL_PATTERN.test(values.email)) {
      errors.email = 'L’adresse e-mail n’est pas valide.'
    }
  }
  if (step === 1 && values.isChristian === 'Non') {
    errors.isChristian =
      'Le concours est réservé aux personnes se déclarant chrétiennes : vous ne remplissez pas les conditions de participation.'
  }
  if (step === 3) {
    for (let index = 0; index < quizLength; index += 1) {
      if (!values[`quiz_${index}`]) errors[`quiz_${index}`] = 'Choisissez une réponse.'
    }
    const words = countWords(values.reflection || '')
    if (words < REFLECTION_MIN_WORDS || words > REFLECTION_MAX_WORDS) {
      errors.reflection = `Votre réflexion doit compter entre ${REFLECTION_MIN_WORDS} et ${REFLECTION_MAX_WORDS} mots (actuellement ${words}).`
    }
  }
  if (step === 4) {
    const missing = COMMITMENTS.filter((item) => !commitments.includes(item.name))
    if (missing.length) errors.commitments = 'Cochez chacun des engagements pour continuer.'
  }
  return errors
}

/** Redimensionne la photo (1200 px max, JPEG) avant l’envoi. Renvoie l’original en cas d’échec. */
async function compressPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    )
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

function CandidatureForm({ onBack }: { onBack: () => void }) {
  const { quiz, reflectionPrompt } = useContestData()
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Values>({ country: 'Côte d’Ivoire' })
  const [errors, setErrors] = useState<Values>({})
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [commitments, setCommitments] = useState<string[]>([])
  const [honeypot, setHoneypot] = useState('')
  const [state, setState] = useState<SubmitState>('idle')
  const [serverMessage, setServerMessage] = useState('')
  const [candidateNumber, setCandidateNumber] = useState('')

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null)
      return
    }
    const url = URL.createObjectURL(photo)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  function update(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const original = event.target.files?.[0] || null
    if (!original) return
    if (!PHOTO_TYPES.includes(original.type)) {
      setErrors((current) => ({ ...current, photo: 'Formats acceptés : JPG, PNG ou WEBP.' }))
      return
    }
    // Compression dans le navigateur : envoi plus rapide et stockage gratuit préservé.
    const file = await compressPhoto(original)
    if (file.size > PHOTO_MAX_BYTES) {
      setErrors((current) => ({ ...current, photo: 'La photo est trop lourde : choisissez-en une autre.' }))
      return
    }
    setPhoto(file)
    setErrors((current) => {
      const next = { ...current }
      delete next.photo
      return next
    })
  }

  function toggleCommitment(name: string) {
    setCommitments((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    )
    setErrors((current) => {
      const next = { ...current }
      delete next.commitments
      return next
    })
  }

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function next() {
    const stepErrors = validateStep(step, values, photo, commitments, quiz.length)
    setErrors(stepErrors)
    if (Object.keys(stepErrors).length) return
    setStep((current) => Math.min(current + 1, STEPS.length - 1))
    scrollTop()
  }

  function previous() {
    setErrors({})
    setStep((current) => Math.max(current - 1, 0))
    scrollTop()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step < STEPS.length - 1) {
      next()
      return
    }
    for (let index = 0; index < STEPS.length; index += 1) {
      const stepErrors = validateStep(index, values, photo, commitments, quiz.length)
      if (Object.keys(stepErrors).length) {
        setStep(index)
        setErrors(stepErrors)
        setServerMessage(
          'Certaines informations obligatoires sont manquantes. Veuillez vérifier votre formulaire.',
        )
        scrollTop()
        return
      }
    }

    setState('sending')
    setServerMessage('')
    const body = new FormData()
    for (const [key, value] of Object.entries(values)) body.append(key, value)
    for (const item of commitments) body.append('commitments', item)
    if (photo) body.append('photo', photo)
    body.append('website', honeypot)

    try {
      const response = await fetch('/api/concours/candidature', { method: 'POST', body })
      const result = (await response.json()) as {
        success?: boolean
        message?: string
        candidateNumber?: string
      }
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'L’envoi de votre candidature a échoué.')
      }
      setCandidateNumber(result.candidateNumber || '')
      setState('success')
      scrollTop()
    } catch (error) {
      setState('error')
      setServerMessage(
        error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.',
      )
    }
  }

  if (state === 'success') {
    return (
      <main className="min-h-[80vh] bg-cream px-5 py-16 sm:py-24">
        <section className="liquid-card mx-auto max-w-2xl rounded-[2rem] border border-gold/30 p-7 text-center sm:p-12">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-wine text-white">
            <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m5 12 4 4L19 6" />
            </svg>
          </span>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.22em] text-gold-dark">
            Candidature enregistrée
          </p>
          <h1 className="mt-3 font-serif text-4xl font-semibold text-wine sm:text-5xl">
            Félicitations !
          </h1>
          <div className="mx-auto mt-5 grid max-w-xl gap-3 leading-relaxed text-muted">
            <p>
              Votre candidature au concours AUTHENTIQUE HOMME a bien été enregistrée.
            </p>
            <p>
              Votre dossier sera examiné par le comité d’organisation. Vous recevrez une
              notification par e-mail concernant la suite de votre candidature.
            </p>
            <p>Merci pour votre intérêt et votre participation.</p>
          </div>
          {candidateNumber && (
            <div className="mx-auto mt-8 max-w-sm rounded-2xl bg-wine px-6 py-5 text-white">
              <p className="text-xs uppercase tracking-[0.2em] text-gold-light">
                Votre numéro de candidature
              </p>
              <p className="mt-2 font-mono text-2xl font-bold tracking-wider">{candidateNumber}</p>
              <p className="mt-2 text-xs text-white/65">
                Conservez-le : il vous sera demandé à chaque étape.
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={onBack}
            className="mt-8 rounded-full border border-wine/20 bg-cream px-7 py-3.5 text-sm font-bold text-wine transition hover:border-gold hover:bg-gold-soft"
          >
            Revenir à la page du concours
          </button>
        </section>
      </main>
    )
  }

  const isLastStep = step === STEPS.length - 1
  const notChristian = values.isChristian === 'Non'

  return (
    <main className="bg-cream">
      <section className="brand-hero px-5 py-12 text-white sm:py-16">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={onBack}
            className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-gold-light transition hover:text-white"
          >
            <span aria-hidden="true">←</span> Retour au concours
          </button>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold-light">
            Concours Authentique Homme
          </p>
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight sm:text-6xl">
            Devenir candidat
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-white/75">
            Cinq étapes, une vingtaine de minutes. Les champs marqués d’un astérisque sont
            obligatoires. Votre téléphone et votre e-mail ne seront jamais publiés.
          </p>
          <ol className="mt-9 grid grid-cols-5 gap-2" aria-label="Progression">
            {STEPS.map((item, index) => (
              <li key={item.title}>
                <div
                  className={`h-1.5 rounded-full transition ${index <= step ? 'bg-gold' : 'bg-white/20'}`}
                />
                <p
                  className={`mt-2 text-[0.7rem] font-bold uppercase tracking-wider sm:text-xs ${index === step ? 'text-white' : 'text-white/50'}`}
                  aria-current={index === step ? 'step' : undefined}
                >
                  {item.short}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 sm:py-14">
        <form
          noValidate
          onSubmit={handleSubmit}
          className="liquid-card mx-auto grid max-w-3xl gap-7 rounded-[2rem] border border-line p-5 sm:p-9"
        >
          <input
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            name="website"
            aria-hidden="true"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />

          {step === 0 && (
            <>
              <StepHeading
                index={0}
                title="Identité du candidat"
                text="Ces informations permettent au comité de vous identifier et de vous contacter."
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextInput name="lastName" label="Nom" autoComplete="family-name" required values={values} errors={errors} onChange={update} />
                <TextInput name="firstName" label="Prénoms" autoComplete="given-name" required values={values} errors={errors} onChange={update} />
              </div>
              <div className="grid gap-2 text-sm font-semibold text-ink">
                <span>
                  Photo du candidat <span className="text-wine">*</span>
                </span>
                <div
                  className={`flex flex-col items-center gap-5 rounded-2xl border border-dashed p-5 sm:flex-row ${errors.photo ? 'border-red-400 bg-red-50/40' : 'border-line bg-white'}`}
                >
                  <div className="relative size-28 shrink-0 overflow-hidden rounded-2xl bg-cream">
                    {photoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoPreview} alt="Aperçu de votre photo" className="size-full object-cover" />
                    ) : (
                      <span className="grid size-full place-items-center text-muted/50">
                        <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-4 3.6-6 8-6s8 2 8 6" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <div className="text-center sm:text-left">
                    <label className="inline-flex cursor-pointer rounded-full bg-wine px-5 py-3 text-sm font-bold text-white transition hover:bg-wine-dark">
                      {photo ? 'Changer de photo' : 'Choisir une photo'}
                      <input type="file" accept={PHOTO_TYPES.join(',')} className="sr-only" onChange={handlePhoto} />
                    </label>
                    <p className="mt-2 text-xs font-normal leading-5 text-muted">
                      Photo récente, visage bien visible. JPG, PNG ou WEBP. Elle est automatiquement allégée avant l’envoi. Elle sera
                      publiée si vous êtes présélectionné(e).
                    </p>
                  </div>
                </div>
                {errors.photo && (
                  <span role="alert" className="text-xs font-semibold text-red-700">
                    {errors.photo}
                  </span>
                )}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <TextInput name="phone" label="Numéro de téléphone" type="tel" autoComplete="tel" placeholder="Ex. 07 00 00 00 00" required values={values} errors={errors} onChange={update} />
                <TextInput name="email" label="Adresse e-mail" type="email" autoComplete="email" required hint="Vous y recevrez votre numéro de candidature." values={values} errors={errors} onChange={update} />
                <TextInput name="city" label="Ville de résidence" autoComplete="address-level2" required values={values} errors={errors} onChange={update} />
                <TextInput name="country" label="Pays de résidence" autoComplete="country-name" required values={values} errors={errors} onChange={update} />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <StepHeading
                index={1}
                title="Informations religieuses"
                text="Le concours est réservé aux personnes se déclarant chrétiennes."
              />
              <fieldset className="grid gap-3">
                <legend className="mb-1 text-sm font-semibold text-ink">
                  Êtes-vous chrétien(ne) ? <span className="text-wine">*</span>
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  {['Oui', 'Non'].map((option) => (
                    <label
                      key={option}
                      className={`flex cursor-pointer items-center justify-center gap-3 rounded-xl border p-4 text-base font-bold transition ${values.isChristian === option ? 'border-wine bg-wine text-white' : 'border-line bg-white text-wine hover:border-gold'}`}
                    >
                      <input
                        type="radio"
                        name="isChristian"
                        value={option}
                        checked={values.isChristian === option}
                        onChange={() => update('isChristian', option)}
                        className="sr-only"
                      />
                      {option}
                    </label>
                  ))}
                </div>
                {errors.isChristian && !notChristian && (
                  <span role="alert" className="text-xs font-semibold text-red-700">
                    {errors.isChristian}
                  </span>
                )}
              </fieldset>

              {notChristian && (
                <div role="alert" className="rounded-2xl border border-gold/40 bg-gold-soft p-5 text-sm leading-7 text-muted">
                  <p className="font-serif text-xl font-semibold text-wine">
                    Vous ne remplissez pas les conditions de participation.
                  </p>
                  <p className="mt-2">
                    Le concours AUTHENTIQUE HOMME est réservé aux personnes se déclarant
                    chrétiennes. Merci sincèrement pour votre intérêt : vous restez le bienvenu
                    pour suivre les candidats, voter et assister à la conférence du 19 décembre.
                  </p>
                </div>
              )}

              {values.isChristian === 'Oui' && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <TextInput name="churchName" label="Nom de l’église" required values={values} errors={errors} onChange={update} />
                  <TextInput name="denomination" label="Dénomination ou communauté chrétienne" required placeholder="Ex. évangélique, catholique, méthodiste…" values={values} errors={errors} onChange={update} />
                  <TextInput name="churchCity" label="Ville de l’église" required values={values} errors={errors} onChange={update} />
                  <TextInput name="churchCountry" label="Pays de l’église" required values={values} errors={errors} onChange={update} />
                  <SelectInput name="churchRole" label="Fonction dans l’église" options={CHURCH_ROLES} required values={values} errors={errors} onChange={update} />
                  {values.churchRole === 'Autre' && (
                    <TextInput name="churchRoleOther" label="Précisez votre fonction" required values={values} errors={errors} onChange={update} />
                  )}
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <StepHeading
                index={2}
                title="Parcours académique et professionnel"
                text="Ces informations complètent votre profil. Elles ne sont jamais un critère d’élimination."
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <SelectInput name="educationLevel" label="Niveau d’études" options={EDUCATION_LEVELS} required values={values} errors={errors} onChange={update} />
                <TextInput name="fieldOfStudy" label="Domaine d’études" placeholder="Ex. droit, théologie, informatique…" values={values} errors={errors} onChange={update} />
                <SelectInput name="situation" label="Situation actuelle" options={SITUATIONS} required values={values} errors={errors} onChange={update} />
                {values.situation === 'Autre' && (
                  <TextInput name="situationOther" label="Précisez votre situation" required values={values} errors={errors} onChange={update} />
                )}
                <TextInput name="currentRole" label="Fonction actuelle" placeholder="Ex. étudiant en L3, comptable…" values={values} errors={errors} onChange={update} />
                <TextInput name="organization" label="Organisation ou établissement" hint="Facultatif" values={values} errors={errors} onChange={update} />
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-line bg-white p-4 text-sm leading-relaxed text-muted">
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-wine"
                  checked={values.publishEducation === 'Oui'}
                  onChange={(event) => update('publishEducation', event.target.checked ? 'Oui' : 'Non')}
                />
                <span>
                  J’accepte que mon niveau d’études apparaisse sur ma fiche publique si je suis
                  présélectionné(e). <span className="text-xs">(Facultatif)</span>
                </span>
              </label>
            </>
          )}

          {step === 3 && (
            <>
              <StepHeading
                index={3}
                title="Épreuve de sélection"
                text="Un QCM sur Luc 15 et une courte réflexion. Ils servent à retenir automatiquement les meilleures candidatures : prenez votre temps."
              />
              <div className="grid gap-5">
                {quiz.map((item, questionIndex) => {
                  const name = `quiz_${questionIndex}`
                  return (
                    <fieldset
                      key={name}
                      className={`grid gap-3 rounded-2xl border bg-white p-4 sm:p-5 ${errors[name] ? 'border-red-400' : 'border-line'}`}
                    >
                      <legend className="px-1 text-sm font-bold text-ink">
                        <span className="text-gold-dark">{questionIndex + 1}.</span> {item.question}
                      </legend>
                      <div className="grid gap-2">
                        {item.options.map((option, optionIndex) => (
                          <label
                            key={option}
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${values[name] === String(optionIndex) ? 'border-wine bg-wine/5 text-ink' : 'border-line text-muted hover:border-gold/60'}`}
                          >
                            <input
                              type="radio"
                              name={name}
                              value={optionIndex}
                              checked={values[name] === String(optionIndex)}
                              onChange={() => update(name, String(optionIndex))}
                              className="mt-0.5 size-4 shrink-0 accent-wine"
                            />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                      {errors[name] && (
                        <span role="alert" className="text-xs font-semibold text-red-700">
                          {errors[name]}
                        </span>
                      )}
                    </fieldset>
                  )
                })}
              </div>
              <div className="grid gap-2">
                <div className="rounded-2xl border border-gold/40 bg-gold-soft p-4 text-sm leading-6 text-ink sm:p-5">
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-gold-dark">
                    Courte réflexion
                  </p>
                  <p className="mt-2">{reflectionPrompt}</p>
                </div>
                <textarea
                  className={`min-h-56 w-full resize-y rounded-xl border bg-white px-4 py-3 text-base outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/10 ${errors.reflection ? 'border-red-400' : 'border-line'}`}
                  value={values.reflection || ''}
                  onChange={(event) => update('reflection', event.target.value)}
                  placeholder="Rédigez votre réflexion ici, avec vos propres mots…"
                  aria-invalid={Boolean(errors.reflection)}
                />
                <p className="flex justify-between text-xs text-muted">
                  <span>
                    Entre {REFLECTION_MIN_WORDS} et {REFLECTION_MAX_WORDS} mots. Écrivez avec vos propres mots :
                    la note tient compte de la réflexion personnelle.
                  </span>
                  <span className="shrink-0 font-semibold">{countWords(values.reflection || '')} mots</span>
                </p>
                {errors.reflection && (
                  <span role="alert" className="text-xs font-semibold text-red-700">
                    {errors.reflection}
                  </span>
                )}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <StepHeading
                index={4}
                title="Engagements et validation"
                text="Relisez et cochez chacun des engagements pour soumettre votre candidature."
              />
              <div className="rounded-2xl bg-cream p-5 text-sm leading-7 text-muted">
                <p className="font-bold text-wine">Récapitulatif</p>
                <p className="mt-1">
                  {values.firstName} {values.lastName} · {values.city}, {values.country}
                  <br />
                  {values.churchName} — {values.churchRole === 'Autre' ? values.churchRoleOther : values.churchRole}
                </p>
              </div>
              <fieldset className="grid gap-3">
                <legend className="sr-only">Engagements</legend>
                {COMMITMENTS.map((item) => (
                  <label
                    key={item.name}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 text-sm leading-relaxed transition hover:border-gold/60 ${commitments.includes(item.name) ? 'border-wine/40 text-ink' : 'border-line text-muted'}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 accent-wine"
                      checked={commitments.includes(item.name)}
                      onChange={() => toggleCommitment(item.name)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
                {errors.commitments && (
                  <span role="alert" className="text-xs font-semibold text-red-700">
                    {errors.commitments}
                  </span>
                )}
              </fieldset>
              <p className="text-xs leading-5 text-muted">
                Consultez le{' '}
                <a
                  href="/#reglement"
                  target="_blank"
                  rel="noopener"
                  className="font-semibold text-wine underline decoration-gold underline-offset-4"
                >
                  règlement du concours
                </a>{' '}
                (s’ouvre dans un nouvel onglet)
                avant de valider.
              </p>
            </>
          )}

          {serverMessage && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <strong>La candidature n’a pas pu être envoyée.</strong> {serverMessage} Vos réponses
              sont conservées : vous pouvez réessayer.
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-between">
            {step > 0 ? (
              <button
                type="button"
                onClick={previous}
                className="min-h-12 rounded-full border border-line px-6 py-3 text-sm font-bold text-wine transition hover:border-gold"
              >
                ← Étape précédente
              </button>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={state === 'sending' || (step === 1 && notChristian)}
              className="min-h-14 rounded-full bg-wine px-7 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-wine/20 transition hover:-translate-y-0.5 hover:bg-wine-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state === 'sending'
                ? 'Envoi en cours…'
                : isLastStep
                  ? 'Soumettre ma candidature'
                  : 'Continuer →'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}

/* ------------------------------------------------------------------ */

export function ContestSite({ data = defaultData }: { data?: ContestData }) {
  const [view, setView] = useState<View>('home')
  const cfg = data.cfg

  useEffect(() => {
    if (window.location.hash === '#inscription' && cfg.registrationsOpen) {
      setView('form')
    }
  }, [cfg.registrationsOpen])

  function openForm() {
    if (!cfg.registrationsOpen) return
    setView('form')
    window.history.replaceState(null, '', '#inscription')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function backToContest() {
    setView('home')
    window.history.replaceState(null, '', window.location.pathname)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <ContestDataContext.Provider value={data}>
      <div className="min-h-screen overflow-x-hidden bg-white text-ink">
        <Header onApply={openForm} />
        {view === 'form' ? (
          <CandidatureForm onBack={backToContest} />
        ) : (
          <ContestHome onApply={openForm} />
        )}
        <Footer />
      </div>
    </ContestDataContext.Provider>
  )
}

/** En-tête et pied de page réutilisés par les pages fiche candidat et espace candidat. */
export function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-cream text-ink">
      <header className="liquid-nav sticky top-0 z-50 border-b border-white/10 px-3 text-white sm:px-6">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3">
          <Link href="/" aria-label="Accueil du concours Authentique Homme">
            <MinistryLogo />
          </Link>
          <nav aria-label="Navigation principale" className="flex items-center gap-2">
            <Link
              href="/#candidats"
              className="rounded-full border border-white/25 px-4 py-2.5 text-sm font-bold transition hover:border-gold hover:bg-white/10"
            >
              Candidats
            </Link>
            <Link
              href="/espace-candidat"
              className="rounded-full bg-gold px-4 py-2.5 text-sm font-extrabold text-wine-dark transition hover:bg-gold-light"
            >
              Espace candidat
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <Footer />
    </div>
  )
}
