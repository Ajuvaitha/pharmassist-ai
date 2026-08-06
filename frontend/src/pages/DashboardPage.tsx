import { useState } from 'react';
import type { Role, Patient } from '../types';
import { WARDS, INVENTORY, TRANSACTIONS } from '../data';
import StatusPill from '../components/StatusPill';

interface DashboardPageProps {
  role: Role;
  ward: string;
  patients: Patient[];
}

type DrillKey = 'patients-rx' | 'pickups' | 'lowstock' | null;

const FOOD_LABEL: Record<string, string> = {
  'before-food': 'Before food', 'after-food': 'After food',
  'with-food': 'With food', 'not-applicable': '—',
};

export default function DashboardPage({ role, ward, patients }: DashboardPageProps) {
  const [drill, setDrill] = useState<DrillKey>(null);
  const [wardSearch, setWardSearch] = useState('');
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);

  const visibleWards = role === 'nurse'
    ? WARDS.filter(w => ward.includes(w.name.split(' — ')[0]))
    : WARDS;

  const activePatients = patients.filter(p =>
    role === 'nurse' ? p.ward.includes(ward.split(' — ')[0]) : true
  );

  const totalActiveRx = activePatients.reduce(
    (s, p) => s + p.prescriptions.filter(rx => rx.status === 'active').length, 0
  );

  const pendingPickups = TRANSACTIONS.filter(t => t.status === 'pending');
  const lowStockItems = INVENTORY.filter(i => i.status === 'low' || i.status === 'critical');

  const metrics = [
    {
      key: 'patients-rx' as DrillKey,
      label: 'Patients & Prescriptions',
      value: activePatients.length,
      sub: `${totalActiveRx} active prescriptions across all patients`,
      valueColor: '#0F172A',
      subValue: totalActiveRx,
    },
    {
      key: 'pickups' as DrillKey,
      label: 'Pending Pickups',
      value: pendingPickups.length,
      sub: 'awaiting billing',
      valueColor: '#D97706',
      subValue: null,
    },
    {
      key: 'lowstock' as DrillKey,
      label: 'Low-Stock Alerts',
      value: lowStockItems.length,
      sub: 'at or below reorder level',
      valueColor: '#DC2626',
      subValue: null,
    },
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

      {/* Metric cards — 3 cards, first one wider */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 12 }}>
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
            {/* Combined card: two numbers side-by-side */}
            {card.key === 'patients-rx' ? (
              <div style={{ display: 'flex', gap: 20, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: '#0F172A', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {activePatients.length}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Patients</div>
                </div>
                <div style={{ width: 1, background: '#D9E8EF', alignSelf: 'stretch' }} />
                <div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: '#0AADA8', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {totalActiveRx}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Active Prescriptions</div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 30, fontWeight: 700, color: card.valueColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 6 }}>
                {card.value}
              </div>
            )}
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{card.label}</div>
            {card.key !== 'patients-rx' && (
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{card.sub}</div>
            )}
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>
              {drill === card.key ? '▲ collapse' : '▼ view details'}
            </div>
          </button>
        ))}
      </div>

      {/* Drill-down panel */}
      {drill && (
        <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 20px', borderBottom: '1px solid #D9E8EF', background: '#F0F9FB',
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {metrics.find(m => m.key === drill)?.label}
            </span>
            <button onClick={() => { setDrill(null); setExpandedPatient(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
          </div>

          {/* Combined: Patients list, each expandable to show prescriptions */}
          {drill === 'patients-rx' && (
            <div>
              {/* Header row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 110px 110px 36px', padding: '9px 20px', background: '#FAFBFC', borderBottom: '1px solid #D9E8EF' }}>
                {['Patient', 'MRN', 'Ward', 'Admitted', 'Rx'].map((h, i) => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: i === 4 ? 'right' : 'left' }}>{h}</span>
                ))}
              </div>
              {activePatients.map((p, i) => {
                const activeRx = p.prescriptions.filter(rx => rx.status === 'active');
                const isOpen = expandedPatient === p.id;
                return (
                  <div key={p.id} style={{ borderBottom: i < activePatients.length - 1 ? '1px solid #D9E8EF' : 'none' }}>
                    {/* Patient row — click anywhere to toggle */}
                    <button
                      onClick={() => setExpandedPatient(isOpen ? null : p.id)}
                      style={{
                        display: 'grid', gridTemplateColumns: '1fr 160px 110px 110px 36px',
                        width: '100%', padding: '12px 20px',
                        border: 'none', background: isOpen ? '#F0F9FB' : 'transparent',
                        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                        alignItems: 'center', transition: 'background 0.1s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{p.name}</div>
                        {p.allergies && p.allergies !== 'None known' && (
                          <span style={{ fontSize: 10, color: '#DC2626', background: '#FEE2E2', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>ALLERGY</span>
                        )}
                      </div>
                      <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>{p.mrn}</span>
                      <span style={{ fontSize: 12, color: '#64748B' }}>{p.ward}</span>
                      <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>{p.admissionDate}</span>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        <span style={{
                          fontSize: 12, fontFamily: 'IBM Plex Mono, monospace',
                          background: activeRx.length > 0 ? '#DBEAFE' : '#F0F9FB',
                          color: activeRx.length > 0 ? '#2563EB' : '#94A3B8',
                          padding: '2px 7px', borderRadius: 4, fontWeight: 600,
                        }}>
                          {activeRx.length}
                        </span>
                        <span style={{ color: '#94A3B8', fontSize: 10 }}>{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {/* Prescription dropdown */}
                    {isOpen && activeRx.length > 0 && (
                      <div style={{ background: '#F8FBFC', padding: '4px 20px 14px 40px', borderTop: '1px solid #D9E8EF' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 120px 120px', padding: '8px 0 6px' }}>
                          {['Drug', 'Dose', 'Freq.', 'Food Timing', 'Time of Day'].map(h => (
                            <span key={h} style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
                          ))}
                        </div>
                        {activeRx.map((rx, ri) => (
                          <div key={rx.id} style={{
                            display: 'grid', gridTemplateColumns: '1fr 80px 60px 120px 120px',
                            padding: '9px 0', borderTop: ri > 0 ? '1px solid #D9E8EF' : 'none', alignItems: 'center',
                          }}>
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
                    {isOpen && activeRx.length === 0 && (
                      <div style={{ padding: '10px 20px 14px 40px', fontSize: 12, color: '#94A3B8', borderTop: '1px solid #D9E8EF', background: '#F8FBFC' }}>
                        No active prescriptions.
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
              const wardPatients = patients.filter(p => p.ward.includes(w.name.split(' — ')[0]));
              const totalPts = wardPatients.length;
              const dispensedPts = w.sweepStatus === 'dispensed' ? totalPts : 0;
              const pendingPts = totalPts - dispensedPts;

              return (
                <div key={w.id} style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8, padding: '16px 20px' }}>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{w.name.split(' — ')[0]}</div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{w.name.split(' — ')[1]}</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      { label: 'Total Patients', value: totalPts, color: '#0F172A', bg: '#F0F9FB' },
                      { label: 'Pending', value: pendingPts, color: '#D97706', bg: '#FEF3C7' },
                      { label: 'Dispensed', value: dispensedPts, color: '#16A34A', bg: '#DCFCE7' },
                    ].map(stat => (
                      <div key={stat.label} style={{ background: stat.bg, borderRadius: 6, padding: '10px 12px' }}>
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
