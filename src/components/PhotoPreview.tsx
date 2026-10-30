'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'

/**
 * Aperçu de la photo du candidat dans le back-office.
 * L’image est servie par /api/concours/photo/<id>, réservé aux membres du comité connectés.
 */
export function PhotoPreview() {
  const { id } = useDocumentInfo()
  const pathname = useFormFields(([fields]) => fields.photoPathname?.value)

  if (!id || !pathname) {
    return (
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Photo</p>
        <p style={{ opacity: 0.7 }}>Aucune photo enregistrée.</p>
      </div>
    )
  }

  const src = `/api/concours/photo/${id}`
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontWeight: 600, marginBottom: 8 }}>Photo</p>
      <a href={src} target="_blank" rel="noopener">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Photo du candidat"
          style={{
            width: 180,
            height: 220,
            objectFit: 'cover',
            borderRadius: 12,
            border: '1px solid var(--theme-elevation-150)',
          }}
        />
      </a>
      <p style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
        Cliquer pour ouvrir en grand. Photo privée, visible uniquement par le comité.
      </p>
    </div>
  )
}
