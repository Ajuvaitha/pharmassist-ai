import type { DrugSearchResult } from '@pharmassist/shared'

interface Props {
  results: DrugSearchResult[]
  isLoading: boolean
  onSelect: (r: DrugSearchResult) => void
  onDismiss: () => void
}

const MATCH_LABEL: Record<DrugSearchResult['matchType'], string> = {
  exact: 'Exact match', brand: 'Brand match', prefix: 'Prefix match',
  substring: 'Contains', token: 'Root match', phonetic: 'Sounds like', fuzzy: 'Closest match',
}

export default function MedicineSuggestPopup({ results, isLoading, onSelect, onDismiss }: Props) {
  return (
    // Non-blocking side panel: no backdrop, so the canvas/mic stay usable while
    // it live-refreshes with the latest recognized text.
    <div style={panel}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Is this the medicine?</h3>
        <button onClick={onDismiss} aria-label="Close" style={closeBtn}>×</button>
      </div>
      {isLoading && <p style={muted}>Searching…</p>}
      {!isLoading && results.length === 0 && <p style={muted}>No match found. Keep writing…</p>}
      {results.map((r, i) => (
        <button key={r.id} onClick={() => onSelect(r)} style={row(i === 0)}>
          <span style={{ fontWeight: i === 0 ? 700 : 500 }}>{r.label}</span>
          <span style={badge}>{MATCH_LABEL[r.matchType]}</span>
        </button>
      ))}
    </div>
  )
}

const panel: React.CSSProperties = { position: 'fixed', top: 80, right: 16, bottom: 16, width: 'min(320px, 90vw)', background: '#fff', borderRadius: 10, border: '1px solid #D9E8EF', boxShadow: '0 8px 24px rgba(15,23,42,0.12)', padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, zIndex: 50 }
const closeBtn: React.CSSProperties = { border: 'none', background: 'transparent', fontSize: 20, lineHeight: 1, cursor: 'pointer', color: '#64748B', padding: '0 4px' }
const muted: React.CSSProperties = { fontSize: 13, color: '#64748B' }
const row = (top: boolean): React.CSSProperties => ({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, border: `1px solid ${top ? '#0AADA8' : '#D9E8EF'}`, background: top ? '#F0FBFA' : '#fff', cursor: 'pointer', textAlign: 'left' })
const badge: React.CSSProperties = { fontSize: 11, color: '#0AADA8', fontWeight: 600, whiteSpace: 'nowrap' }
