import type { Ward } from '../types';

interface SweepBarProps {
  ward: Ward;
  compact?: boolean;
}

const STEPS = ['Pending', 'Swept', 'Dispensed'];
const STATUS_INDEX = { pending: 0, swept: 1, dispensed: 2 };

export default function SweepBar({ ward, compact = false }: SweepBarProps) {
  const current = STATUS_INDEX[ward.sweepStatus];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 4 : 6 }}>
      {!compact && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{ward.label}</span>
          <span style={{ fontSize: 12, color: '#64748B' }}>{ward.activePatients} patients</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 2, height: 8, borderRadius: 4, overflow: 'hidden' }}>
        {STEPS.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              background: i <= current ? '#0AADA8' : '#D9E8EF',
              borderRadius: i === 0 ? '4px 0 0 4px' : i === STEPS.length - 1 ? '0 4px 4px 0' : 0,
              transition: 'background 0.2s',
            }}
          />
        ))}
      </div>
      {!compact && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {STEPS.map((label, i) => (
            <span
              key={i}
              style={{
                fontSize: 11,
                color: i <= current ? '#0AADA8' : '#64748B',
                fontWeight: i === current ? 600 : 400,
                flex: i === 0 ? undefined : i === STEPS.length - 1 ? undefined : 1,
                textAlign: i === 0 ? 'left' : i === STEPS.length - 1 ? 'right' : 'center',
              }}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
