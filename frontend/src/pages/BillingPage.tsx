import { useState } from 'react';
import { useBilling, useConfirmBilling } from '../api/billing';
import { ErrorPanel, LoadingPanel } from '../components/AsyncState';
import StatusPill from '../components/StatusPill';

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="6" stroke="#16A34A" strokeWidth="1.3"/>
      <path d="M4.5 7l2 2 3.5-3.5" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function BillingPage() {
  const [wardFilter, setWardFilter] = useState('All');
  const [expanded, setExpanded] = useState<string | null>(null);
  // Local confirm step only; `billed` is server state.
  const [confirming, setConfirming] = useState<string | null>(null);

  const { data, isLoading, error } = useBilling();
  const confirmMutation = useConfirmBilling();

  const allGroups = data ?? [];
  const wards = ['All', ...Array.from(new Set(allGroups.map(g => g.ward)))];
  const groups = allGroups.filter(g => wardFilter === 'All' || g.ward === wardFilter);

  const grandTotal = groups.reduce((s, g) => s + g.total, 0);
  const billedCount = groups.filter(g => g.billed).length;

  const confirmBill = (patientId: string) => {
    confirmMutation.mutate({ patientId }, { onSuccess: () => setConfirming(null) });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>
          Billing Ledger
        </h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {wards.map(w => (
            <button
              key={w}
              onClick={() => setWardFilter(w)}
              style={{
                padding: '5px 12px',
                border: '1px solid',
                borderColor: wardFilter === w ? '#0AADA8' : '#D9E8EF',
                borderRadius: 5,
                background: wardFilter === w ? '#D4F0EF' : '#fff',
                color: wardFilter === w ? '#0AADA8' : '#64748B',
                fontSize: 12,
                fontWeight: wardFilter === w ? 600 : 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {w}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#64748B' }}>
            {billedCount}/{groups.length} patients billed
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: '#0AADA8' }}>
            GH₵{grandTotal.toFixed(2)}
          </span>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 100px 60px 90px 160px 32px',
          padding: '10px 20px',
          borderBottom: '1px solid #D9E8EF',
          background: '#F0F9FB',
        }}>
          {['Patient', 'Ward', 'Lines', 'Total', 'Billing', ''].map((h, i) => (
            <span key={i} style={{
              fontSize: 11, fontWeight: 600, color: '#64748B',
              textTransform: 'uppercase', letterSpacing: '0.04em',
              textAlign: i === 2 || i === 3 ? 'right' : 'left',
            }}>
              {h}
            </span>
          ))}
        </div>

        {isLoading && <LoadingPanel />}
        {error && <ErrorPanel error={error} />}

        {groups.map((group) => {
          const isBilled = group.billed;
          const isConfirming = confirming === group.patientId;
          const isExpanded = expanded === group.patientId;
          const groupTotal = group.total;
          const pendingCount = group.pendingCount;

          return (
            <div key={group.patientId} style={{
              borderBottom: '1px solid #D9E8EF',
              background: isBilled ? '#FAFFFE' : 'transparent',
            }}>
              {/* Patient summary row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px 60px 90px 160px 32px',
                padding: '13px 20px',
                alignItems: 'center',
              }}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : group.patientId)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                >
                  <span style={{
                    fontSize: 14, fontWeight: 600,
                    color: isBilled ? '#64748B' : '#0F172A',
                  }}>
                    {group.patient}
                  </span>
                </button>

                <span style={{ fontSize: 13, color: '#64748B' }}>{group.ward.replace('Ward ', '')}</span>

                <span style={{
                  fontSize: 13, fontFamily: 'IBM Plex Mono, monospace',
                  color: '#0F172A', textAlign: 'right',
                }}>
                  {group.transactions.length}
                </span>

                <span style={{
                  fontSize: 14, fontFamily: 'IBM Plex Mono, monospace',
                  fontWeight: 600, color: isBilled ? '#16A34A' : '#0F172A',
                  textAlign: 'right',
                }}>
                  GH₵{groupTotal.toFixed(2)}
                </span>

                {/* Per-patient billing action */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isBilled ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <CheckIcon />
                      <StatusPill status="billed" />
                    </div>
                  ) : isConfirming ? (
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button onClick={() => setConfirming(null)} style={ghostBtn}>Cancel</button>
                      <button onClick={() => confirmBill(group.patientId)} style={confirmBtn}>Confirm Bill</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {pendingCount > 0 && (
                        <StatusPill status="pending" label={`${pendingCount} pending`} />
                      )}
                      <button onClick={() => setConfirming(group.patientId)} style={billBtn}>
                        Bill Patient
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setExpanded(isExpanded ? null : group.patientId)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 11, textAlign: 'right', padding: 0 }}
                >
                  {isExpanded ? '▲' : '▼'}
                </button>
              </div>

              {/* Confirmation prompt */}
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
                  Confirm billing <strong>GH₵{groupTotal.toFixed(2)}</strong> ({group.transactions.length} transaction{group.transactions.length !== 1 ? 's' : ''}) to <strong>{group.patient}</strong>'s account?
                </div>
              )}

              {/* Bill-confirm failure — surfaced right where the user is
                  looking, since onSuccess never fires to close the modal. */}
              {isConfirming && confirmMutation.isError && (
                <div style={{ margin: '0 20px 12px' }}>
                  <ErrorPanel error={confirmMutation.error} />
                </div>
              )}

              {/* Expanded transaction lines */}
              {isExpanded && (
                <div style={{ background: '#F0F9FB', padding: '0 20px 14px 44px' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '160px 130px 1fr 50px 70px 90px 80px',
                    padding: '8px 0 6px',
                  }}>
                    {['Txn ID', 'Batch', 'Drug', 'Qty', 'Unit', 'Total', 'Status'].map((h, i) => (
                      <span key={i} style={{
                        fontSize: 11, color: '#64748B', fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.03em',
                        textAlign: i >= 3 && i <= 5 ? 'right' : 'left',
                      }}>
                        {h}
                      </span>
                    ))}
                  </div>
                  {group.transactions.map((t, ti) => (
                    <div key={t.id} style={{
                      display: 'grid',
                      gridTemplateColumns: '160px 130px 1fr 50px 70px 90px 80px',
                      padding: '8px 0',
                      borderTop: ti > 0 ? '1px solid #D9E8EF' : 'none',
                      alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>{t.id}</span>
                      <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>{t.batchId}</span>
                      <span style={{ fontSize: 13, color: '#0F172A' }}>{t.drug}</span>
                      <span style={{ fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', color: '#0F172A', textAlign: 'right' }}>{t.qty}</span>
                      <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B', textAlign: 'right' }}>
                        {(t.unitPrice * 100).toFixed(0)}p
                      </span>
                      <span style={{ fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 500, color: '#0F172A', textAlign: 'right' }}>
                        GH₵{t.total.toFixed(2)}
                      </span>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <StatusPill status={isBilled ? 'billed' : t.status} />
                      </div>
                    </div>
                  ))}
                  <div style={{
                    display: 'flex', justifyContent: 'flex-end',
                    borderTop: '1px solid #D9E8EF', paddingTop: 8, marginTop: 4,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: isBilled ? '#16A34A' : '#0F172A' }}>
                      Total: GH₵{groupTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const billBtn: React.CSSProperties = {
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
