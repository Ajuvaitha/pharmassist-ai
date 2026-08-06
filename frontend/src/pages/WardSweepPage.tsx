import { useState } from 'react';
import { WARDS } from '../data';
import type { Patient } from '../types';
import StatusPill from '../components/StatusPill';

interface WardSweepPageProps {
  patients: Patient[];
}

function buildPatientList(wardShortName: string, patients: Patient[]) {
  return patients
    .filter(p => p.ward === wardShortName)
    .map(p => ({
      patientId: p.id,
      name: p.name,
      mrn: p.mrn,
      bed: p.bed,
      admissionDate: p.admissionDate,
      diagnosis: p.diagnosis,
      allergies: p.allergies,
      medicines: p.prescriptions
        .filter(rx => rx.status === 'active')
        .map(rx => ({
          drug: rx.drug,
          dose: rx.dose,
          route: rx.route,
          frequency: rx.frequency,
          foodTiming: rx.foodTiming,
          timeOfDay: rx.timeOfDay,
          treatmentDay: `Day ${rx.currentDay} of ${rx.durationDays}`,
          qty: rx.timeOfDay.length || (rx.frequency === 'QDS' ? 4 : rx.frequency === 'TDS' ? 3 : rx.frequency === 'BD' ? 2 : 1),
        })),
    }));
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="6" stroke="#16A34A" strokeWidth="1.3"/>
      <path d="M4.5 7l2 2 3.5-3.5" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const FOOD: Record<string, string> = {
  'before-food': 'Before food', 'after-food': 'After food',
  'with-food': 'With food', 'not-applicable': '—',
};

export default function WardSweepPage({ patients }: WardSweepPageProps) {
  const [wardSearch, setWardSearch] = useState('');
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientState, setPatientState] = useState<Record<string, 'confirming' | 'dispensed'>>({});

  const filteredWards = WARDS.filter(w =>
    !wardSearch || w.name.toLowerCase().includes(wardSearch.toLowerCase())
  );

  const selectedWard = selectedWardId ? WARDS.find(w => w.id === selectedWardId) : null;
  const wardShortName = selectedWard?.name.split(' — ')[0] ?? '';

  const allPatientList = selectedWard ? buildPatientList(wardShortName, patients) : [];
  const pickList = patientSearch
    ? allPatientList.filter(p =>
        p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
        p.mrn.toLowerCase().includes(patientSearch.toLowerCase()) ||
        p.bed.toLowerCase().includes(patientSearch.toLowerCase()) ||
        p.medicines.some(m => m.drug.toLowerCase().includes(patientSearch.toLowerCase()))
      )
    : allPatientList;

  const allDispensed = pickList.length > 0 && pickList.every(p => patientState[p.patientId] === 'dispensed');

  const selectWard = (id: string) => {
    setSelectedWardId(id);
    setExpanded(null);
    setPatientSearch('');
    setPatientState({});
  };

  const dispense = (id: string) => setPatientState(prev => ({ ...prev, [id]: 'dispensed' }));
  const startConfirm = (id: string) => setPatientState(prev => ({ ...prev, [id]: 'confirming' }));
  const cancelConfirm = (id: string) => {
    setPatientState(prev => { const next = { ...prev }; delete next[id]; return next; });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1060 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>
            Ward Sweep & Pickup
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
            Select a ward to view admitted patients and dispense medications
          </p>
        </div>
        {selectedWard && (
          <button
            onClick={() => { setSelectedWardId(null); setPatientState({}); setExpanded(null); }}
            style={{
              padding: '7px 14px', border: '1px solid #D9E8EF', borderRadius: 6,
              background: '#fff', color: '#64748B', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ← All Wards
          </button>
        )}
      </div>

      {/* Ward selection view */}
      {!selectedWard && (
        <>
          {/* Ward search */}
          <input
            type="search"
            placeholder="Search ward by name or specialty..."
            value={wardSearch}
            onChange={e => setWardSearch(e.target.value)}
            style={{
              width: '100%', padding: '9px 14px', border: '1px solid #D9E8EF',
              borderRadius: 8, fontSize: 13, color: '#0F172A', outline: 'none',
              fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box',
            }}
          />

          {/* Ward cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {filteredWards.map(w => {
              const wardPts = patients.filter(p => p.ward === w.name.split(' — ')[0]);
              const totalPts = wardPts.length;
              const totalActiveRx = wardPts.reduce((s, p) => s + p.prescriptions.filter(rx => rx.status === 'active').length, 0);
              const dispensedPts = w.sweepStatus === 'dispensed' ? totalPts : 0;
              const pendingPts = totalPts - dispensedPts;

              return (
                <button
                  key={w.id}
                  onClick={() => selectWard(w.id)}
                  style={{
                    background: '#fff', border: '1px solid #D9E8EF',
                    borderRadius: 10, padding: '18px 20px',
                    textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'box-shadow 0.12s, border-color 0.12s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(10,173,168,0.1)';
                    e.currentTarget.style.borderColor = '#0AADA8';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = '#D9E8EF';
                  }}
                >
                  {/* Ward name */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{w.name.split(' — ')[0]}</div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{w.name.split(' — ')[1] ?? ''}</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                      <path d="M6 12l4-4-4-4" stroke="#0AADA8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      { label: 'Total Patients', value: totalPts, color: '#0F172A', bg: '#F0F9FB' },
                      { label: 'Pending', value: pendingPts, color: '#D97706', bg: '#FEF3C7' },
                      { label: 'Dispensed', value: dispensedPts, color: '#16A34A', bg: '#DCFCE7' },
                    ].map(stat => (
                      <div key={stat.label} style={{ background: stat.bg, borderRadius: 6, padding: '8px 10px' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: stat.color, fontVariantNumeric: 'tabular-nums' }}>{stat.value}</div>
                        <div style={{ fontSize: 10, color: '#64748B', marginTop: 1 }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {totalActiveRx > 0 && (
                    <div style={{ marginTop: 12, fontSize: 12, color: '#64748B' }}>
                      <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: '#2563EB', fontWeight: 600 }}>{totalActiveRx}</span>
                      {' '}active prescription{totalActiveRx !== 1 ? 's' : ''} to dispense
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {filteredWards.length === 0 && (
            <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: '#64748B' }}>
              No wards match "{wardSearch}".
            </div>
          )}
        </>
      )}

      {/* Ward patient view */}
      {selectedWard && (
        <>
          {/* Ward header card */}
          <div style={{
            background: '#0AADA8', borderRadius: 10, padding: '16px 22px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{selectedWard.name.split(' — ')[0]}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{selectedWard.name.split(' — ')[1] ?? ''}</div>
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              {[
                { label: 'Patients', value: allPatientList.length, color: '#fff' },
                { label: 'Pending', value: allPatientList.filter(p => patientState[p.patientId] !== 'dispensed').length, color: '#FEF3C7' },
                { label: 'Dispensed', value: allPatientList.filter(p => patientState[p.patientId] === 'dispensed').length, color: '#A7F3D0' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Patient search */}
          <input
            type="search"
            placeholder="Search patient by name, MRN, bed, or drug..."
            value={patientSearch}
            onChange={e => setPatientSearch(e.target.value)}
            style={{
              width: '100%', padding: '9px 14px', border: '1px solid #D9E8EF',
              borderRadius: 8, fontSize: 13, color: '#0F172A', outline: 'none',
              fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box',
            }}
          />

          {/* Patient list */}
          <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 10, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 140px 60px 50px 180px 32px',
              padding: '10px 20px',
              borderBottom: '1px solid #D9E8EF',
              background: '#F0F9FB',
            }}>
              {['Patient', 'MRN', 'Bed', 'Rx', 'Action', ''].map((h, i) => (
                <span key={i} style={{
                  fontSize: 11, fontWeight: 600, color: '#64748B',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  textAlign: i === 3 ? 'right' : 'left',
                }}>
                  {h}
                </span>
              ))}
            </div>

            {pickList.length === 0 && (
              <div style={{ padding: '28px 20px', fontSize: 13, color: '#64748B', textAlign: 'center' }}>
                {patientSearch ? `No patients match "${patientSearch}".` : 'No patients admitted to this ward.'}
              </div>
            )}

            {pickList.map((patient, pi) => {
              const state = patientState[patient.patientId];
              const isDispensed = state === 'dispensed';
              const isConfirming = state === 'confirming';
              const isExpanded = expanded === patient.patientId;
              const hasRx = patient.medicines.length > 0;

              return (
                <div key={patient.patientId} style={{
                  borderBottom: pi < pickList.length - 1 ? '1px solid #D9E8EF' : 'none',
                  background: isDispensed ? '#F0FFF8' : 'transparent',
                }}>
                  {/* Patient row */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 140px 60px 50px 180px 32px',
                    padding: '13px 20px',
                    alignItems: 'center',
                  }}>
                    {/* Name + diagnosis */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 14, fontWeight: 600,
                          color: isDispensed ? '#64748B' : '#0F172A',
                          textDecoration: isDispensed ? 'line-through' : 'none',
                          textDecorationColor: '#94A3B8',
                        }}>
                          {patient.name}
                        </span>
                        {patient.allergies && patient.allergies !== 'None known' && (
                          <span style={{ fontSize: 10, color: '#DC2626', background: '#FEE2E2', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>ALLERGY</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{patient.diagnosis}</div>
                    </div>

                    <span style={{ fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>
                      {patient.mrn}
                    </span>
                    <span style={{ fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>
                      {patient.bed}
                    </span>
                    <span style={{ fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', color: hasRx ? '#2563EB' : '#94A3B8', textAlign: 'right', fontWeight: hasRx ? 600 : 400 }}>
                      {patient.medicines.length}
                    </span>

                    {/* Per-patient dispense action */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isDispensed ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <CheckIcon />
                          <StatusPill status="dispensed" label="Dispensed & Billed" />
                        </div>
                      ) : isConfirming ? (
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => cancelConfirm(patient.patientId)} style={ghostBtn}>Cancel</button>
                          <button onClick={() => dispense(patient.patientId)} style={confirmBtn}>Confirm & Bill</button>
                        </div>
                      ) : hasRx ? (
                        <button onClick={() => startConfirm(patient.patientId)} style={dispenseBtn}>
                          Dispense & Bill
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: '#94A3B8' }}>No active Rx</span>
                      )}
                    </div>

                    {/* Expand toggle */}
                    <button
                      onClick={() => setExpanded(isExpanded ? null : patient.patientId)}
                      style={{ background: 'none', border: 'none', cursor: hasRx ? 'pointer' : 'default', color: hasRx ? '#64748B' : '#CBD5E1', fontSize: 11, textAlign: 'right', padding: 0 }}
                    >
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  </div>

                  {/* Confirmation prompt */}
                  {isConfirming && (
                    <div style={{
                      margin: '0 20px 12px',
                      padding: '12px 16px',
                      background: '#FEF3C7',
                      border: '1px solid #FDE68A',
                      borderRadius: 6,
                      fontSize: 13,
                      color: '#0F172A',
                    }}>
                      Dispense <strong>{patient.medicines.length} prescription line{patient.medicines.length !== 1 ? 's' : ''}</strong> for <strong>{patient.name}</strong> and auto-bill to their account?
                    </div>
                  )}

                  {/* Expanded medicine list */}
                  {isExpanded && hasRx && (
                    <div style={{ background: '#F8FBFC', padding: '0 20px 14px 44px', borderTop: '1px solid #D9E8EF' }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 70px 60px 120px 100px 44px',
                        padding: '8px 0 6px',
                      }}>
                        {['Drug / Times', 'Dose', 'Freq.', 'Food Timing', 'Day', 'Qty'].map((h, i) => (
                          <span key={i} style={{
                            fontSize: 10, color: '#94A3B8', fontWeight: 600,
                            textTransform: 'uppercase', letterSpacing: '0.03em',
                            textAlign: i === 5 ? 'right' : 'left',
                          }}>
                            {h}
                          </span>
                        ))}
                      </div>
                      {patient.medicines.map((med, mi) => (
                        <div key={mi} style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 70px 60px 120px 100px 44px',
                          padding: '8px 0',
                          borderTop: mi > 0 ? '1px solid #D9E8EF' : 'none',
                          alignItems: 'center',
                        }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: '#0F172A' }}>{med.drug}</div>
                            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>
                              {med.timeOfDay.map((t: string) => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')}
                            </div>
                          </div>
                          <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>{med.dose}</span>
                          <span style={{ fontSize: 12, color: '#64748B' }}>{med.frequency}</span>
                          <span style={{ fontSize: 12, color: '#64748B' }}>{FOOD[med.foodTiming] ?? '—'}</span>
                          <span style={{ fontSize: 12, color: '#64748B' }}>{med.treatmentDay}</span>
                          <span style={{ fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', color: '#0F172A', textAlign: 'right' }}>{med.qty}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {isExpanded && !hasRx && (
                    <div style={{ padding: '10px 20px 14px 44px', fontSize: 12, color: '#94A3B8', borderTop: '1px solid #D9E8EF', background: '#F8FBFC' }}>
                      No active prescriptions for this patient.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Ward complete banner */}
          {allDispensed && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 20px', background: '#DCFCE7',
              border: '1px solid #A7F3D0', borderRadius: 8,
              color: '#16A34A', fontSize: 14, fontWeight: 500,
            }}>
              <CheckIcon />
              All patients dispensed and billed for {wardShortName}.
            </div>
          )}
        </>
      )}
    </div>
  );
}

const dispenseBtn: React.CSSProperties = {
  padding: '5px 12px', border: '1px solid #0AADA8',
  borderRadius: 5, background: '#fff', color: '#0AADA8',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  whiteSpace: 'nowrap', transition: 'all 0.1s',
};

const confirmBtn: React.CSSProperties = {
  padding: '5px 12px', border: 'none', borderRadius: 5,
  background: '#0AADA8', color: '#fff', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
};

const ghostBtn: React.CSSProperties = {
  padding: '5px 10px', border: '1px solid #D9E8EF', borderRadius: 5,
  background: '#fff', color: '#64748B', fontSize: 12, cursor: 'pointer',
  fontFamily: 'inherit', whiteSpace: 'nowrap',
};
