import { useState } from 'react';
import StatusPill from '../components/StatusPill';

interface ActivityItem {
  id: string;
  time: string;
  date: string;
  type: 'dispense' | 'prescription' | 'stop' | 'restock' | 'register';
  patient?: string;
  ward?: string;
  drug?: string;
  text: string;
  status?: 'billed' | 'pending' | 'voided';
}

const ALL_ACTIVITY: ActivityItem[] = [
  { id: 'a1', time: '08:30', date: '2026-08-05', type: 'dispense', patient: 'Esi Mensah', ward: 'Ward 2D', drug: 'Ondansetron 8mg', text: 'Dispensed Ondansetron 8mg × 3 — Esi Mensah (Ward 2D)', status: 'pending' },
  { id: 'a2', time: '08:02', date: '2026-08-05', type: 'dispense', patient: 'Kwame Asante', ward: 'Ward 6C', drug: 'Tramadol 50mg', text: 'Dispensed Tramadol 50mg × 16 — Kwame Asante (Ward 6C)', status: 'pending' },
  { id: 'a3', time: '07:45', date: '2026-08-05', type: 'dispense', patient: 'Abena Frimpong', ward: 'Ward 5B', drug: 'Atorvastatin 40mg', text: 'Dispensed Atorvastatin 40mg × 5 — Abena Frimpong (Ward 5B)', status: 'billed' },
  { id: 'a4', time: '07:17', date: '2026-08-05', type: 'dispense', patient: 'James Kofi Antwi', ward: 'Ward 4A', drug: 'Furosemide 40mg', text: 'Dispensed Furosemide 40mg × 2 — James Kofi Antwi (Ward 4A)', status: 'billed' },
  { id: 'a5', time: '07:14', date: '2026-08-05', type: 'dispense', patient: 'Margaret Osei', ward: 'Ward 4A', drug: 'Amoxicillin 500mg', text: 'Dispensed Amoxicillin 500mg × 3 + Metformin 500mg × 4 — Margaret Osei (Ward 4A)', status: 'billed' },
  { id: 'a6', time: '06:58', date: '2026-08-05', type: 'prescription', patient: 'James Kofi Antwi', ward: 'Ward 4A', drug: 'Spironolactone 25mg', text: 'New prescription: Spironolactone 25mg OD — James Kofi Antwi (Ward 4A)' },
  { id: 'a7', time: '06:40', date: '2026-08-05', type: 'stop', patient: 'James Kofi Antwi', ward: 'Ward 4A', drug: 'Digoxin 0.25mg', text: 'Stop order: Digoxin 0.25mg — James Kofi Antwi — Toxicity suspected' },
  { id: 'a8', time: '07:20', date: '2026-08-04', type: 'dispense', patient: 'James Kofi Antwi', ward: 'Ward 4A', drug: 'Furosemide 40mg', text: 'Dispensed Furosemide 40mg × 2 — James Kofi Antwi (Ward 4A)', status: 'billed' },
  { id: 'a9', time: '09:10', date: '2026-08-04', type: 'register', text: 'Patient registered: Kwame Asante — Ward 6C, Bed 03' },
  { id: 'a10', time: '08:45', date: '2026-08-04', type: 'restock', drug: 'Furosemide 40mg', text: 'Restocked Furosemide 40mg — +200 tablets (Ref: PO-2026-0480)' },
  { id: 'a11', time: '10:00', date: '2026-08-03', type: 'prescription', patient: 'Abena Frimpong', ward: 'Ward 5B', drug: 'Bisoprolol 5mg', text: 'New prescription: Bisoprolol 5mg OD — Abena Frimpong (Ward 5B)' },
  { id: 'a12', time: '09:00', date: '2026-08-03', type: 'register', text: 'Patient registered: Abena Frimpong — Ward 5B, Bed 12' },
];

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'dispense', label: 'Dispenses' },
  { value: 'prescription', label: 'Prescriptions' },
  { value: 'stop', label: 'Stop Orders' },
  { value: 'restock', label: 'Restocks' },
  { value: 'register', label: 'Registrations' },
];

const TYPE_PILL: Record<string, { label: string; bg: string; color: string }> = {
  dispense:     { label: 'Dispense',     bg: '#DBEAFE', color: '#2563EB' },
  prescription: { label: 'New Rx',       bg: '#DCFCE7', color: '#16A34A' },
  stop:         { label: 'Stop Order',   bg: '#FEE2E2', color: '#DC2626' },
  restock:      { label: 'Restock',      bg: '#D4F0EF', color: '#0AADA8' },
  register:     { label: 'Registration', bg: '#F0F9FB', color: '#64748B' },
};

// Group by date
function groupByDate(items: ActivityItem[]) {
  const map = new Map<string, ActivityItem[]>();
  for (const item of items) {
    if (!map.has(item.date)) map.set(item.date, []);
    map.get(item.date)!.push(item);
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function RecentActivityPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = ALL_ACTIVITY.filter(item => {
    const matchType = typeFilter === 'all' || item.type === typeFilter;
    const matchSearch = !search ||
      item.text.toLowerCase().includes(search.toLowerCase()) ||
      (item.patient?.toLowerCase().includes(search.toLowerCase())) ||
      (item.drug?.toLowerCase().includes(search.toLowerCase())) ||
      (item.ward?.toLowerCase().includes(search.toLowerCase()));
    return matchType && matchSearch;
  });

  const grouped = groupByDate(filtered);

  return (
    <div style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>
          Recent Activity
        </h1>
        <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
          All dispenses, prescriptions, stop orders, and stock events
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Search by patient, drug, ward..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '7px 12px', border: '1px solid #D9E8EF', borderRadius: 6,
            fontSize: 13, color: '#0F172A', outline: 'none', fontFamily: 'inherit',
            width: 260, background: '#fff',
          }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {TYPE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              style={{
                padding: '5px 12px', border: '1px solid',
                borderColor: typeFilter === f.value ? '#0AADA8' : '#D9E8EF',
                borderRadius: 5,
                background: typeFilter === f.value ? '#D4F0EF' : '#fff',
                color: typeFilter === f.value ? '#0AADA8' : '#64748B',
                fontSize: 12, fontWeight: typeFilter === f.value ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 'auto' }}>
          {filtered.length} event{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Activity feed grouped by date */}
      {grouped.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8, padding: '32px 20px', textAlign: 'center', fontSize: 13, color: '#64748B' }}>
          No activity matches your filters.
        </div>
      ) : (
        grouped.map(([date, items]) => (
          <div key={date}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              {formatDate(date)}
            </div>
            <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8, overflow: 'hidden' }}>
              {items.map((item, i) => {
                const pill = TYPE_PILL[item.type];
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '68px 90px 1fr auto',
                      gap: 16,
                      padding: '13px 20px',
                      borderBottom: i < items.length - 1 ? '1px solid #D9E8EF' : 'none',
                      alignItems: 'center',
                    }}
                  >
                    {/* Time */}
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#94A3B8' }}>
                      {item.time}
                    </span>

                    {/* Type pill */}
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 8px',
                      borderRadius: 4, background: pill.bg, color: pill.color,
                      whiteSpace: 'nowrap', display: 'inline-block',
                    }}>
                      {pill.label}
                    </span>

                    {/* Description */}
                    <div>
                      <div style={{ fontSize: 13, color: '#0F172A', lineHeight: 1.5 }}>{item.text}</div>
                      {item.patient && (
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                          {item.ward && <span>{item.ward}</span>}
                        </div>
                      )}
                    </div>

                    {/* Status */}
                    <div>
                      {item.status && <StatusPill status={item.status} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
