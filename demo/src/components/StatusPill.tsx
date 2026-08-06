interface StatusPillProps {
  status: 'ok' | 'low' | 'critical' | 'pending' | 'swept' | 'dispensed' | 'active' | 'stopped' | 'completed' | 'billed' | 'voided' | 'in-progress';
  label?: string;
}

const CONFIG = {
  ok:            { bg: '#16A34A', color: '#fff', text: 'OK' },
  dispensed:     { bg: '#16A34A', color: '#fff', text: 'Dispensed' },
  billed:        { bg: '#16A34A', color: '#fff', text: 'Billed' },
  completed:     { bg: '#16A34A', color: '#fff', text: 'Completed' },
  active:        { bg: '#0AADA8', color: '#fff', text: 'Active' },
  'in-progress': { bg: '#F59E0B', color: '#fff', text: 'In Progress' },
  swept:         { bg: '#F59E0B', color: '#fff', text: 'Swept' },
  low:           { bg: '#F59E0B', color: '#fff', text: 'Low' },
  pending:       { bg: '#F59E0B', color: '#fff', text: 'Pending' },
  critical:      { bg: '#DC2626', color: '#fff', text: 'Critical' },
  stopped:       { bg: '#DC2626', color: '#fff', text: 'Stopped' },
  voided:        { bg: '#DC2626', color: '#fff', text: 'Voided' },
};

export default function StatusPill({ status, label }: StatusPillProps) {
  const cfg = CONFIG[status] ?? CONFIG.pending;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: '18px',
        background: cfg.bg,
        color: cfg.color,
        whiteSpace: 'nowrap',
        letterSpacing: '0.01em',
      }}
    >
      {label ?? cfg.text}
    </span>
  );
}
