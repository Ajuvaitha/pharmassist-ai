import { useState } from 'react';
import type { Patient, Prescription } from '../types';
import type { CreatePrescriptionRequest } from '@pharmassist/shared';
import { usePatients } from '../api/patients';
import { useCreatePrescription, useUpdatePrescription } from '../api/prescriptions';
import { ErrorPanel, LoadingPanel } from '../components/AsyncState';
import StatusPill from '../components/StatusPill';
import PrescriptionForm from '../components/PrescriptionForm';

interface DoctorPatientsPageProps {
  doctorName: string;
}

export default function DoctorPatientsPage({ doctorName }: DoctorPatientsPageProps) {
  const { data, isLoading, error } = usePatients();
  const createRx = useCreatePrescription();
  const updateRx = useUpdatePrescription();
  const patients = data ?? [];

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'add' | 'edit'>(  'view');
  const [editingRx, setEditingRx] = useState<Prescription | null>(null);

  const filtered = patients.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.mrn.toLowerCase().includes(search.toLowerCase()) ||
    p.ward.toLowerCase().includes(search.toLowerCase())
  );

  const selectedPatient = patients.find(p => p.id === selectedId) ?? null;

  const handleSelect = (p: Patient) => { setSelectedId(p.id); setMode('view'); };

  const handleAdd = (rx: CreatePrescriptionRequest) => {
    if (!selectedPatient) return;
    createRx.mutate(
      { patientId: selectedPatient.id, input: rx },
      { onSuccess: () => { setMode('view'); setEditingRx(null); } },
    );
  };

  const handleEdit = (rx: CreatePrescriptionRequest) => {
    if (!editingRx) return;
    updateRx.mutate(
      { id: editingRx.id, input: rx },
      { onSuccess: () => { setMode('view'); setEditingRx(null); } },
    );
  };

  const activePrescriptions = selectedPatient?.prescriptions.filter(rx => rx.status === 'active') ?? [];
  const pastPrescriptions = selectedPatient?.prescriptions.filter(rx => rx.status !== 'active') ?? [];

  const details: { label: string; value: string; wide?: boolean; alert?: boolean }[] = selectedPatient
    ? [
        { label: 'Date of Birth', value: selectedPatient.dateOfBirth },
        { label: 'Gender', value: selectedPatient.gender },
        { label: 'Ward / Bed', value: `${selectedPatient.ward} · ${selectedPatient.bed}` },
        { label: 'Admitted', value: selectedPatient.admissionDate },
        { label: 'Diagnosis', value: selectedPatient.diagnosis, wide: true },
        { label: 'Allergies', value: selectedPatient.allergies || 'None known', alert: !!selectedPatient.allergies && selectedPatient.allergies !== 'None known' },
      ]
    : [];

  return (
    <div style={{ display: 'flex', gap: 20, maxWidth: 1100, alignItems: 'flex-start' }}>
      {/* Patient list — sticky so it stays put while the page scrolls */}
      <div style={{
        width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12,
        position: 'sticky', top: 0, maxHeight: 'calc(100vh - 100px)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>
            Patients
          </h1>
          <input
            type="search"
            placeholder="Search by name, MRN, ward..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '8px 10px', border: '1px solid #D9E8EF', borderRadius: 6,
              fontSize: 13, color: '#0F172A', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
            }}
          />
        </div>

        {isLoading && <LoadingPanel />}
        {error && <ErrorPanel error={error} />}

        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
          background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8,
        }}>
          {filtered.length === 0 && (
            <div style={{ padding: '20px 16px', fontSize: 13, color: '#64748B', textAlign: 'center' }}>
              No patients found.
            </div>
          )}
          {filtered.map((p, i) => {
            const active = p.prescriptions.filter(rx => rx.status === 'active').length;
            const isSelected = selectedPatient?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handleSelect(p)}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 3,
                  width: '100%', padding: '12px 16px',
                  borderTop: 'none',
                  borderRight: 'none',
                  borderBottom: i < filtered.length - 1 ? '1px solid #D9E8EF' : 'none',
                  borderLeft: isSelected ? '3px solid #0AADA8' : '3px solid transparent',
                  background: isSelected ? '#F0F7FA' : 'transparent',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  transition: 'background 0.1s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{p.name}</span>
                  {active > 0 && (
                    <span style={{
                      fontSize: 11, fontFamily: 'IBM Plex Mono, monospace',
                      background: '#DBEAFE', color: '#2563EB',
                      padding: '1px 6px', borderRadius: 4,
                    }}>
                      {active} Rx
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>{p.mrn}</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>{p.ward} · {p.bed}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      {selectedPatient ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* Patient header */}
          <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', margin: 0 }}>{selectedPatient.name}</h2>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  {selectedPatient.mrn}
                </div>
              </div>
              {mode === 'view' && (
                <button
                  onClick={() => setMode('add')}
                  style={{
                    padding: '7px 16px', border: 'none', borderRadius: 6,
                    background: '#0AADA8', color: '#fff', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M6.5 2v9M2 6.5h9" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  New Prescription
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 14 }}>
              {details.map(item => (
                <div key={item.label} style={{ gridColumn: item.wide ? '1 / -1' : undefined }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>
                    {item.label}
                  </div>
                  <div style={{
                    fontSize: 13, color: item.alert ? '#DC2626' : '#0F172A',
                    fontWeight: item.alert ? 600 : 400,
                  }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add/Edit prescription form */}
          {(mode === 'add' || mode === 'edit') && (
            <div style={{ background: '#fff', border: '1px solid #0AADA8', borderRadius: 8, padding: '18px 20px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: '0 0 16px' }}>
                {mode === 'edit' ? `Edit — ${editingRx?.drug}` : 'New Prescription'}
              </h3>
              {createRx.error && <ErrorPanel error={createRx.error} />}
              {updateRx.error && <ErrorPanel error={updateRx.error} />}
              <PrescriptionForm
                initial={mode === 'edit' ? editingRx ?? undefined : undefined}
                prescribedBy={doctorName}
                onSave={mode === 'edit' ? handleEdit : handleAdd}
                onCancel={() => { setMode('view'); setEditingRx(null); }}
              />
            </div>
          )}

          {/* Active prescriptions */}
          {activePrescriptions.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #D9E8EF', background: '#F0F9FB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Active Prescriptions ({activePrescriptions.length})
                </span>
              </div>
              {activePrescriptions.map((rx, i) => (
                <RxDetailRow
                  key={rx.id}
                  rx={rx}
                  last={i === activePrescriptions.length - 1}
                  onEdit={() => { setEditingRx(rx); setMode('edit'); }}
                />
              ))}
            </div>
          )}

          {/* Past prescriptions */}
          {pastPrescriptions.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #D9E8EF', background: '#F0F9FB' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Stopped / Past ({pastPrescriptions.length})
                </span>
              </div>
              {pastPrescriptions.map((rx, i) => (
                <RxDetailRow
                  key={rx.id}
                  rx={rx}
                  last={i === pastPrescriptions.length - 1}
                  dimmed
                />
              ))}
            </div>
          )}

          {activePrescriptions.length === 0 && pastPrescriptions.length === 0 && mode === 'view' && (
            <div style={{
              background: '#fff', border: '1px dashed #D9E8EF', borderRadius: 8,
              padding: '32px 20px', textAlign: 'center', fontSize: 13, color: '#64748B',
            }}>
              No prescriptions yet. Click "New Prescription" to add one.
            </div>
          )}
        </div>
      ) : (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#64748B', fontSize: 13,
        }}>
          Select a patient to view details and manage prescriptions.
        </div>
      )}
    </div>
  );
}

function RxDetailRow({ rx, last, onEdit, dimmed }: {
  rx: Prescription;
  last: boolean;
  onEdit?: () => void;
  dimmed?: boolean;
}) {
  const foodLabel: Record<string, string> = {
    'before-food': 'Before food',
    'after-food': 'After food',
    'with-food': 'With food',
    'not-applicable': '—',
  };

  return (
    <div style={{
      padding: '14px 20px',
      borderBottom: last ? 'none' : '1px solid #D9E8EF',
      opacity: dimmed ? 0.65 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 2 }}>{rx.drug}</div>
          <div style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>
            {rx.dose} · {rx.route} · {rx.frequency} · {rx.durationDays}d
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {rx.editedAt && rx.status === 'active' && (
            <span
              title={`Edited ${new Date(rx.editedAt).toLocaleString('en-GB')}`}
              style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                background: '#FEF3C7', color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.04em',
              }}
            >
              Updated
            </span>
          )}
          <StatusPill status={rx.status} />
          {onEdit && rx.status === 'active' && (
            <button onClick={onEdit} style={{
              padding: '4px 10px', border: '1px solid #D9E8EF', borderRadius: 5,
              background: '#fff', fontSize: 12, color: '#0F172A', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Edit
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <Detail label="Food timing" value={foodLabel[rx.foodTiming]} />
        <Detail label="Time of day" value={rx.timeOfDay.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ') || '—'} />
        <Detail label="Start date" value={rx.startDate} mono />
        <Detail label="Day" value={`Day ${rx.currentDay} of ${rx.durationDays}`} mono />
        <Detail label="Prescribed by" value={rx.prescribedBy} />
        <Detail label="Prescribed at" value={rx.prescribedAt} mono />
      </div>

      {rx.notes && (
        <div style={{
          marginTop: 10, padding: '8px 12px',
          background: '#F0F9FB', border: '1px solid #D9E8EF',
          borderRadius: 5, fontSize: 12, color: '#64748B', lineHeight: 1.5,
        }}>
          <span style={{ fontWeight: 600, color: '#0F172A' }}>Note: </span>{rx.notes}
        </div>
      )}

      {rx.stopReason && (
        <div style={{
          marginTop: 10, padding: '8px 12px',
          background: '#FEE2E2', border: '1px solid #F0C4C4',
          borderRadius: 5, fontSize: 12, color: '#DC2626',
        }}>
          <span style={{ fontWeight: 600 }}>Stop reason: </span>{rx.stopReason}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 12, color: '#0F172A', fontFamily: mono ? 'IBM Plex Mono, monospace' : undefined }}>
        {value}
      </div>
    </div>
  );
}
