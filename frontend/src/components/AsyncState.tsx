import { ApiError } from '../api/client'

/**
 * Matches the muted empty-state styling the pages already use, so a
 * loading or failed panel does not look foreign next to loaded content.
 */
export function LoadingPanel({ label = 'Loading…' }: { label?: string }) {
  return (
    <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: 13, color: '#64748B' }}>
      {label}
    </div>
  )
}

export function ErrorPanel({ error }: { error: unknown }) {
  const message =
    error instanceof ApiError
      ? error.message
      : 'Could not reach the server. Check your connection and try again.'

  return (
    <div style={{
      padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA',
      borderRadius: 6, fontSize: 13, color: '#DC2626',
    }}>
      {message}
    </div>
  )
}
