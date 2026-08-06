export default function DoctorPage() {
  const recent = [
    { id: 'RX-20260805-014', patient: 'Bernard Kyei Mensah', mrn: 'MRN-011204', drug: 'Amlodipine 5mg OD × 14d', submitted: '2026-08-05 06:30' },
    { id: 'RX-20260804-022', patient: 'Adwoa Boateng', mrn: 'MRN-008815', drug: 'Metformin 500mg BD × 30d', submitted: '2026-08-04 08:15' },
    { id: 'RX-20260804-019', patient: 'Kofi Acheampong', mrn: 'MRN-005501', drug: 'Omeprazole 20mg OD × 7d', submitted: '2026-08-04 07:52' },
    { id: 'RX-20260803-031', patient: 'Grace Owusu', mrn: 'MRN-013307', drug: 'Amoxicillin 500mg TDS × 5d', submitted: '2026-08-03 09:10' },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 40, maxWidth: 640, margin: '0 auto' }}>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{
          background: '#fff',
          border: '1px solid #D9E8EF',
          borderRadius: 8,
          padding: 28,
          textAlign: 'center',
        }}>
          <div style={{
            width: 48, height: 48,
            background: '#D4F0EF',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="#0AADA8" strokeWidth="1.5" strokeLinecap="round"/>
              <rect x="9" y="3" width="6" height="4" rx="1" stroke="#0AADA8" strokeWidth="1.5"/>
              <path d="M9 12h6M9 16h4" stroke="#0AADA8" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>
            Prescription Entry
          </h2>
          <p style={{ fontSize: 13, color: '#64748B', margin: 0, lineHeight: 1.6 }}>
            New prescriptions are entered through the hospital's e-prescription system (KBTH ePrescribe). This portal provides a read-only reference view only.
          </p>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 16,
            padding: '7px 14px',
            background: '#F0F9FB',
            border: '1px solid #D9E8EF',
            borderRadius: 6,
            fontSize: 12,
            color: '#64748B',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v6M3 8.5l3 2.5 3-2.5" stroke="#64748B" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Open KBTH ePrescribe to submit a new Rx
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #D9E8EF', background: '#F0F9FB' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Your Recent Submissions
            </span>
          </div>
          {recent.map((rx, i) => (
            <div key={rx.id} style={{
              padding: '14px 20px',
              borderBottom: i < recent.length - 1 ? '1px solid #D9E8EF' : 'none',
              display: 'grid',
              gridTemplateColumns: '1fr 160px',
              gap: 12,
              alignItems: 'start',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#0F172A', marginBottom: 3 }}>{rx.patient}</div>
                <div style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B', marginBottom: 4 }}>{rx.mrn}</div>
                <div style={{ fontSize: 13, color: '#64748B' }}>{rx.drug}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>{rx.submitted}</div>
                <div style={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', color: '#94A3B8', marginTop: 2 }}>{rx.id}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
