'use client'

import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

const input =
  'h-12 w-full rounded-xl border border-line bg-white px-4 font-normal outline-none transition placeholder:text-muted/60 focus:border-gold focus:ring-4 focus:ring-gold/10'

export function LoginForm() {
  const router = useRouter()
  const [numero, setNumero] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/concours/espace/connexion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero, code }),
      })
      const result = (await response.json()) as { success?: boolean; message?: string }
      if (!response.ok || !result.success) throw new Error(result.message || 'Connexion impossible.')
      router.refresh()
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Connexion impossible.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 grid gap-5">
      <label className="grid gap-2 text-sm font-semibold text-ink">
        Numéro de candidature
        <input
          className={`${input} font-mono uppercase`}
          value={numero}
          onChange={(event) => setNumero(event.target.value.toUpperCase())}
          placeholder="AH26-XXXXXX"
          autoComplete="username"
          required
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-ink">
        Code d’accès reçu par e-mail
        <input
          className={`${input} font-mono uppercase tracking-[0.3em]`}
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          autoComplete="one-time-code"
          required
        />
      </label>
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="min-h-14 rounded-full bg-wine px-6 py-4 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-wine-dark disabled:opacity-60"
      >
        {busy ? 'Connexion…' : 'Accéder à mon espace'}
      </button>
      <p className="text-center text-xs leading-5 text-muted">
        Code perdu ? Écrivez au comité à{' '}
        <a href="mailto:ministereporteurdamour@gmail.com" className="font-semibold text-wine underline">
          ministereporteurdamour@gmail.com
        </a>{' '}
        avec votre numéro de candidature.
      </p>
    </form>
  )
}

export function LogoutButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch('/api/concours/espace/connexion', { method: 'DELETE' })
        router.refresh()
      }}
      className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-bold text-white transition hover:border-gold hover:bg-white/10"
    >
      Se déconnecter
    </button>
  )
}
