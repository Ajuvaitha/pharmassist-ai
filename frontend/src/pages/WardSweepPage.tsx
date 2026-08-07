import { useState } from 'react';
import { useWards } from '../api/wards';
import { useDispense, usePickupList, useSweep } from '../api/indents';
import { ErrorPanel, LoadingPanel } from '../components/AsyncState';
import SweepBar from '../components/SweepBar';
import StatusPill from '../components/StatusPill';

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="6" stroke="#16A34A" strokeWidth="1.3"/>
      <path d="M4.5 7l2 2 3.5-3.5" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function WardSweepPage() {
  const { data: wards } = useWards();
  const [activeWardId, setActiveWardId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // Only the confirm step is local. Whether a patient has been dispensed
  // comes from the server.
  const [confirming, setConfirming] = useState<string | null>(null);

  const wardId = activeWardId ?? wards?.[0]?.id ?? null;
  const { data: pickup, isLoading, error } = usePickupList(wardId);
  const dispenseMutation = useDispense();
  const sweepMutation = useSweep();

  const activeWard = (wards ?? []).find(w => w.id === wardId);
  const rawPickList = pickup?.patients ?? [];
  const pickList = search
    ? rawPickList.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.mrn.toLowerCase().includes(search.toLowerCase()) ||
        p.bed.toLowerCase().includes(search.toLowerCase()) ||
        p.medicines.some(m => m.drug.toLowerCase().includes(search.toLowerCase()))
      )
    : rawPickList;

  // Computed from the UNFILTERED list — pickList is search-filtered, and a
  // search that happens to match only already-dispensed patients must not
  // make the ward look complete while pending patients sit off-screen.
  const allDispensed = rawPickList.length > 0 && rawPickList.every(p => p.dispensed);

  const dispense = (patientId: string) => {
    if (!wardId) return;
    dispenseMutation.mutate({ patientId, wardId }, { onSuccess: () => setConfirming(null) });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>
            Ward Sweep & Pickup
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
            Dispense and bill per patient
          </p>
        </div>
        <button
          onClick={() => sweepMutation.mutate({ wardId: wardId ?? undefined })}
          disabled={sweepMutation.isPending}
          style={{
            padding: '8px 16px',
            border: '1px solid #D9E8EF',
            borderRadius: 6,
            background: '#fff',
            color: '#0F172A',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {sweepMutation.isPending ? 'Running sweep…' : 'Run sweep'}
        </button>
      </div>

      {/* Search bar */}
      <div>
        <input
          type="search"
          placeholder="Search patient name, MRN, bed, or drug..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '8px 14px', border: '1px solid #D9E8EF',
            borderRadius: 6, fontSize: 13, color: '#0F172A', outline: 'none',
            fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Ward tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #D9E8EF' }}>
        {(wards ?? []).map(ward => (
          <button
            key={ward.id}
            onClick={() => { setActiveWardId(ward.id); setExpanded(null); setConfirming(null); }}
            style={{
              padding: '10px 18px',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              borderBottom: wardId === ward.id ? '2px solid #0AADA8' : '2px solid transparent',
              background: 'transparent',
              color: wardId === ward.id ? '#0AADA8' : '#64748B',
              fontWeight: wardId === ward.id ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'color 0.1s',
            }}
          >
            {ward.code}
          </button>
        ))}
      </div>

      {/* Sweep status bar */}
      <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8, padding: '16px 20px' }}>
        {activeWard && (
          <SweepBar ward={allDispensed ? { ...activeWard, sweepStatus: 'dispensed' } : activeWard} />
        )}
      </div>

      {/* Patient list */}
      <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8, overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 150px 80px 60px 180px 32px',
          padding: '10px 20px',
          borderBottom: '1px solid #D9E8EF',
          background: '#F0F9FB',
        }}>
          {['Patient', 'MRN', 'Bed', 'Items', 'Status', ''].map((h, i) => (
            <span key={i} style={{
              fontSize: 11, fontWeight: 600, color: '#64748B',
              textTransform: 'uppercase', letterSpacing: '0.04em',
              textAlign: i === 3 ? 'right' : 'left',
            }}>
              {h}
            </span>
          ))}
        </div>

        {isLoading && <LoadingPanel label="Loading pick list…" />}
        {error && <ErrorPanel error={error} />}

        {!isLoading && !error && pickList.length === 0 && (
          <div style={{ padding: '24px 20px', fontSize: 13, color: '#64748B', textAlign: 'center' }}>
            No active prescriptions for this ward today.
          </div>
        )}

        {pickList.map((patient) => {
          const isDispensed = patient.dispensed;
          const isConfirming = confirming === patient.patientId;
          const isExpanded = expanded === patient.patientId;

          return (
            <div key={patient.patientId} style={{
              borderBottom: '1px solid #D9E8EF',
              background: isDispensed ? '#FAFFFE' : 'transparent',
            }}>
              {/* Patient row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 150px 80px 60px 180px 32px',
                padding: '13px 20px',
                alignItems: 'center',
              }}>
                {/* Name — clickable to expand */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : patient.patientId)}
                  style={{
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'inherit',
                  }}
                >
                  <span style={{
                    fontSize: 14, fontWeight: 600,
                    color: isDispensed ? '#64748B' : '#0F172A',
                    textDecoration: isDispensed ? 'line-through' : 'none',
                    textDecorationColor: '#64748B',
                  }}>
                    {patient.name}
                  </span>
                </button>

                <span style={{ fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>
                  {patient.mrn}
                </span>
                <span style={{ fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>
                  {patient.bed}
                </span>
                <span style={{ fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', color: '#0F172A', textAlign: 'right' }}>
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
                      <button
                        onClick={() => setConfirming(null)}
                        style={ghostBtn}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => dispense(patient.patientId)}
                        style={confirmBtn}
                      >
                        Confirm & Bill
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirming(patient.patientId)}
                      style={dispenseBtn}
                    >
                      Dispense & Bill
                    </button>
                  )}
                </div>

                {/* Expand toggle */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : patient.patientId)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 11, textAlign: 'right', padding: 0 }}
                >
                  {isExpanded ? '▲' : '▼'}
                </button>
              </div>

              {/* Confirmation prompt inline */}
              {isConfirming && (
                <div style={{
                  margin: '0 20px 12px',
                  padding: '12px 16px',
                  background: '#FEF3C7',
                  border: '1px solid #E8D5A8',
                  borderRadius: 6,
                  fontSize: 13,
                  color: '#0F172A',
                }}>
                  Dispense <strong>{patient.medicines.length} prescription line{patient.medicines.length !== 1 ? 's' : ''}</strong> for <strong>{patient.name}</strong> and auto-bill to their account?
                </div>
              )}

              {/* Dispense failure — surfaced right where the pharmacist is
                  looking, since onSuccess never fires to close the modal. */}
              {isConfirming && dispenseMutation.isError && (
                <div style={{ margin: '0 20px 12px' }}>
                  <ErrorPanel error={dispenseMutation.error} />
                </div>
              )}

              {/* Expanded medicine list */}
              {isExpanded && (
                <div style={{ background: '#F0F9FB', padding: '0 20px 14px 44px' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 70px 60px 100px 100px 44px',
                    padding: '8px 0 6px',
                  }}>
                    {['Drug', 'Dose', 'Route', 'Status', 'Day', 'Qty'].map((h, i) => (
                      <span key={i} style={{
                        fontSize: 11, color: '#64748B', fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.03em',
                        textAlign: i === 5 ? 'right' : 'left',
                      }}>
                        {h}
                      </span>
                    ))}
                  </div>
                  {patient.medicines.map((med, mi) => (
                    <div key={med.lineId} style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 70px 60px 100px 100px 44px',
                      padding: '8px 0',
                      borderTop: mi > 0 ? '1px solid #D9E8EF' : 'none',
                      alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#0F172A' }}>{med.drug}</div>
                      </div>
                      <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>{med.dose}</span>
                      <span style={{ fontSize: 12, color: '#64748B' }}>{med.route}</span>
                      <span style={{
                        fontSize: 12,
                        color: med.status === 'dispensed' ? '#16A34A' : med.status === 'cancelled' ? '#DC2626' : '#64748B',
                      }}>
                        {med.status.charAt(0).toUpperCase() + med.status.slice(1)}
                      </span>
                      <span style={{ fontSize: 12, color: '#64748B' }}>Day {med.treatmentDay} of {med.durationDays}</span>
                      <span style={{ fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', color: '#0F172A', textAlign: 'right' }}>{med.qty}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Ward-level complete banner */}
      {allDispensed && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 20px',
          background: '#DCFCE7',
          border: '1px solid #A7F3D0',
          borderRadius: 8,
          color: '#16A34A',
          fontSize: 14,
          fontWeight: 500,
        }}>
          <CheckIcon />
          All patients dispensed and billed. Ward sweep status updated to Dispensed.
        </div>
      )}
    </div>
  );
}

const dispenseBtn: React.CSSProperties = {
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
};

const confirmBtn: React.CSSProperties = {
  padding: '5px 12px',
  border: 'none',
  borderRadius: 5,
  background: '#0AADA8',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
};

const ghostBtn: React.CSSProperties = {
  padding: '5px 10px',
  border: '1px solid #D9E8EF',
  borderRadius: 5,
  background: '#fff',
  color: '#64748B',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
};
