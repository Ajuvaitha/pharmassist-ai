import React, { useState } from 'react';
import { Bed, User, Pill, Activity, AlertOctagon, XCircle, CheckCircle2, ShieldAlert, FileText, Search } from 'lucide-react';

export default function PatientBedMonitor({ prescriptions, onStopOrder }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRx, setSelectedRx] = useState(null);
  const [stopReason, setStopReason] = useState('DISCHARGE_EARLY');
  const [stopNotes, setStopNotes] = useState('Patient condition improved, discharged to home care.');
  const [cancellationNotice, setCancellationNotice] = useState('');

  const filteredPrescriptions = prescriptions.filter(rx =>
    rx.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rx.bed_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rx.drug_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rx.rx_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleConfirmStopOrder = (e) => {
    e.preventDefault();
    if (!selectedRx) return;

    onStopOrder(selectedRx.rx_id, {
      reason: stopReason,
      notes: stopNotes
    });

    setCancellationNotice(`Stop-order executed for ${selectedRx.patient_name} (${selectedRx.rx_id}). Future daily batches marked CANCELLED!`);
    setSelectedRx(null);
    setTimeout(() => setCancellationNotice(''), 5000);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
      
      {/* Header & Filter */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span className="glow-pill-cyan"><Bed size={14} /> Ward Bed Monitor</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Real-Time Day-by-Day Tracking & Stop-Order Engine</span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Inpatient Bed & Prescription Monitor</h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Track active treatment days per patient bed. Trigger instant Stop-Orders to stop pharmacy issuance upon discharge or order changes.
            </p>
          </div>

          {/* Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(15, 23, 42, 0.9)', padding: '8px 16px', borderRadius: '10px', border: '1px solid var(--border-subtle)', width: '280px' }}>
            <Search size={18} color="var(--text-dim)" />
            <input
              type="text"
              placeholder="Search bed, patient or drug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '0.88rem', width: '100%' }}
            />
          </div>

        </div>

        {cancellationNotice && (
          <div style={{ marginTop: '16px', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.4)', color: '#fb7185', padding: '12px 16px', borderRadius: '10px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertOctagon size={18} /> {cancellationNotice}
          </div>
        )}
      </div>

      {/* Prescription Bed Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {filteredPrescriptions.map((rx) => {
          const progressPercent = Math.min(100, Math.round((rx.current_day / rx.total_prescribed_days) * 100));
          const isCancelled = rx.status === 'CANCELLED';

          return (
            <div key={rx.rx_id} className="glass-panel glass-card-interactive" style={{ padding: '24px', opacity: isCancelled ? 0.65 : 1 }}>
              
              {/* Bed & Patient Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bed size={20} /> {rx.bed_number}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                    {rx.patient_name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                    {rx.ward_name} &bull; ID: {rx.patient_id}
                  </div>
                </div>

                <div>
                  {isCancelled ? (
                    <span className="glow-pill-rose"><XCircle size={14} /> STOPPED</span>
                  ) : (
                    <span className="glow-pill-emerald"><Activity size={14} /> ACTIVE RX</span>
                  )}
                </div>
              </div>

              {/* Medication Details */}
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Pill size={16} color="var(--primary-cyan)" /> {rx.drug_name}
                </div>
                
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Dosage: <strong style={{ color: '#fff' }}>{rx.daily_dosage_qty} units / day</strong></span>
                  <span>Freq: <strong style={{ color: '#34d399' }}>{rx.frequency_code}</strong></span>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                  Doctor: {rx.prescribing_doctor}
                </div>
              </div>

              {/* Treatment Progress Bar */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Treatment Progress</span>
                  <span style={{ color: isCancelled ? '#fb7185' : '#38bdf8' }}>
                    Day {rx.current_day} of {rx.total_prescribed_days} ({progressPercent}%)
                  </span>
                </div>

                <div style={{ width: '100%', height: '8px', background: 'rgba(30, 41, 59, 0.8)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${progressPercent}%`,
                      height: '100%',
                      background: isCancelled
                        ? 'linear-gradient(90deg, #f43f5e 0%, #be123c 100%)'
                        : 'linear-gradient(90deg, #0284c7 0%, #34d399 100%)',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
              </div>

              {/* Stop Order Action */}
              {!isCancelled ? (
                <button
                  className="btn-rose"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setSelectedRx(rx)}
                >
                  <AlertOctagon size={16} /> Real-Time Stop Order (Cancel Pending Days)
                </button>
              ) : (
                <div style={{ fontSize: '0.8rem', color: '#fb7185', textAlign: 'center', fontStyle: 'italic' }}>
                  Future daily indents stopped & cancelled in real-time.
                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* Stop Order Confirmation Modal */}
      {selectedRx && (
        <div className="modal-overlay">
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '28px', border: '1px solid rgba(244, 63, 94, 0.4)' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f43f5e', marginBottom: '12px' }}>
              <ShieldAlert size={26} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                Execute Real-Time Stop-Order
              </h3>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              You are executing a Stop-Order for prescription <strong style={{ color: '#fff' }}>{selectedRx.rx_id}</strong> assigned to <strong style={{ color: '#38bdf8' }}>{selectedRx.patient_name} ({selectedRx.bed_number})</strong>.
              <br />
              All pending future 24-hr daily execution batches (Days {selectedRx.current_day + 1} to {selectedRx.total_prescribed_days}) will be immediately marked <strong style={{ color: '#fb7185' }}>CANCELLED</strong>.
            </p>

            <form onSubmit={handleConfirmStopOrder} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Cancellation Reason
                </label>
                <select
                  value={stopReason}
                  onChange={(e) => setStopReason(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-subtle)', color: '#fff', fontSize: '0.9rem' }}
                >
                  <option value="DISCHARGE_EARLY" style={{ background: '#0f172a' }}>Patient Discharged Early</option>
                  <option value="DOSAGE_ADJUSTMENT" style={{ background: '#0f172a' }}>Physician Dosage Adjustment / Order Change</option>
                  <option value="ADVERSE_REACTION" style={{ background: '#0f172a' }}>Adverse Drug Event / Allergy Flag</option>
                  <option value="TREATMENT_COMPLETE" style={{ background: '#0f172a' }}>Treatment Completed Ahead of Schedule</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Doctor Clinical Notes
                </label>
                <textarea
                  value={stopNotes}
                  onChange={(e) => setStopNotes(e.target.value)}
                  rows={3}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-subtle)', color: '#fff', fontSize: '0.9rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setSelectedRx(null)}>
                  Keep Prescription Active
                </button>
                <button type="submit" className="btn-rose" style={{ padding: '10px 20px' }}>
                  <XCircle size={16} /> Confirm Stop-Order
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
