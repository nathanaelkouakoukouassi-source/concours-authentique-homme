'use client'

import { useFormFields } from '@payloadcms/ui'
import { useCallback, useEffect, useState } from 'react'

type Stats = {
  success?: boolean
  message?: string
  total?: number
  conformes?: number
  notees?: number
  preselectionnes?: number
  aiReady?: boolean
  emailReady?: boolean
}

const STATUS_LABELS: Record<string, string> = {
  'en-attente': 'En attente de la clôture',
  'en-cours': 'En cours',
  terminee: 'Terminée',
  erreur: 'Erreur — voir le journal',
}

/** Tableau de bord de la sélection automatique (§6.4) et lancement manuel. */
export function SelectionPanel() {
  const status = useFormFields(([fields]) => fields.selectionStatus?.value) as string | undefined
  const closesAt = useFormFields(([fields]) => fields.registrationClosesAt?.value) as
    | string
    | undefined
  const [stats, setStats] = useState<Stats | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; message?: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/concours/admin/selection', { credentials: 'include' })
      setStats((await response.json()) as Stats)
    } catch {
      setStats({ success: false, message: 'Impossible de charger les compteurs.' })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function runNow() {
    if (
      !window.confirm(
        'Lancer la sélection maintenant ? Les inscriptions seront fermées, les meilleurs candidats présélectionnés' +
          ' et, selon les options, la liste publiée et les codes envoyés.',
      )
    )
      return
    setRunning(true)
    setResult(null)
    try {
      const response = await fetch('/api/concours/admin/selection', {
        method: 'POST',
        credentials: 'include',
      })
      setResult((await response.json()) as { success?: boolean; message?: string })
      void load()
    } catch {
      setResult({ success: false, message: 'Impossible de joindre le serveur.' })
    } finally {
      setRunning(false)
    }
  }

  const tile: React.CSSProperties = {
    flex: '1 1 120px',
    border: '1px solid var(--theme-elevation-150)',
    borderRadius: 10,
    padding: '12px 14px',
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
      <p style={{ fontWeight: 700, fontSize: 16 }}>Sélection automatique</p>
      <p style={{ opacity: 0.75, margin: '6px 0 14px' }}>
        État : <strong>{STATUS_LABELS[status || 'en-attente'] || status}</strong>
        {closesAt
          ? ` — clôture prévue le ${new Date(closesAt).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}`
          : ' — aucune date de clôture fixée (onglet « 1. Inscriptions »)'}
      </p>
      {stats?.success && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              ['Inscriptions', stats.total],
              ['Conformes', stats.conformes],
              ['Réflexions notées', stats.notees],
              ['Présélectionnés', stats.preselectionnes],
            ].map(([label, value]) => (
              <div key={String(label)} style={tile}>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{value ?? 0}</div>
                <div style={{ opacity: 0.7, fontSize: 13 }}>{label}</div>
              </div>
            ))}
          </div>
          {!stats.aiReady && (
            <p style={{ color: 'var(--theme-error-500)', marginBottom: 8 }}>
              Notation par l’IA inactive : ajoutez la variable ANTHROPIC_API_KEY dans Vercel.
            </p>
          )}
          {!stats.emailReady && (
            <p style={{ color: 'var(--theme-error-500)', marginBottom: 8 }}>
              Envoi d’e-mails inactif : ajoutez GMAIL_USER et GMAIL_APP_PASSWORD dans Vercel.
            </p>
          )}
        </>
      )}
      <button
        type="button"
        className="btn btn--style-secondary btn--size-medium"
        disabled={running}
        onClick={() => void runNow()}
      >
        {running ? 'Sélection en cours…' : 'Lancer la sélection maintenant'}
      </button>
      {result && (
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            marginTop: 12,
            fontSize: 13,
            color: result.success ? 'inherit' : 'var(--theme-error-500)',
          }}
        >
          {result.message}
        </pre>
      )}
    </div>
  )
}
