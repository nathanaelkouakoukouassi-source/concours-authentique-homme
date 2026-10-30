'use client'

import { upload } from '@vercel/blob/client'
import { ChangeEvent, useState } from 'react'
import { WORK_RULES, type WorkKind, formatBytes } from '@/lib/works'

type FileState = { size?: number | null; uploadedAt?: string | null; filename?: string | null }

function slugify(name: string) {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9.]+/g, '-')
      .replace(/-+/g, '-')
      .slice(-60) || 'fichier'
  )
}

function formatDate(value?: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Abidjan',
  })
}

function UploadRow({
  kind,
  candidateNumber,
  initial,
  open,
}: {
  kind: WorkKind
  candidateNumber: string
  initial: FileState
  open: boolean
}) {
  const rules = WORK_RULES[kind]
  const [current, setCurrent] = useState<FileState>(initial)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState('')

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    if (!rules.types.includes(file.type) && !(kind === 'video' && file.type.startsWith('video/'))) {
      setError(kind === 'pdf' ? 'Choisissez un fichier PDF.' : 'Choisissez un fichier vidéo (MP4 de préférence).')
      return
    }
    if (file.size > rules.maxBytes) {
      setError(
        `Ce fichier fait ${formatBytes(file.size)} : la limite est de ${rules.maxLabel}. ${kind === 'video' ? 'Compressez la vidéo (par exemple avec l’application « Video Compressor » ou en filmant en 720p) puis réessayez.' : 'Réduisez la taille du PDF puis réessayez.'}`,
      )
      return
    }
    setProgress(0)
    try {
      const blob = await upload(`travaux/${candidateNumber}/${kind}-${slugify(file.name)}`, file, {
        access: 'private',
        handleUploadUrl: '/api/concours/espace/travaux/upload',
        clientPayload: JSON.stringify({ kind }),
        multipart: file.size > 20 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      })
      const response = await fetch('/api/concours/espace/travaux/confirmer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, pathname: blob.pathname, filename: file.name }),
      })
      const result = (await response.json()) as {
        success?: boolean
        message?: string
        size?: number
        uploadedAt?: string
      }
      if (!response.ok || !result.success) throw new Error(result.message || 'Envoi non confirmé.')
      setCurrent({ size: result.size, uploadedAt: result.uploadedAt, filename: file.name })
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'L’envoi a échoué. Vérifiez votre connexion et réessayez.',
      )
    } finally {
      setProgress(null)
    }
  }

  const sending = progress !== null

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold text-ink">{rules.label}</p>
          <p className="text-xs text-muted">
            {kind === 'video' ? '5 minutes maximum · ' : ''}
            {rules.maxLabel} maximum
          </p>
        </div>
        {current.uploadedAt ? (
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
            Envoyé le {formatDate(current.uploadedAt)}
          </span>
        ) : (
          <span className="rounded-full bg-gold-soft px-3 py-1 text-xs font-bold text-gold-dark">
            À envoyer
          </span>
        )}
      </div>
      {current.uploadedAt && (
        <p className="mt-2 truncate text-xs text-muted">
          {current.filename} {current.size ? `· ${formatBytes(current.size)}` : ''}
        </p>
      )}

      {sending && (
        <div className="mt-4" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs font-semibold text-wine">
            Envoi en cours… {progress} % — ne fermez pas la page.
          </p>
        </div>
      )}

      {open ? (
        <label
          className={`mt-4 inline-flex cursor-pointer rounded-full px-5 py-3 text-sm font-bold transition ${sending ? 'pointer-events-none bg-line text-muted' : current.uploadedAt ? 'border border-wine/30 text-wine hover:border-gold' : 'bg-wine text-white hover:bg-wine-dark'}`}
        >
          {current.uploadedAt ? 'Remplacer le fichier' : `Choisir ${kind === 'video' ? 'ma vidéo' : 'mon PDF'}`}
          <input
            type="file"
            accept={rules.accept}
            className="sr-only"
            onChange={handleFile}
            disabled={sending}
          />
        </label>
      ) : (
        <p className="mt-4 text-sm font-semibold text-muted">Le dépôt des travaux est fermé.</p>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  )
}

/** Dépôt des travaux directement depuis l’espace candidat (§8, sans WhatsApp). */
export function WorksUpload({
  candidateNumber,
  video,
  pdf,
  open,
}: {
  candidateNumber: string
  video: FileState
  pdf: FileState
  open: boolean
}) {
  return (
    <div className="mt-5 grid gap-3">
      <UploadRow kind="video" candidateNumber={candidateNumber} initial={video} open={open} />
      <UploadRow kind="pdf" candidateNumber={candidateNumber} initial={pdf} open={open} />
    </div>
  )
}
