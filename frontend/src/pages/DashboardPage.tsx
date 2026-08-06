import { useState } from 'react';
import type { Role } from '../types';
import { useWards } from '../api/wards';
import { usePatients } from '../api/patients';
import { useInventory } from '../api/inventory';
import { useBilling } from '../api/billing';
import { ErrorPanel, LoadingPanel } from '../components/AsyncState';
import StatusPill from '../components/StatusPill';

interface DashboardPageProps {
  role: Role;
  ward: string;
}

type DrillKey = 'patients' | 'prescriptions' | 'pickups' | 'lowstock' | null;

const FOOD_LABEL: Record<string, string> = {
  'before-food': 'Before food', 'after-food': 'After food',
  'with-food': 'With food', 'not-applicable': '—',
};

export default function DashboardPage({ role, ward }: DashboardPageProps) {
  const [drill, setDrill] = useState<DrillKey>(null);
  const [wardSearch, setWardSearch] = useState('');
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);

  const wardsQuery = useWards();
  const patientsQuery = usePatients();
  const inventoryQuery = useInventory();
  const billingQuery = useBilling();

  const isLoading = wardsQuery.isLoading || patientsQuery.isLoading
    || inventoryQuery.isLoading || billingQuery.isLoading;
  const error = wardsQuery.error ?? patientsQuery.error
    ?? inventoryQuery.error ?? billingQuery.error;

  // The server scopes a nurse to their ward now, so the old client-side
  // filtering on ward.split(' — ') is gone.
  const visibleWards = wardsQuery.data ?? [];
  const activePatients = patientsQuery.data ?? [];
  const allActivePrescriptions = activePatients.flatMap(p =>
    p.prescriptions.filter(rx => rx.status === 'active').map(rx => ({
      ...rx, patientName: p.name, patientId: p.id, ward: p.ward, bed: p.bed,
    }))
  );
  const rxByPatient = activePatients.map(p => ({
    patient: p,
    prescriptions: p.prescriptions.filter(rx => rx.status === 'active'),
  })).filter(g => g.prescriptions.length > 0);
  const pendingPickups = (billingQuery.data ?? [])
    .flatMap(g => g.transactions)
    .filter(t => t.status === 'pending');
  const lowStockItems = (inventoryQuery.data ?? [])
    .filter(i => i.status === 'low' || i.status === 'critical');

  const metrics = [
    { key: 'patients' as DrillKey, label: 'Active Patients', value: activePatients.length, sub: 'across all wards', valueColor: '#0F172A' },
    { key: 'prescriptions' as DrillKey, label: 'Active Prescriptions', value: allActivePrescriptions.length, sub: 'across all patients', valueColor: '#0F172A' },
    { key: 'pickups' as DrillKey, label: 'Pending Pickups', value: pendingPickups.length, sub: 'awaiting billing', valueColor: '#D97706' },
    { key: 'lowstock' as DrillKey, label: 'Low-Stock Alerts', value: lowStockItems.length, sub: 'at or below reorder level', valueColor: '#DC2626' },
  ];

  const filteredWards = visibleWards.filter(w =>
    !wardSearch || w.name.toLowerCase().includes(wardSearch.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>
          {role === 'nurse' ? `${ward.split(' — ')[0]} — Morning Overview` : 'Dashboard'}
        </h1>
        <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>Wednesday, 5 August 2026</p>
      </div>

      {isLoading && <LoadingPanel />}
      {error && <ErrorPanel error={error} />}

      {/* Metric cards — no active border styling */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {metrics.map(card => (
          <button
            key={card.key}
            onClick={() => setDrill(drill === card.key ? null : card.key)}
            style={{
              background: '#fff',
              border: '1px solid #D9E8EF',
              borderRadius: 8,
              padding: 20,
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              transition: 'box-shadow 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(27,34,44,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            <div style={{ fontSize: 30, fontWeight: 700, color: card.valueColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {card.value}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginTop: 6 }}>{card.label}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{card.sub}</div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>
              {drill === card.key ? '▲ collapse' : '▼ view details'}
            </div>
          </button>
        ))}
      </div>

      {/* Drill-down panel — no teal border */}
      {drill && (
        <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 20px', borderBottom: '1px solid #D9E8EF', background: '#F0F9FB',
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {metrics.find(m => m.key === drill)?.label}
            </span>
            <button onClick={() => setDrill(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
          </div>

          {/* Active Patients */}
          {drill === 'patients' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 100px 80px 120px 60px', padding: '9px 20px', background: '#FAFBFC', borderBottom: '1px solid #D9E8EF' }}>
                {['Name', 'MRN', 'Ward', 'Bed', 'Admitted', 'Rx'].map((h, i) => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: i === 5 ? 'right' : 'left' }}>{h}</span>
                ))}
              </div>
              {activePatients.map((p, i) => (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 150px 100px 80px 120px 60px', padding: '11px 20px', borderBottom: i < activePatients.length - 1 ? '1px solid #D9E8EF' : 'none', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#0F172A' }}>{p.name}</div>
                    {p.allergies && p.allergies !== 'None known' && (
                      <span style={{ fontSize: 10, color: '#DC2626', background: '#FEE2E2', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>ALLERGY</span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>{p.mrn}</span>
                  <span style={{ fontSize: 13, color: '#64748B' }}>{p.ward}</span>
                  <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>{p.bed}</span>
                  <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>{p.admissionDate}</span>
                  <span style={{ fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', color: '#0F172A', textAlign: 'right' }}>
                    {p.prescriptions.filter(rx => rx.status === 'active').length}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Active Prescriptions — grouped by patient */}
          {drill === 'prescriptions' && (
            <div>
              {rxByPatient.map((group, gi) => {
                const isOpen = expandedPatient === group.patient.id;
                return (
                  <div key={group.patient.id} style={{ borderBottom: gi < rxByPatient.length - 1 ? '1px solid #D9E8EF' : 'none' }}>
                    <button
                      onClick={() => setExpandedPatient(isOpen ? null : group.patient.id)}
                      style={{
                        display: 'grid', gridTemplateColumns: '1fr 100px 80px 40px',
                        width: '100%', padding: '12px 20px',
                        border: 'none', background: isOpen ? '#F0F9FB' : 'transparent',
                        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                        alignItems: 'center', transition: 'background 0.1s',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{group.patient.name}</span>
                        <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 10 }}>{group.patient.ward} · {group.patient.bed}</span>
                      </div>
                      <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>{group.patient.mrn}</span>
                      <span style={{
                        fontSize: 12, fontFamily: 'IBM Plex Mono, monospace',
                        background: '#DBEAFE', color: '#2563EB',
                        padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                        display: 'inline-block',
                      }}>
                        {group.prescriptions.length} Rx
                      </span>
                      <span style={{ color: '#64748B', fontSize: 11, textAlign: 'right' }}>{isOpen ? '▲' : '▼'}</span>
                    </button>

                    {isOpen && (
                      <div style={{ background: '#F0F9FB', padding: '0 20px 12px 40px', borderTop: '1px solid #D9E8EF' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px 120px 120px', padding: '8px 0 6px' }}>
                          {['Drug', 'Dose', 'Freq.', 'Food Timing', 'Time of Day'].map(h => (
                            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{h}</span>
                          ))}
                        </div>
                        {group.prescriptions.map((rx, ri) => (
                          <div key={rx.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px 120px 120px', padding: '8px 0', borderTop: ri > 0 ? '1px solid #D9E8EF' : 'none', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: '#0F172A' }}>{rx.drug}</div>
                              <div style={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', color: '#94A3B8' }}>{rx.route}</div>
                            </div>
                            <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>{rx.dose}</span>
                            <span style={{ fontSize: 12, color: '#64748B' }}>{rx.frequency}</span>
                            <span style={{ fontSize: 12, color: '#64748B' }}>{FOOD_LABEL[rx.foodTiming]}</span>
                            <span style={{ fontSize: 12, color: '#64748B' }}>{rx.timeOfDay.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pending Pickups */}
          {drill === 'pickups' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '170px 140px 100px 1fr 50px 90px', padding: '9px 20px', background: '#FAFBFC', borderBottom: '1px solid #D9E8EF' }}>
                {['Txn ID', 'Patient', 'Ward', 'Drug', 'Qty', 'Total'].map((h, i) => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: i >= 4 ? 'right' : 'left' }}>{h}</span>
                ))}
              </div>
              {pendingPickups.map((t, i) => (
                <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '170px 140px 100px 1fr 50px 90px', padding: '11px 20px', borderBottom: i < pendingPickups.length - 1 ? '1px solid #D9E8EF' : 'none', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>{t.id}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#0F172A' }}>{t.patient}</span>
                  <span style={{ fontSize: 13, color: '#64748B' }}>{t.ward.replace('Ward ', '')}</span>
                  <span style={{ fontSize: 13, color: '#0F172A' }}>{t.drug}</span>
                  <span style={{ fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', color: '#0F172A', textAlign: 'right' }}>{t.qty}</span>
                  <span style={{ fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 500, color: '#0F172A', textAlign: 'right' }}>GH₵{t.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Low-Stock Alerts */}
          {drill === 'lowstock' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 80px 100px 80px 80px', padding: '9px 20px', background: '#FAFBFC', borderBottom: '1px solid #D9E8EF' }}>
                {['Drug', 'Category', 'Unit', 'In Stock', 'Reorder', 'Status'].map((h, i) => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: i >= 3 && i <= 4 ? 'right' : 'left' }}>{h}</span>
                ))}
              </div>
              {lowStockItems.map((item, i) => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 80px 100px 80px 80px', padding: '11px 20px', borderBottom: i < lowStockItems.length - 1 ? '1px solid #D9E8EF' : 'none', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#0F172A' }}>{item.drug}</span>
                  <span style={{ fontSize: 13, color: '#64748B' }}>{item.category}</span>
                  <span style={{ fontSize: 13, color: '#64748B' }}>{item.unit}</span>
                  <span style={{ fontSize: 14, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, color: item.status === 'critical' ? '#DC2626' : '#D97706', textAlign: 'right' }}>{item.currentStock}</span>
                  <span style={{ fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B', textAlign: 'right' }}>{item.reorderLevel}</span>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}><StatusPill status={item.status} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ward cards section */}
      {role === 'pharmacist' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Wards
            </span>
            <input
              type="search"
              placeholder="Search wards..."
              value={wardSearch}
              onChange={e => setWardSearch(e.target.value)}
              style={{
                padding: '6px 12px', border: '1px solid #D9E8EF', borderRadius: 6,
                fontSize: 13, color: '#0F172A', outline: 'none', fontFamily: 'inherit',
                width: 220, background: '#fff',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {filteredWards.map(w => {
              const wardPatients = activePatients.filter(p => p.ward.includes(w.code));
              const pendingRx = wardPatients.reduce((s, p) => s + p.prescriptions.filter(rx => rx.status === 'active').length, 0);

              const statusColor = w.sweepStatus === 'dispensed' ? '#16A34A'
                : w.sweepStatus === 'swept' ? '#D97706'
                : '#64748B';
              const statusBg = w.sweepStatus === 'dispensed' ? '#DCFCE7'
                : w.sweepStatus === 'swept' ? '#FEF3C7'
                : '#F0F9FB';

              return (
                <div key={w.id} style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{w.code}</div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{w.name}</div>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px',
                      borderRadius: 4, background: statusBg, color: statusColor,
                      textTransform: 'capitalize',
                    }}>
                      {w.sweepStatus}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      { label: 'Patients', value: w.activePatients, color: '#0F172A' },
                      { label: 'Active Rx', value: pendingRx, color: '#2563EB' },
                      { label: 'Dispensed', value: w.sweepStatus === 'dispensed' ? w.activePatients : 0, color: '#16A34A' },
                    ].map(stat => (
                      <div key={stat.label} style={{ background: '#F0F9FB', borderRadius: 6, padding: '10px 12px' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: stat.color, fontVariantNumeric: 'tabular-nums' }}>{stat.value}</div>
                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredWards.length === 0 && (
            <div style={{ fontSize: 13, color: '#64748B', padding: '16px 0' }}>No wards match your search.</div>
          )}
        </div>
      )}
    </div>
  );
}
