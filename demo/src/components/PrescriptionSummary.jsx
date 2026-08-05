export default function PrescriptionSummary({
  patientName,
  onPatientNameChange,
  doctorName,
  onDoctorNameChange,
  entries,
  onRemoveEntry,
  onExport,
}) {
  return (
    <div className="summary-panel">
      <div className="print-only">
        <div>Date: {new Date().toLocaleDateString()}</div>
      </div>

      <div className="summary-header">
        <label htmlFor="patient-name">Patient name</label>
        <input
          id="patient-name"
          value={patientName}
          onChange={(e) => onPatientNameChange(e.target.value)}
        />

        <label htmlFor="doctor-name">Doctor name</label>
        <input
          id="doctor-name"
          value={doctorName}
          onChange={(e) => onDoctorNameChange(e.target.value)}
        />
      </div>

      <ul className="summary-entries">
        {entries.map((entry) => (
          <li key={entry.id}>
            <div>
              <strong>{entry.medicineName}</strong>
              <div className="summary-entry-detail">
                {entry.frequency} &middot; {entry.dosageQty} &middot; {entry.durationDays} days
                &middot; {entry.timing}
              </div>
            </div>
            <button
              type="button"
              aria-label={`Remove ${entry.medicineName}`}
              onClick={() => onRemoveEntry(entry.id)}
            >
              &times;
            </button>
          </li>
        ))}
      </ul>

      {entries.length > 0 && (
        <button type="button" onClick={onExport}>
          Finalize &amp; Export PDF
        </button>
      )}

      <div className="print-only">
        <p>Doctor&rsquo;s signature: ______________________</p>
      </div>
    </div>
  )
}
