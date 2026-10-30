'use client'

import { useFormFields } from '@payloadcms/ui'
import { ChangeEvent, useState } from 'react'

const box: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 12,
  padding: 20,
  marginBottom: 24,
}

/** Import du dossier officiel PDF dans le stockage privé (§7.2). */
export function DossierUpload() {
  const currentName = useFormFields(([fields]) => fields.dossierFilename?.value) as
    | string
    | undefined
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setState('sending')
    setMessage('')
    const body = new FormData()
    body.append('file', file)
    try {
      const response = await fetch('/api/concours/admin/dossier', {
        method: 'POST',
        body,
        credentials: 'include',
      })
      const result = (await response.json()) as { success?: boolean; message?: string }
      if (!response.ok || !result.success) throw new Error(result.message || 'Échec de l’import.')
      setState('done')
      setMessage(`« ${file.name} » importé. Rechargez la page pour voir le nouveau nom de fichier.`)
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Échec de l’import.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div style={box}>
      <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Dossier officiel du concours (PDF)</p>
      <p style={{ opacity: 0.75, marginBottom: 14 }}>
        Stocké en privé : seuls les candidats présélectionnés connectés à leur espace peuvent le
        télécharger. Aucun PDF n’est envoyé par e-mail. Taille maximale : 4 Mo.
      </p>
      <p style={{ marginBottom: 14 }}>
        Fichier actuel : <strong>{currentName || 'aucun'}</strong>
        {currentName && (
          <>
            {' — '}
            <a href="/api/concours/admin/dossier" target="_blank" rel="noopener">
              prévisualiser
            </a>
          </>
        )}
      </p>
      <label
        style={{
          display: 'inline-block',
          background: 'var(--theme-elevation-800)',
          color: 'var(--theme-elevation-0)',
          padding: '10px 18px',
          borderRadius: 6,
          cursor: state === 'sending' ? 'wait' : 'pointer',
          fontWeight: 600,
        }}
      >
        {state === 'sending' ? 'Import en cours…' : currentName ? 'Remplacer le PDF' : 'Importer le PDF'}
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFile}
          disabled={state === 'sending'}
          style={{ display: 'none' }}
        />
      </label>
      {message && (
        <p style={{ marginTop: 12, color: state === 'error' ? 'var(--theme-error-500)' : 'inherit' }}>
          {message}
        </p>
      )}
    </div>
  )
}
