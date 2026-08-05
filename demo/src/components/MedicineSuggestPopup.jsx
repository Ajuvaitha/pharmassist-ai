export default function MedicineSuggestPopup({ position, candidates, onSelect, onDismiss }) {
  return (
    <div className="popup" style={{ left: position.x, top: position.y }}>
      <div className="popup-title">Is this a medicine?</div>
      <ul className="popup-list">
        {candidates.map((candidate) => (
          <li key={candidate.id}>
            <button type="button" onClick={() => onSelect(candidate)}>
              {candidate.name}
              <span className="popup-meta">
                {' '}
                &mdash; {candidate.unitOfMeasure}, usually {candidate.commonFrequency}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="popup-dismiss" onClick={onDismiss}>
        Not a medicine
      </button>
    </div>
  )
}
