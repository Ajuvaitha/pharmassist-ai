import { useState } from 'react';
import type { ActivityItem } from '@pharmassist/shared';
import { useActivity } from '../api/activity';
import { ErrorPanel, LoadingPanel } from '../components/AsyncState';
import StatusPill from '../components/StatusPill';

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

  const { data: activity, isLoading, error } = useActivity({ limit: 100 });
  const ALL_ACTIVITY: ActivityItem[] = activity ?? [];

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

      {isLoading && <LoadingPanel />}
      {error && <ErrorPanel error={error} />}

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
