import React, { useState } from 'react';
import { ClipboardList, RefreshCw, CheckCircle2, PackageCheck, UserCheck, AlertCircle, Sparkles, Building2, ShieldCheck } from 'lucide-react';

export default function WardIndentSweep({ wards, consolidatedPickups, onFulfillBatch, onTriggerSweep }) {
  const [selectedWardId, setSelectedWardId] = useState('WARD-ICU-B');
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [pharmacistId, setPharmacistId] = useState('PHARM-108');
  const [staffId, setStaffId] = useState('NURSE-512');
  const [notes, setNotes] = useState('Unit-dose pouches verified and sealed in transport box.');
  const [sweepSuccessMsg, setSweepSuccessMsg] = useState('');

  const currentPickup = consolidatedPickups[selectedWardId];
  const selectedWard = wards.find(w => w.id === selectedWardId);

  const handleRunSweep = () => {
    onTriggerSweep(selectedWardId);
    setSweepSuccessMsg(`6:00 AM Automated Sweep completed successfully for ${selectedWard?.name || 'Selected Ward'}!`);
    setTimeout(() => setSweepSuccessMsg(''), 4000);
  };

  const handleConfirmFulfill = (e) => {
    e.preventDefault();
    if (!currentPickup || currentPickup.status === 'DISPENSED') return;

    onFulfillBatch(selectedWardId, {
      pharmacist_id: pharmacistId,
      staff_id: staffId,
      notes: notes
    });
    setIsFulfilling(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
      
      {/* Top Banner & Control Bar */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span className="glow-pill-emerald"><ShieldCheck size={14} /> 6:00 AM Automated Engine</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Cron Batch ID: {currentPickup?.indent_batch_id || 'PENDING'}</span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Consolidated Ward Pickup Manifest
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Zero paper indent slips. Multi-day prescriptions aggregated into 24-hour unit-dose batches.
            </p>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            
            {/* Ward Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(15, 23, 42, 0.9)', padding: '6px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <Building2 size={18} color="var(--primary-cyan)" />
              <select
                value={selectedWardId}
                onChange={(e) => setSelectedWardId(e.target.value)}
                style={{
                  background: 'transparent',
                  color: '#fff',
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {wards.map(ward => (
                  <option key={ward.id} value={ward.id} style={{ background: '#0f172a', color: '#fff' }}>
                    {ward.name} ({ward.floor})
                  </option>
                ))}
              </select>
            </div>

            {/* Sweep Trigger Button */}
            <button className="btn-primary" onClick={handleRunSweep}>
              <RefreshCw size={16} /> Run 6:00 AM Sweep
            </button>

          </div>

        </div>

        {sweepSuccessMsg && (
          <div style={{ marginTop: '16px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399', padding: '12px 16px', borderRadius: '10px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} /> {sweepSuccessMsg}
          </div>
        )}
      </div>

      {/* Ward Status Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Assigned Ward</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '4px', color: '#38bdf8' }}>
            {selectedWard?.name}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {selectedWard?.occupiedBeds} of {selectedWard?.totalBeds} Beds Occupied
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Fulfillment Status</div>
          <div style={{ marginTop: '6px' }}>
            {currentPickup?.status === 'DISPENSED' ? (
              <span className="glow-pill-emerald"><CheckCircle2 size={14} /> DISPENSED & BILLED</span>
            ) : (
              <span className="glow-pill-amber"><PackageCheck size={14} /> READY FOR PICKUP</span>
            )}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            Sweep Date: {currentPickup?.date || 'Today'}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Unit-Dose Summary</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '4px', color: '#a78bfa' }}>
            {currentPickup?.items?.reduce((sum, item) => sum + item.total_qty_needed, 0) || 0} Total Units
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Across {currentPickup?.items?.length || 0} Unique Formulations
          </div>
        </div>

      </div>

      {/* Manifest Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList size={20} color="var(--primary-cyan)" />
            Consolidated Unit-Dose Drug Manifest
          </h3>

          {currentPickup?.status !== 'DISPENSED' && (
            <button className="btn-emerald" onClick={() => setIsFulfilling(true)}>
              <PackageCheck size={18} /> Confirm Pharmacy Dispense & Auto-Bill
            </button>
          )}
        </div>

        {!currentPickup || currentPickup.items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <AlertCircle size={36} style={{ opacity: 0.5, marginBottom: '8px' }} />
            <p>No active unit-dose indents generated for this ward today.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
              <thead>
                <tr style={{ color: 'var(--text-dim)', fontSize: '0.78rem', textTransform: 'uppercase', textAlign: 'left' }}>
                  <th style={{ padding: '8px 14px' }}>Medication Name</th>
                  <th style={{ padding: '8px 14px' }}>Total Batch Qty</th>
                  <th style={{ padding: '8px 14px' }}>Unit</th>
                  <th style={{ padding: '8px 14px' }}>Bed-by-Bed Patient Distribution</th>
                </tr>
              </thead>
              <tbody>
                {currentPickup.items.map((item, idx) => (
                  <tr key={idx} style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: '10px' }}>
                    
                    <td style={{ padding: '14px', borderRadius: '10px 0 0 10px', fontWeight: 600, color: '#f8fafc' }}>
                      {item.drug_name}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{item.drug_id}</div>
                    </td>

                    <td style={{ padding: '14px' }}>
                      <span className="glow-pill-cyan" style={{ fontSize: '0.9rem', padding: '4px 14px' }}>
                        {item.total_qty_needed}
                      </span>
                    </td>

                    <td style={{ padding: '14px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      {item.unit}
                    </td>

                    <td style={{ padding: '14px', borderRadius: '0 10px 10px 0' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {item.patient_breakdown.map((p, pIdx) => (
                          <div key={pIdx} style={{ background: 'rgba(30, 41, 59, 0.7)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>
                              <strong style={{ color: '#38bdf8' }}>{p.bed_number}</strong> — {p.patient_name} ({p.patient_id})
                            </span>
                            <span style={{ color: '#a78bfa', fontWeight: 600 }}>
                              {p.treatment_day} &bull; <span style={{ color: '#34d399' }}>{p.qty} {item.unit}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fulfillment Confirmation Modal */}
      {isFulfilling && (
        <div className="modal-overlay">
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '28px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>
              Confirm Central Pharmacy Dispatch
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Confirming this batch will automatically deduct items from central stock and post daily charges to IPD patient accounts.
            </p>

            <form onSubmit={handleConfirmFulfill} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Dispensing Pharmacist ID
                </label>
                <input
                  type="text"
                  value={pharmacistId}
                  onChange={(e) => setPharmacistId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-subtle)', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Ward Pickup Nurse / Staff ID
                </label>
                <input
                  type="text"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-subtle)', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Handover Verification Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-subtle)', color: '#fff', fontSize: '0.9rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsFulfilling(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-emerald">
                  <PackageCheck size={16} /> Complete Dispense & Post Ledger
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
