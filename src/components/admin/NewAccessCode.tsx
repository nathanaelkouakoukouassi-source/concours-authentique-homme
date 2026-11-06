'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useState } from 'react'

/** Code perdu : génère un nouveau code d’accès à transmettre au candidat. */
export function NewAccessCode() {
  const { id } = useDocumentInfo()
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (!id) return null

  async function generate() {
    if (!window.confirm('Générer un nouveau code ? L’ancien code du candidat ne fonctionnera plus.')) {
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/concours/admin/code/${id}`, {
        method: 'POST',
        credentials: 'include',
      })
      const result = (await response.json()) as { success?: boolean; message?: string; code?: string }
      if (!response.ok || !result.success || !result.code) throw new Error(result.message || 'Échec.')
      setCode(result.code)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Échec.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
      }}
    >
      <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Code d’accès du candidat</p>
      <p style={{ opacity: 0.75, marginBottom: 12 }}>
        Le code est affiché au candidat à la fin de son inscription. S’il l’a perdu, générez-en un
        nouveau et transmettez-le-lui (WhatsApp, téléphone).
      </p>
      {code ? (
        <p style={{ fontSize: 22, fontFamily: 'monospace', letterSpacing: 4, fontWeight: 700 }}>
          {code}
        </p>
      ) : (
        <button
          type="button"
          className="btn btn--style-secondary btn--size-medium"
          onClick={() => void generate()}
          disabled={busy}
        >
          {busy ? 'Génération…' : 'Générer un nouveau code'}
        </button>
      )}
      {code && (
        <p style={{ opacity: 0.75, marginTop: 8, fontSize: 13 }}>
          Notez-le maintenant : il ne sera plus affiché après fermeture de la page.
        </p>
      )}
      {message && <p style={{ color: 'var(--theme-error-500)', marginTop: 8 }}>{message}</p>}
    </div>
  )
}
