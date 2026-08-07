import { useCallback, useState } from 'react'
import type { DrugSearchResult, CreatePrescriptionRequest } from '@pharmassist/shared'
import { usePatients } from '../api/patients'
import { useCreatePrescription } from '../api/prescriptions'
import { useMe } from '../api/auth'
import { useDrugSearch } from '../api/drugs'
import { searchResultToInitialRx } from '../lib/mapSearchResult'
import VoiceAgent from '../components/VoiceAgent'
import Whiteboard from '../components/Whiteboard'
import MedicineSuggestPopup from '../components/MedicineSuggestPopup'
import PrescriptionForm from '../components/PrescriptionForm'
import { ErrorPanel, LoadingPanel } from '../components/AsyncState'

type Mode = 'speak' | 'write'

export default function PrescriptionWriterPage() {
  const { data: me } = useMe()
  const patientsQuery = usePatients()
  const createRx = useCreatePrescription()

  const [patientId, setPatientId] = useState('')
  const [mode, setMode] = useState<Mode>('speak')
  const [query, setQuery] = useState('')          // recognized text feeding the search
  const [showSuggest, setShowSuggest] = useState(false)
  const [confirmed, setConfirmed] = useState<DrugSearchResult | null>(null) // opens Popup 2
  const [savedCount, setSavedCount] = useState(0)

  const searchQuery = useDrugSearch(query)

  const onRecognize = useCallback((text: string) => {
    if (!text.trim()) return
    setQuery(text.trim())
    setShowSuggest(true)
  }, [])

  const handleSelectCandidate = (r: DrugSearchResult) => {
    setShowSuggest(false)
    setConfirmed(r)               // open Popup 2 (details)
  }

  const handleSave = (rx: CreatePrescriptionRequest) => {
    createRx.mutate(
      { patientId, input: rx },
      {
        onSuccess: () => {
          setConfirmed(null)
          setQuery('')
          setSavedCount((n) => n + 1)
        },
      },
    )
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>Prescription Writer</h1>

      {/* Patient select */}
      {patientsQuery.isLoading && <LoadingPanel label="Loading patients…" />}
      {patientsQuery.error && <ErrorPanel error={patientsQuery.error} />}
      {!patientsQuery.isLoading && !patientsQuery.error && (
        <select value={patientId} onChange={(e) => setPatientId(e.target.value)} style={select}>
          <option value="">Select a patient…</option>
          {(patientsQuery.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.name} — {p.mrn}</option>
          ))}
        </select>
      )}

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setMode('speak')} style={tab(mode === 'speak')}>Speak</button>
        <button onClick={() => setMode('write')} style={tab(mode === 'write')}>Write</button>
      </div>

      {/* Input surface (disabled until a patient is chosen) */}
      <div style={{ opacity: patientId ? 1 : 0.5, pointerEvents: patientId ? 'auto' : 'none' }}>
        {mode === 'speak'
          ? <VoiceAgent onRecognize={onRecognize} />
          : <Whiteboard onWordSettled={(w) => onRecognize(w.label)} />}
      </div>

      {savedCount > 0 && (
        <p style={{ fontSize: 13, color: '#0AADA8' }}>{savedCount} prescription(s) added.</p>
      )}

      {/* Popup 1: confirm drug */}
      {showSuggest && (
        <MedicineSuggestPopup
          results={searchQuery.data ?? []}
          isLoading={searchQuery.isLoading}
          onSelect={handleSelectCandidate}
          onDismiss={() => setShowSuggest(false)}
        />
      )}

      {/* Popup 2: prescription details */}
      {confirmed && (
        <div style={overlay}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 20, width: 'min(560px, 94vw)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>Prescription details</h3>
            <PrescriptionForm
              prescribedBy={me?.displayName ?? ''}
              lockedDrug={{ id: confirmed.id, label: confirmed.label }}
              initial={searchResultToInitialRx(confirmed)}
              onSave={handleSave}
              onCancel={() => setConfirmed(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

const select: React.CSSProperties = { padding: '10px 12px', borderRadius: 8, border: '1px solid #D9E8EF', fontSize: 14 }
const tab = (active: boolean): React.CSSProperties => ({ padding: '8px 18px', borderRadius: 8, border: `1px solid ${active ? '#0AADA8' : '#D9E8EF'}`, background: active ? '#0AADA8' : '#fff', color: active ? '#fff' : '#0F172A', cursor: 'pointer', fontWeight: 600, fontSize: 13 })
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }
