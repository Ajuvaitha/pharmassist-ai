import { useState } from 'react';
import { usePatients } from '../api/patients';
import { ErrorPanel, LoadingPanel } from '../components/AsyncState';
import StatusPill from '../components/StatusPill';

interface PatientsPageProps {
  onSelectPatient: (patientId: string) => void;
}

export default function PatientsPage({ onSelectPatient }: PatientsPageProps) {
  const [search, setSearch] = useState('');
  const { data: patients, isLoading, error } = usePatients();

  const filtered = (patients ?? []).filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.mrn.toLowerCase().includes(search.toLowerCase()) ||
    p.ward.toLowerCase().includes(search.toLowerCase()) ||
    p.bed.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 1000, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>Patients</h1>
        <input
          type="search"
          placeholder="Search by name, MRN, ward, or bed..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '7px 12px', border: '1px solid #D9E8EF', borderRadius: 6,
            fontSize: 13, color: '#0F172A', outline: 'none', fontFamily: 'inherit',
            width: 300, boxSizing: 'border-box',
          }}
        />
        <span style={{ fontSize: 13, color: '#64748B', marginLeft: 'auto' }}>
          {filtered.length} patient{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 150px 100px 80px 120px 70px 80px',
          padding: '10px 20px',
          borderBottom: '1px solid #D9E8EF',
          background: '#F0F9FB',
        }}>
          {['Name', 'MRN', 'Ward', 'Bed', 'Admitted', 'Active Rx', ''].map((h, i) => (
            <span key={i} style={{
              fontSize: 11, fontWeight: 600, color: '#64748B',
              textTransform: 'uppercase', letterSpacing: '0.04em',
              textAlign: i === 5 ? 'right' : 'left',
            }}>
              {h}
            </span>
          ))}
        </div>

        {isLoading && <LoadingPanel label="Loading patients…" />}
        {error && <ErrorPanel error={error} />}

        {!isLoading && !error && filtered.length === 0 && (
          <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: 13, color: '#64748B' }}>
            No patients match your search.
          </div>
        )}

        {filtered.map((p, i) => {
          const activeRx = p.prescriptions.filter(rx => rx.status === 'active').length;
          const hasAllergy = p.allergies && p.allergies !== 'None known';

          return (
            <div
              key={p.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 150px 100px 80px 120px 70px 80px',
                padding: '13px 20px',
                borderBottom: i < filtered.length - 1 ? '1px solid #D9E8EF' : 'none',
                alignItems: 'center',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Name + allergy flag */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {p.name}
                  {hasAllergy && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#DC2626',
                      background: '#FEE2E2', padding: '1px 5px', borderRadius: 3,
                      letterSpacing: '0.03em',
                    }}>
                      ALLERGY
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{p.diagnosis}</div>
              </div>

              <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>{p.mrn}</span>
              <span style={{ fontSize: 13, color: '#64748B' }}>{p.ward}</span>
              <span style={{ fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>{p.bed}</span>
              <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>{p.admissionDate}</span>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                {activeRx > 0 ? (
                  <span style={{
                    fontSize: 12, fontFamily: 'IBM Plex Mono, monospace',
                    background: '#DBEAFE', color: '#2563EB',
                    padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                  }}>
                    {activeRx}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: '#CBD5E1' }}>—</span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => onSelectPatient(p.id)}
                  style={{
                    padding: '5px 12px',
                    border: '1px solid #0AADA8',
                    borderRadius: 5,
                    background: '#fff',
                    color: '#0AADA8',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#0AADA8'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#0AADA8'; }}
                >
                  View
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
