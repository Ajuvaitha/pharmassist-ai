import React, { useState } from 'react';
import { Pill, Calendar, Clock, PlusCircle, CheckCircle2, User, Stethoscope, Sparkles } from 'lucide-react';

export default function PrescriptionEntry({ patients, drugs, onAddPrescription }) {
  const [patientId, setPatientId] = useState(patients[0]?.patient_id || '');
  const [drugId, setDrugId] = useState(drugs[0]?.id || '');
  const [dailyDosageQty, setDailyDosageQty] = useState(3);
  const [frequencyCode, setFrequencyCode] = useState('TID');
  const [totalDays, setTotalDays] = useState(7);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('Take post-meals with water.');
  const [successMsg, setSuccessMsg] = useState('');

  const selectedPatient = patients.find(p => p.patient_id === patientId) || patients[0];
  const selectedDrug = drugs.find(d => d.id === drugId) || drugs[0];

  // Compute live 24-hr execution batches array
  const generateBatchTimeline = () => {
    const batches = [];
    const baseDate = new Date(startDate || new Date());
    for (let i = 1; i <= Math.min(totalDays, 14); i++) {
      const currentDate = new Date(baseDate);
      currentDate.setDate(baseDate.getDate() + (i - 1));
      batches.push({
        day: i,
        date: currentDate.toISOString().split('T')[0],
        qty: dailyDosageQty,
        status: i === 1 ? 'PENDING_TODAY_SWEEP' : 'SCHEDULED_AUTOMATIC'
      });
    }
    return batches;
  };

  const batchTimeline = generateBatchTimeline();

  const handleSubmit = (e) => {
    e.preventDefault();
    const newRx = {
      rx_id: `RX-${Math.floor(10000 + Math.random() * 90000)}`,
      patient_id: patientId,
      patient_name: selectedPatient.patient_name,
      bed_number: selectedPatient.bed_number,
      ward_id: selectedPatient.ward_id,
      ward_name: selectedPatient.ward_name,
      drug_id: drugId,
      drug_name: selectedDrug.name,
      daily_dosage_qty: parseInt(dailyDosageQty),
      frequency_code: frequencyCode,
      frequency_desc: frequencyCode === 'TID' ? 'Three times daily' : frequencyCode === 'Q12H' ? 'Every 12 hours' : 'Once daily',
      start_date: startDate,
      current_day: 1,
      total_prescribed_days: parseInt(totalDays),
      prescribing_doctor: 'Dr. Aris Thorne (DOC-402)',
      status: 'ACTIVE',
      notes: notes
    };

    onAddPrescription(newRx);
    setSuccessMsg(`Digital prescription ${newRx.rx_id} registered! ${totalDays} daily 24-hr execution batches partitioned automatically.`);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
      
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span className="glow-pill-cyan"><Stethoscope size={14} /> Doctor EMR Entry</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Zero-Paperwork Inpatient Dispensing Engine</span>
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Single Digital Prescription Entry</h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          Enter multi-day inpatient treatment plan once. The backend scheduler partitions the order into 24-hour execution batches linked to the patient bed.
        </p>

        {successMsg && (
          <div style={{ marginTop: '16px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.4)', color: '#38bdf8', padding: '12px 16px', borderRadius: '10px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} /> {successMsg}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        
        {/* Prescription Form */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
            <PlusCircle size={20} /> Prescription Parameters
          </h3>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Patient Selection */}
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Inpatient Bed / Patient Assignment
              </label>
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-subtle)', color: '#fff', fontSize: '0.9rem' }}
              >
                {patients.map(p => (
                  <option key={p.patient_id} value={p.patient_id} style={{ background: '#0f172a' }}>
                    {p.bed_number} — {p.patient_name} ({p.ward_name})
                  </option>
                ))}
              </select>
            </div>

            {/* Drug Selection */}
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Medication Formulation
              </label>
              <select
                value={drugId}
                onChange={(e) => setDrugId(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-subtle)', color: '#fff', fontSize: '0.9rem' }}
              >
                {drugs.map(d => (
                  <option key={d.id} value={d.id} style={{ background: '#0f172a' }}>
                    {d.name} — ₹{d.unitPrice} per {d.unitOfMeasure}
                  </option>
                ))}
              </select>
            </div>

            {/* Dosage & Frequency */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Daily Units Qty
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={dailyDosageQty}
                  onChange={(e) => setDailyDosageQty(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-subtle)', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Frequency Code
                </label>
                <select
                  value={frequencyCode}
                  onChange={(e) => setFrequencyCode(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-subtle)', color: '#fff', fontSize: '0.9rem' }}
                >
                  <option value="TID" style={{ background: '#0f172a' }}>TID (3x Daily)</option>
                  <option value="Q12H" style={{ background: '#0f172a' }}>Q12H (Every 12h)</option>
                  <option value="QD" style={{ background: '#0f172a' }}>QD (Once Daily)</option>
                </select>
              </div>
            </div>

            {/* Days & Start Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Prescribed Days
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={totalDays}
                  onChange={(e) => setTotalDays(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-subtle)', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-subtle)', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Physician Instructions / Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-subtle)', color: '#fff', fontSize: '0.9rem', resize: 'vertical' }}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>
              <PlusCircle size={18} /> Register Prescription & Schedule Batches
            </button>

          </form>
        </div>

        {/* Real-time 24-hr Execution Batch Partitioning Preview */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} /> Automated 24-Hour Batch Timeline
            </h3>
            <span className="glow-pill-emerald" style={{ fontSize: '0.8rem' }}>
              Total Allocation: {dailyDosageQty * totalDays} Units
            </span>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            The backend engine automatically breaks down this {totalDays}-day order into 24-hr unit-dose execution batches. Pharmacy dispenses strictly 1 batch per day.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
            {batchTimeline.map((batch) => (
              <div
                key={batch.day}
                style={{
                  background: batch.day === 1 ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.7)',
                  border: batch.day === 1 ? '1px solid var(--border-glow)' : '1px solid var(--border-subtle)',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: batch.day === 1 ? '#38bdf8' : '#f8fafc' }}>
                    Day {batch.day} Execution Batch
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                    Scheduled Sweep Date: {batch.date}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: '#34d399', fontSize: '0.92rem' }}>
                    {batch.qty} {selectedDrug.unitOfMeasure}
                  </div>
                  <span className={batch.day === 1 ? 'glow-pill-cyan' : 'glow-pill-amber'} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                    {batch.day === 1 ? 'TODAY 6:00 AM SWEEP' : 'PENDING SCHEDULER'}
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>

    </div>
  );
}
