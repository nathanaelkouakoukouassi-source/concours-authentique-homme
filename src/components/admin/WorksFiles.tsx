'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { formatBytes } from '../../lib/works'

function useField<T>(name: string) {
  return useFormFields(([fields]) => fields[name]?.value) as T | undefined
}

function formatDate(value?: string) {
  if (!value) return ''
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

/** Fichiers déposés par le candidat depuis son espace (vidéo + PDF). */
export function WorksFiles() {
  const { id } = useDocumentInfo()
  const files = [
    {
      kind: 'video',
      label: 'Vidéo de présentation',
      pathname: useField<string>('videoPathname'),
      size: useField<number>('videoSize'),
      name: useField<string>('videoFilename'),
      at: useField<string>('videoUploadedAt'),
    },
    {
      kind: 'pdf',
      label: 'Document écrit (PDF)',
      pathname: useField<string>('pdfPathname'),
      size: useField<number>('pdfSize'),
      name: useField<string>('pdfFilename'),
      at: useField<string>('pdfUploadedAt'),
    },
  ]

  return (
    <div
      style={{
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
      }}
    >
      <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Travaux déposés par le candidat</p>
      <div style={{ display: 'grid', gap: 12 }}>
        {files.map((file) => (
          <div
            key={file.kind}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--theme-elevation-50)',
            }}
          >
            <div>
              <p style={{ fontWeight: 600 }}>{file.label}</p>
              <p style={{ opacity: 0.7, fontSize: 13 }}>
                {file.pathname
                  ? `${file.name || 'Fichier'} · ${formatBytes(file.size)} · déposé le ${formatDate(file.at)}`
                  : 'Pas encore déposé'}
              </p>
            </div>
            {file.pathname && id && (
              <div style={{ display: 'flex', gap: 8 }}>
                <a
                  className="btn btn--style-secondary btn--size-small"
                  href={`/api/concours/admin/travaux/${id}/${file.kind}`}
                  target="_blank"
                  rel="noopener"
                >
                  {file.kind === 'video' ? 'Regarder' : 'Ouvrir'}
                </a>
                <a
                  className="btn btn--style-secondary btn--size-small"
                  href={`/api/concours/admin/travaux/${id}/${file.kind}?telecharger=1`}
                >
                  Télécharger
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
      <p style={{ opacity: 0.7, fontSize: 13, marginTop: 12 }}>
        Fichiers privés, visibles uniquement par le comité et le jury. Pour le vote public, publiez la
        vidéo sur YouTube en « non répertoriée » et collez son lien plus bas.
      </p>
    </div>
  )
}
