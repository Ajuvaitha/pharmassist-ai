import { useState } from 'react';
import type { Patient, Prescription } from '../types';
import StatusPill from '../components/StatusPill';

interface PatientDetailPageProps {
  patient: Patient;
  onBack: () => void;
  onStopPrescription: (patientId: string, rxId: string, reason: string) => void;
}

const STOP_REASONS = [
  'Treatment complete',
  'Adverse reaction',
  'Toxicity suspected',
  'Switched to alternative',
  'Patient refusal',
  'Clinical decision',
];

const FOOD_LABEL: Record<string, string> = {
  'before-food': 'Before food',
  'after-food': 'After food',
  'with-food': 'With food',
  'not-applicable': '—',
};

export default function PatientDetailPage({ patient, onBack, onStopPrescription }: PatientDetailPageProps) {
  const [stoppingRx, setStoppingRx] = useState<Prescription | null>(null);
  const [stopReason, setStopReason] = useState(STOP_REASONS[0]);
  const [stopNotes, setStopNotes] = useState('');

  const activePrescriptions = patient.prescriptions.filter(rx => rx.status === 'active');
  const pastPrescriptions = patient.prescriptions.filter(rx => rx.status !== 'active');
  const doctorName = patient.prescriptions[0]?.prescribedBy ?? null;

  const handleStop = () => {
    if (!stoppingRx) return;
    onStopPrescription(patient.id, stoppingRx.id, `${stopReason}${stopNotes ? ' — ' + stopNotes : ''}`);
    setStoppingRx(null);
    setStopNotes('');
  };

  return (
    <div style={{ maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Back nav */}
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 0, fontSize: 13, color: '#64748B', fontFamily: 'inherit',
          width: 'fit-content',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7l5 5" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back to Patients
      </button>

      {/* Patient header card */}
      <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8, overflow: 'hidden' }}>
        {/* Accent strip */}
        <div style={{ height: 4, background: '#0AADA8' }} />

        <div style={{ padding: '20px 24px' }}>
          {/* Name + MRN row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>
                {patient.name}
              </h1>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, color: '#64748B', marginTop: 3 }}>
                {patient.mrn}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {activePrescriptions.length > 0 && (
                <span style={{
                  fontSize: 12, padding: '4px 10px', borderRadius: 5,
                  background: '#DBEAFE', color: '#2563EB', fontWeight: 600,
                }}>
                  {activePrescriptions.length} active Rx
                </span>
              )}
              <StatusPill status="active" label="Admitted" />
            </div>
          </div>

          {/* Detail grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '14px 24px',
            paddingTop: 16,
            borderTop: '1px solid #D9E8EF',
          }}>
            <InfoField label="Date of Birth" value={patient.dateOfBirth} mono />
            <InfoField label="Gender" value={patient.gender} />
            <InfoField label="Ward" value={patient.ward} />
            <InfoField label="Bed" value={patient.bed} mono />
            <InfoField label="Admission Date" value={patient.admissionDate} mono />
            <InfoField label="Phone" value={patient.phone || '—'} />
            {doctorName && <InfoField label="Prescribing Doctor" value={doctorName} />}
            {patient.allergies && patient.allergies !== 'None known' ? (
              <div>
                <div style={fieldLabel}>Allergies</div>
                <div style={{ fontSize: 13, color: '#DC2626', fontWeight: 600, background: '#FEE2E2', padding: '3px 8px', borderRadius: 4, display: 'inline-block' }}>
                  {patient.allergies}
                </div>
              </div>
            ) : (
              <InfoField label="Allergies" value="None known" />
            )}
          </div>

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #D9E8EF' }}>
            <div style={fieldLabel}>Diagnosis</div>
            <div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.5 }}>{patient.diagnosis}</div>
          </div>
        </div>
      </div>

      {/* Active prescriptions */}
      {activePrescriptions.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '13px 24px', borderBottom: '1px solid #D9E8EF', background: '#F0F9FB', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Active Prescriptions
            </span>
            <span style={{
              fontSize: 11, fontFamily: 'IBM Plex Mono, monospace',
              background: '#DBEAFE', color: '#2563EB', padding: '1px 6px', borderRadius: 4,
            }}>
              {activePrescriptions.length}
            </span>
          </div>

          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 110px 150px 150px 180px 80px',
            padding: '9px 24px',
            borderBottom: '1px solid #D9E8EF',
            background: '#FAFBFC',
          }}>
            {['Drug / Dose / Route', 'Food Timing', 'Time of Day', 'Prescribed At', 'Progress', ''].map((h, i) => (
              <span key={i} style={{
                fontSize: 11, fontWeight: 600, color: '#64748B',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {h}
              </span>
            ))}
          </div>

          {activePrescriptions.map((rx, i) => {
            const pct = Math.min(100, Math.round((rx.currentDay / rx.durationDays) * 100));
            const nearEnd = pct >= 80;
            return (
              <div
                key={rx.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 110px 150px 150px 180px 80px',
                  padding: '14px 24px',
                  borderBottom: i < activePrescriptions.length - 1 ? '1px solid #D9E8EF' : 'none',
                  alignItems: 'center',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Col 1: Drug */}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{rx.drug}</div>
                  <div style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#94A3B8', marginTop: 2 }}>
                    {rx.dose} · {rx.route} · {rx.frequency}
                  </div>
                  {rx.notes && (
                    <div style={{
                      marginTop: 6, fontSize: 12, color: '#64748B', lineHeight: 1.5,
                      background: '#F0F9FB', border: '1px solid #D9E8EF',
                      borderRadius: 4, padding: '4px 8px',
                    }}>
                      {rx.notes}
                    </div>
                  )}
                </div>

                {/* Col 2: Food timing */}
                <div>
                  <span style={{
                    fontSize: 12, padding: '3px 8px', borderRadius: 4, display: 'inline-block',
                    background: rx.foodTiming === 'not-applicable' ? '#F0F9FB' : '#FEF3C7',
                    color: rx.foodTiming === 'not-applicable' ? '#94A3B8' : '#D97706',
                    fontWeight: rx.foodTiming === 'not-applicable' ? 400 : 500,
                  }}>
                    {FOOD_LABEL[rx.foodTiming]}
                  </span>
                </div>

                {/* Col 3: Time of day */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {rx.timeOfDay.map(t => (
                    <span key={t} style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 4,
                      background: '#D4F0EF', color: '#0AADA8', fontWeight: 500,
                    }}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </span>
                  ))}
                </div>

                {/* Col 4: Prescribed at */}
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#64748B' }}>
                  {rx.prescribedAt}
                </div>

                {/* Col 5: Progress */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ fontWeight: 500, color: '#0F172A' }}>Day {rx.currentDay} of {rx.durationDays}</span>
                    <span style={{ color: nearEnd ? '#D97706' : '#64748B' }}>{pct}%</span>
                  </div>
                  <div style={{ height: 6, background: '#D9E8EF', borderRadius: 3 }}>
                    <div style={{
                      height: '100%', borderRadius: 3, transition: 'width 0.3s',
                      background: nearEnd ? '#D97706' : '#0AADA8',
                      width: `${pct}%`,
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                    {rx.durationDays - rx.currentDay} day{rx.durationDays - rx.currentDay !== 1 ? 's' : ''} remaining
                  </div>
                </div>

                {/* Col 6: Stop */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setStoppingRx(rx)}
                    style={{
                      padding: '6px 12px', border: '1px solid #F0C4C4', borderRadius: 5,
                      background: '#fff', color: '#DC2626', fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FEE2E2')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    Stop Order
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Past prescriptions */}
      {pastPrescriptions.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '13px 24px', borderBottom: '1px solid #D9E8EF', background: '#F0F9FB' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Stopped / Past Prescriptions ({pastPrescriptions.length})
            </span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 110px 150px 150px 80px',
            padding: '9px 24px',
            borderBottom: '1px solid #D9E8EF',
            background: '#FAFBFC',
          }}>
            {['Drug / Dose', 'Food Timing', 'Time of Day', 'Prescribed At', 'Status'].map((h, i) => (
              <span key={i} style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
            ))}
          </div>
          {pastPrescriptions.map((rx, i) => (
            <div
              key={rx.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr 110px 150px 150px 80px',
                padding: '12px 24px',
                borderBottom: i < pastPrescriptions.length - 1 ? '1px solid #D9E8EF' : 'none',
                alignItems: 'center',
                opacity: 0.6,
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>{rx.drug}</div>
                <div style={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', color: '#94A3B8', marginTop: 1 }}>
                  {rx.dose} · {rx.route} · {rx.frequency}
                </div>
                {rx.stopReason && (
                  <div style={{
                    marginTop: 5, fontSize: 11, color: '#DC2626',
                    background: '#FEE2E2', padding: '2px 7px', borderRadius: 4, display: 'inline-block',
                  }}>
                    {rx.stopReason}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 12, color: '#64748B' }}>{FOOD_LABEL[rx.foodTiming]}</span>
              <span style={{ fontSize: 12, color: '#64748B' }}>
                {rx.timeOfDay.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')}
              </span>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#64748B' }}>{rx.prescribedAt}</span>
              <StatusPill status={rx.status} />
            </div>
          ))}
        </div>
      )}

      {activePrescriptions.length === 0 && pastPrescriptions.length === 0 && (
        <div style={{
          background: '#fff', border: '1px dashed #D9E8EF', borderRadius: 8,
          padding: '40px 24px', textAlign: 'center', fontSize: 13, color: '#64748B',
        }}>
          No prescriptions on record. A doctor can add prescriptions from the Patients page.
        </div>
      )}

      {/* Stop order modal */}
      {stoppingRx && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(27,34,44,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{
            background: '#fff', border: '1px solid #D9E8EF', borderRadius: 10,
            padding: 28, width: 420, boxShadow: '0 8px 32px rgba(27,34,44,0.12)',
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>Stop Order</h2>
            <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 20px' }}>
              {stoppingRx.drug} — {patient.name}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={mLbl}>Reason for stopping</label>
                <select value={stopReason} onChange={e => setStopReason(e.target.value)} style={mInp}>
                  {STOP_REASONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={mLbl}>Notes (optional)</label>
                <textarea
                  value={stopNotes}
                  onChange={e => setStopNotes(e.target.value)}
                  rows={3}
                  placeholder="Additional clinical notes..."
                  style={{ ...mInp, resize: 'vertical', minHeight: 80 }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setStoppingRx(null); setStopNotes(''); }}
                style={{ padding: '8px 16px', border: '1px solid #D9E8EF', borderRadius: 6, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#0F172A' }}
              >
                Cancel
              </button>
              <button
                onClick={handleStop}
                style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Confirm Stop Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={fieldLabel}>{label}</div>
      <div style={{ fontSize: 13, color: '#0F172A', fontFamily: mono ? 'IBM Plex Mono, monospace' : undefined }}>
        {value}
      </div>
    </div>
  );
}

const fieldLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#94A3B8',
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4,
};
const mLbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 500, color: '#64748B', marginBottom: 5 };
const mInp: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #D9E8EF', borderRadius: 6,
  fontSize: 13, color: '#0F172A', background: '#fff', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
