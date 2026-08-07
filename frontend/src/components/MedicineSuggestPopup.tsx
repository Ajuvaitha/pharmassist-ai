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
    <div onClick={onDismiss} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>Is this the medicine?</h3>
        {isLoading && <p style={muted}>Searching…</p>}
        {!isLoading && results.length === 0 && <p style={muted}>No match found. Try again.</p>}
        {results.map((r, i) => (
          <button key={r.id} onClick={() => onSelect(r)} style={row(i === 0)}>
            <span style={{ fontWeight: i === 0 ? 700 : 500 }}>{r.label}</span>
            <span style={badge}>{MATCH_LABEL[r.matchType]}</span>
          </button>
        ))}
        <button onClick={onDismiss} style={cancel}>Cancel</button>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }
const card: React.CSSProperties = { background: '#fff', borderRadius: 10, padding: 20, width: 'min(480px, 92vw)', maxHeight: '80vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }
const muted: React.CSSProperties = { fontSize: 13, color: '#64748B' }
const row = (top: boolean): React.CSSProperties => ({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, border: `1px solid ${top ? '#0AADA8' : '#D9E8EF'}`, background: top ? '#F0FBFA' : '#fff', cursor: 'pointer', textAlign: 'left' })
const badge: React.CSSProperties = { fontSize: 11, color: '#0AADA8', fontWeight: 600, whiteSpace: 'nowrap' }
const cancel: React.CSSProperties = { marginTop: 4, padding: '8px 12px', borderRadius: 8, border: '1px solid #D9E8EF', background: '#fff', cursor: 'pointer', fontSize: 13 }
