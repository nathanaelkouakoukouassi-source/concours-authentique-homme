'use client'

import { useState } from 'react'

type Result = {
  success?: boolean
  message?: string
  total?: number
  sent?: number
  skipped?: number
  failed?: string[]
}

/** Bouton « Notifier les présélectionnés » : envoie à chacun son code d’accès personnel (§7.1). */
export function NotifyPreselected() {
  const [state, setState] = useState<'idle' | 'sending'>('idle')
  const [result, setResult] = useState<Result | null>(null)

  async function notify(mode: 'nouveaux' | 'tous') {
    const question =
      mode === 'tous'
        ? 'Renvoyer un NOUVEAU code à TOUS les présélectionnés ? Les anciens codes ne fonctionneront plus.'
        : 'Envoyer leur code d’accès aux présélectionnés qui ne l’ont pas encore reçu ?'
    if (!window.confirm(question)) return
    setState('sending')
    setResult(null)
    try {
      const response = await fetch('/api/concours/admin/notifier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
        credentials: 'include',
      })
      setResult((await response.json()) as Result)
    } catch {
      setResult({ success: false, message: 'Impossible de joindre le serveur.' })
    } finally {
      setState('idle')
    }
  }

  return (
    <div
      style={{
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 12,
        padding: 20,
        margin: '24px 0',
      }}
    >
      <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
        Notifier les candidats présélectionnés
      </p>
      <p style={{ opacity: 0.75, marginBottom: 14 }}>
        Chaque candidature au statut « Présélectionné » reçoit un e-mail avec son code d’accès
        personnel à l’espace candidat, où elle télécharge le dossier. Vérifiez d’abord la liste des
        10 et importez le PDF.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn--style-primary btn--size-medium"
          disabled={state === 'sending'}
          onClick={() => notify('nouveaux')}
        >
          {state === 'sending' ? 'Envoi en cours…' : 'Notifier les présélectionnés'}
        </button>
        <button
          type="button"
          className="btn btn--style-secondary btn--size-medium"
          disabled={state === 'sending'}
          onClick={() => notify('tous')}
        >
          Renvoyer un code à tous
        </button>
      </div>
      {result && (
        <div style={{ marginTop: 14 }}>
          {result.success ? (
            <p>
              <strong>{result.sent}</strong> e-mail(s) envoyé(s) sur {result.total} présélectionné(s)
              {result.skipped ? `, ${result.skipped} déjà notifié(s)` : ''}.
              {result.failed?.length ? (
                <span style={{ color: 'var(--theme-error-500)' }}>
                  {' '}
                  Échecs : {result.failed.join(', ')}.
                </span>
              ) : null}
            </p>
          ) : (
            <p style={{ color: 'var(--theme-error-500)' }}>{result.message}</p>
          )}
        </div>
      )}
    </div>
  )
}
