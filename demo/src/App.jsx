import { useCallback, useState } from 'react'
import Whiteboard from './components/Whiteboard.jsx'
import MedicineSuggestPopup from './components/MedicineSuggestPopup.jsx'
import DosageFormPopup from './components/DosageFormPopup.jsx'
import PrescriptionSummary from './components/PrescriptionSummary.jsx'
import medicines from './data/medicines.js'
import { matchMedicine, bestMatchClearsThreshold } from './lib/matchMedicine.js'

let nextEntryId = 1

export default function App() {
  const [patientName, setPatientName] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [entries, setEntries] = useState([])
  const [pendingSuggestion, setPendingSuggestion] = useState(null)
  const [pendingDosage, setPendingDosage] = useState(null)

  const handleWordSettled = useCallback((word) => {
    const matches = matchMedicine(word.label, medicines)
    if (!bestMatchClearsThreshold(matches)) return

    setPendingSuggestion({
      position: { x: word.box.x, y: word.box.y + word.box.height + 8 },
      candidates: matches.slice(0, 5),
    })
  }, [])

  function handleSelectCandidate(candidate) {
    setPendingDosage({ position: pendingSuggestion.position, medicine: candidate })
    setPendingSuggestion(null)
  }

  function handleDismissSuggestion() {
    setPendingSuggestion(null)
  }

  function handleConfirmDosage(details) {
    setEntries((prev) => [
      ...prev,
      {
        id: `entry-${nextEntryId++}`,
        medicineName: pendingDosage.medicine.name,
        ...details,
      },
    ])
    setPendingDosage(null)
  }

  function handleCancelDosage() {
    setPendingDosage(null)
  }

  function handleRemoveEntry(id) {
    setEntries((prev) => prev.filter((entry) => entry.id !== id))
  }

  function handleExport() {
    window.print()
  }

  return (
    <div className="app-shell">
      <h1>Whiteboard E-Prescription Demo</h1>
      <div className="app-layout">
        <div className="whiteboard-column">
          <Whiteboard onWordSettled={handleWordSettled} />
          {pendingSuggestion && (
            <MedicineSuggestPopup
              position={pendingSuggestion.position}
              candidates={pendingSuggestion.candidates}
              onSelect={handleSelectCandidate}
              onDismiss={handleDismissSuggestion}
            />
          )}
          {pendingDosage && (
            <DosageFormPopup
              position={pendingDosage.position}
              medicine={pendingDosage.medicine}
              onConfirm={handleConfirmDosage}
              onCancel={handleCancelDosage}
            />
          )}
        </div>
        <PrescriptionSummary
          patientName={patientName}
          onPatientNameChange={setPatientName}
          doctorName={doctorName}
          onDoctorNameChange={setDoctorName}
          entries={entries}
          onRemoveEntry={handleRemoveEntry}
          onExport={handleExport}
        />
      </div>
    </div>
  )
}
