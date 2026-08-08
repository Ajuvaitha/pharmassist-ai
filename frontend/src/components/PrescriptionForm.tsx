import { useState } from 'react';
import type { FoodTiming, MedRoute, Prescription, TimeOfDay } from '../types';
import { FREQUENCIES, type CreatePrescriptionRequest, type Frequency } from '@pharmassist/shared';
import { useDrugs } from '../api/drugs';

interface PrescriptionFormProps {
  initial?: Partial<Prescription>;
  prescribedBy: string;
  lockedDrug?: { id: string; label: string };
  onSave: (rx: CreatePrescriptionRequest) => void;
  onCancel: () => void;
}

const ROUTES: MedRoute[] = ['Oral', 'IV', 'IM', 'SC', 'Topical', 'Inhaled'];
const FOOD_TIMINGS: { value: FoodTiming; label: string }[] = [
  { value: 'before-food', label: 'Before food' },
  { value: 'after-food', label: 'After food' },
  { value: 'with-food', label: 'With food' },
  { value: 'not-applicable', label: 'Not applicable' },
];
const TIMES_OF_DAY: { value: TimeOfDay; label: string }[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'night', label: 'Night' },
];

export default function PrescriptionForm({ initial, lockedDrug, onSave, onCancel }: PrescriptionFormProps) {
  const { data: drugs } = useDrugs();
  const [drugId, setDrugId] = useState(lockedDrug?.id ?? initial?.drugId ?? '');
  const [dose, setDose] = useState(initial?.dose ?? '');
  const [route, setRoute] = useState<MedRoute>(initial?.route ?? 'Oral');
  const [frequency, setFrequency] = useState<Frequency>(initial?.frequency ?? 'OD');
  const [foodTiming, setFoodTiming] = useState<FoodTiming>(initial?.foodTiming ?? 'not-applicable');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay[]>(initial?.timeOfDay ?? ['morning']);
  const [durationDays, setDurationDays] = useState(initial?.durationDays?.toString() ?? '7');
  const [startDate, setStartDate] = useState(initial?.startDate ?? new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [validationError, setValidationError] = useState('');

  const toggleTime = (t: TimeOfDay) => {
    setTimeOfDay(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drugId) {
      setValidationError('Please select a drug.');
      return;
    }
    if (!dose.trim()) {
      setValidationError('Please enter a dose for this prescription.');
      return;
    }
    setValidationError('');
    onSave({
      drugId,
      dose: dose.trim(),
      route,
      frequency,
      foodTiming,
      timeOfDay,
      startDate,
      durationDays: parseInt(durationDays) || 7,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {validationError && (
        <div style={{ padding: '8px 12px', borderRadius: 6, background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', fontSize: 13, fontWeight: 500 }}>
          {validationError}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 12 }}>
        {lockedDrug ? (
          <div>
            <label style={lbl}>Drug</label>
            <div style={{ ...inp, display: 'flex', alignItems: 'center', background: '#F0F9FB' }}>
              {lockedDrug.label}
            </div>
          </div>
        ) : (
          <div>
            <label style={lbl}>Drug</label>
            <select
              required
              value={drugId}
              onChange={e => {
                const id = e.target.value;
                setDrugId(id);
                setValidationError('');
                const selected = (drugs ?? []).find(d => d.id === id);
                if (selected?.strength && !dose) {
                  setDose(selected.strength);
                }
              }}
              style={inp}
            >
              <option value="">Select a drug…</option>
              {(drugs ?? []).map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
        )}
        <div>
          <label style={lbl}>Dose</label>
          <input
            required
            value={dose}
            onChange={e => setDose(e.target.value)}
            placeholder="e.g. 500mg"
            style={inp}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <label style={lbl}>Route</label>
          <select value={route} onChange={e => setRoute(e.target.value as MedRoute)} style={inp}>
            {ROUTES.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Frequency</label>
          <select value={frequency} onChange={e => setFrequency(e.target.value as Frequency)} style={inp}>
            {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Duration (days)</label>
          <input
            type="number"
            min={1}
            max={365}
            value={durationDays}
            onChange={e => setDurationDays(e.target.value)}
            style={inp}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={lbl}>Food timing</label>
          <select value={foodTiming} onChange={e => setFoodTiming(e.target.value as FoodTiming)} style={inp}>
            {FOOD_TIMINGS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={inp}
          />
        </div>
      </div>

      <div>
        <label style={lbl}>Time of day</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          {TIMES_OF_DAY.map(t => {
            const active = timeOfDay.includes(t.value);
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => toggleTime(t.value)}
                style={{
                  padding: '5px 14px',
                  border: '1px solid',
                  borderColor: active ? '#0AADA8' : '#D9E8EF',
                  borderRadius: 5,
                  background: active ? '#D4F0EF' : '#fff',
                  color: active ? '#0AADA8' : '#64748B',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.1s',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label style={lbl}>Notes / special instructions</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="e.g. Take with a full glass of water. Monitor renal function."
          style={{ ...inp, resize: 'vertical', minHeight: 60 }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
        <button type="button" onClick={onCancel} style={ghostBtn}>Cancel</button>
        <button type="submit" style={primaryBtn}>
          {initial?.drug ? 'Save Changes' : 'Add Prescription'}
        </button>
      </div>
    </form>
  );
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500, color: '#64748B', marginBottom: 5,
};
const inp: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #D9E8EF',
  borderRadius: 6,
  fontSize: 13,
  color: '#0F172A',
  background: '#fff',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
const primaryBtn: React.CSSProperties = {
  padding: '8px 18px',
  border: 'none',
  borderRadius: 6,
  background: '#0AADA8',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const ghostBtn: React.CSSProperties = {
  padding: '8px 14px',
  border: '1px solid #D9E8EF',
  borderRadius: 6,
  background: '#fff',
  color: '#0F172A',
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
