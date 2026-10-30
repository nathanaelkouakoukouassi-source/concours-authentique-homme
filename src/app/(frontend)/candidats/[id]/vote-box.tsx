'use client'

import { FormEvent, useState } from 'react'

type State = 'a-venir' | 'ouvert' | 'clos' | 'validation' | 'publies'
type Step = 'start' | 'email' | 'code' | 'done'

const CLOSED_MESSAGES: Record<Exclude<State, 'ouvert'>, string> = {
  'a-venir': 'Le vote n’est pas encore ouvert. Revenez à la date annoncée.',
  clos: 'La période de vote est terminée. Merci pour votre participation.',
  validation: 'La période de vote est terminée. Les résultats sont en cours de validation.',
  publies: 'La période de vote est terminée. Les résultats sont publiés sur la page d’accueil.',
}

/** Vote en deux temps : e-mail → code à 6 chiffres → vote enregistré (un par e-mail). */
export function VoteBox({
  candidateId,
  candidateName,
  state,
}: {
  candidateId: string
  candidateName: string
  state: State
}) {
  const [step, setStep] = useState<Step>('start')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function requestCode(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/concours/vote/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, candidateId, website: honeypot }),
      })
      const result = (await response.json()) as { success?: boolean; message?: string }
      if (!response.ok || !result.success) throw new Error(result.message || 'Envoi impossible.')
      setStep('code')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Envoi impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmVote(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/concours/vote/confirmer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const result = (await response.json()) as { success?: boolean; message?: string }
      if (!response.ok || !result.success) throw new Error(result.message || 'Vote impossible.')
      setStep('done')
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : 'Vote impossible.')
    } finally {
      setBusy(false)
    }
  }

  const input =
    'h-12 w-full rounded-xl border border-line bg-white px-4 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/10'

  return (
    <div className="rounded-[2rem] bg-wine p-6 text-white shadow-xl shadow-wine/15 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-light">Vote du public</p>

      {state !== 'ouvert' && (
        <>
          <p className="mt-3 font-serif text-2xl font-semibold">Voter pour ce candidat</p>
          <p className="mt-3 text-sm leading-6 text-white/75">{CLOSED_MESSAGES[state]}</p>
        </>
      )}

      {state === 'ouvert' && step === 'start' && (
        <>
          <p className="mt-3 font-serif text-2xl font-semibold">Soutenez {candidateName}</p>
          <p className="mt-3 text-sm leading-6 text-white/75">
            Un seul vote par adresse e-mail. Le vote du public compte pour 20 % du score de
            présélection.
          </p>
          <button
            type="button"
            onClick={() => setStep('email')}
            className="mt-5 min-h-12 w-full rounded-full bg-gold px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-wine-dark transition hover:bg-gold-light"
          >
            Voter pour ce candidat
          </button>
        </>
      )}

      {state === 'ouvert' && step === 'email' && (
        <form onSubmit={requestCode} className="mt-4 grid gap-3">
          <label className="grid gap-2 text-sm font-semibold">
            Votre adresse e-mail
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={input}
              placeholder="vous@exemple.com"
            />
          </label>
          <input
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
          <p className="text-xs leading-5 text-white/65">
            Nous vous envoyons un code à 6 chiffres pour confirmer votre vote. Votre adresse n’est
            jamais publiée.
          </p>
          <button
            type="submit"
            disabled={busy}
            className="min-h-12 rounded-full bg-gold px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-wine-dark transition hover:bg-gold-light disabled:opacity-60"
          >
            {busy ? 'Envoi…' : 'Recevoir mon code'}
          </button>
        </form>
      )}

      {state === 'ouvert' && step === 'code' && (
        <form onSubmit={confirmVote} className="mt-4 grid gap-3">
          <p className="text-sm leading-6 text-white/80">
            Code envoyé à <strong>{email}</strong>. Pensez à regarder vos courriers indésirables.
          </p>
          <label className="grid gap-2 text-sm font-semibold">
            Code à 6 chiffres
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              className={`${input} text-center font-mono text-2xl tracking-[0.4em]`}
            />
          </label>
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="min-h-12 rounded-full bg-gold px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-wine-dark transition hover:bg-gold-light disabled:opacity-60"
          >
            {busy ? 'Validation…' : 'Valider mon vote'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('email')
              setCode('')
              setError('')
            }}
            className="text-xs font-semibold text-white/70 underline"
          >
            Changer d’adresse ou renvoyer un code
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="mt-4">
          <p className="font-serif text-2xl font-semibold">Merci pour votre participation !</p>
          <p className="mt-3 text-sm leading-6 text-white/80">
            Votre vote pour le concours AUTHENTIQUE HOMME a bien été enregistré. Merci de
            contribuer à la valorisation des réflexions bibliques et des solutions proposées par nos
            candidats.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-white/10 p-3 text-sm text-gold-light">
          {error}
        </p>
      )}
    </div>
  )
}
