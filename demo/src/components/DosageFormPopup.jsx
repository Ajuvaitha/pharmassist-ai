import { useState } from 'react'

const FREQUENCIES = ['OD', 'BID', 'TID', 'QID']
const TIMINGS = ['before food', 'after food', 'anytime']

export default function DosageFormPopup({ position, medicine, onConfirm, onCancel }) {
  const [frequency, setFrequency] = useState(medicine.commonFrequency || FREQUENCIES[0])
  const [dosageQty, setDosageQty] = useState(1)
  const [durationDays, setDurationDays] = useState(5)
  const [timing, setTiming] = useState(TIMINGS[0])

  function handleSubmit(event) {
    event.preventDefault()
    onConfirm({
      frequency,
      dosageQty: Number(dosageQty),
      durationDays: Number(durationDays),
      timing,
    })
  }

  return (
    <div className="popup" style={{ left: position.x, top: position.y }}>
      <div className="popup-title">{medicine.name}</div>
      <form onSubmit={handleSubmit}>
        <label htmlFor="dosage-frequency">Frequency</label>
        <select
          id="dosage-frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
        >
          {FREQUENCIES.map((freq) => (
            <option key={freq} value={freq}>
              {freq}
            </option>
          ))}
        </select>

        <label htmlFor="dosage-qty">Dosage quantity</label>
        <input
          id="dosage-qty"
          type="number"
          min="1"
          value={dosageQty}
          onChange={(e) => setDosageQty(e.target.value)}
        />

        <label htmlFor="dosage-duration">Duration (days)</label>
        <input
          id="dosage-duration"
          type="number"
          min="1"
          value={durationDays}
          onChange={(e) => setDurationDays(e.target.value)}
        />

        <label htmlFor="dosage-timing">Timing</label>
        <select id="dosage-timing" value={timing} onChange={(e) => setTiming(e.target.value)}>
          {TIMINGS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <div className="popup-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit">Add to Prescription</button>
        </div>
      </form>
    </div>
  )
}
