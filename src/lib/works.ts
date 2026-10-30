/** Règles du dépôt des travaux (partagées navigateur / serveur). */

export type WorkKind = 'video' | 'pdf'

export const WORK_RULES: Record<
  WorkKind,
  { label: string; maxBytes: number; maxLabel: string; types: string[]; accept: string }
> = {
  video: {
    label: 'Vidéo de présentation',
    maxBytes: 80 * 1024 * 1024,
    maxLabel: '80 Mo',
    types: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'video/3gpp', 'video/x-m4v', 'video/*'],
    accept: 'video/*',
  },
  pdf: {
    label: 'Document écrit (PDF)',
    maxBytes: 10 * 1024 * 1024,
    maxLabel: '10 Mo',
    types: ['application/pdf'],
    accept: 'application/pdf',
  },
}

/** Quota gratuit Vercel Blob : 1 Go. On garde une marge de sécurité. */
export const STORAGE_SAFE_LIMIT = 950 * 1024 * 1024

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`
}
