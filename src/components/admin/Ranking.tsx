'use client'

import { useCallback, useEffect, useState } from 'react'

type Row = {
  id: string
  candidateNumber?: string
  fullName: string
  churchName: string
  juryScore: number | null
  juryCount: number
  votes?: number
  votePercent?: number
  finalScore?: number
  rank: number
}

type Data = {
  success?: boolean
  message?: string
  preselection?: Row[]
  finale?: Row[]
  totalVotes?: number
}

const cell: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--theme-elevation-100)',
  textAlign: 'left',
}

/** Classement calculé en direct (80 % jury / 20 % public) et classement de la finale. */
export function Ranking() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/concours/admin/classement', { credentials: 'include' })
      setData((await response.json()) as Data)
    } catch {
      setData({ success: false, message: 'Impossible de charger le classement.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div
      style={{
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 12,
        padding: 20,
        margin: '24px 0',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <p style={{ fontWeight: 700, fontSize: 16 }}>Classement calculé</p>
        <button
          type="button"
          className="btn btn--style-secondary btn--size-small"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? 'Calcul…' : 'Recalculer'}
        </button>
      </div>
      <p style={{ opacity: 0.75, margin: '6px 0 14px' }}>
        Note finale = note du jury (moyenne des jurés) × 0,80 + part du vote public × 0,20. En cas
        d’égalité, la note du jury départage. Les trois premiers sont les finalistes proposés.
      </p>
      {data && !data.success && <p style={{ color: 'var(--theme-error-500)' }}>{data.message}</p>}
      {data?.success && (
        <>
          <p style={{ marginBottom: 8 }}>
            Votes valides comptés : <strong>{data.totalVotes ?? 0}</strong>
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  {['Rang', 'Candidat', 'Église', 'Jury /100', 'Jurés', 'Votes', 'Public %', 'Final /100'].map(
                    (heading) => (
                      <th key={heading} style={{ ...cell, fontWeight: 700 }}>
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {(data.preselection || []).map((row) => (
                  <tr key={row.id} style={row.rank <= 3 ? { fontWeight: 700 } : undefined}>
                    <td style={cell}>{row.rank}</td>
                    <td style={cell}>
                      <a href={`/admin/collections/candidatures/${row.id}`}>{row.fullName}</a>
                      <br />
                      <span style={{ opacity: 0.6, fontWeight: 400 }}>{row.candidateNumber}</span>
                    </td>
                    <td style={cell}>{row.churchName}</td>
                    <td style={cell}>{row.juryScore ?? '—'}</td>
                    <td style={cell}>{row.juryCount}</td>
                    <td style={cell}>{row.votes}</td>
                    <td style={cell}>{row.votePercent}</td>
                    <td style={cell}>{row.finalScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.preselection?.length && (
            <p style={{ opacity: 0.7 }}>Aucun candidat au statut « Présélectionné » pour l’instant.</p>
          )}

          <p style={{ fontWeight: 700, fontSize: 16, margin: '24px 0 8px' }}>
            Grande finale (notes du jury, phase « Grande finale »)
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {['Rang', 'Finaliste', 'Église', 'Jury /100', 'Jurés'].map((heading) => (
                  <th key={heading} style={{ ...cell, fontWeight: 700 }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.finale || []).map((row) => (
                <tr key={row.id}>
                  <td style={cell}>{row.rank}</td>
                  <td style={cell}>{row.fullName}</td>
                  <td style={cell}>{row.churchName}</td>
                  <td style={cell}>{row.juryScore ?? '—'}</td>
                  <td style={cell}>{row.juryCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

/** Rappel des règles du vote dans l’onglet « Vote du public ». */
export function VoteHelp() {
  return (
    <div style={{ opacity: 0.8, margin: '16px 0', lineHeight: 1.6 }}>
      <p>
        Le public vote sur la fiche de chaque candidat publié, après confirmation par un code à 6
        chiffres envoyé par e-mail : <strong>un seul vote par adresse e-mail</strong>.
      </p>
      <p>
        « Vote ouvert » active les boutons de vote. Si vous renseignez des dates, l’ouverture et la
        clôture se font automatiquement. Les votes se consultent dans « Votes du public » ; un vote
        suspect passé en « Rejeté » n’est plus compté.
      </p>
    </div>
  )
}
