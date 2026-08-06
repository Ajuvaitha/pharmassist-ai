import { useState } from 'react';
import type { Patient } from '../types';

interface RegisterPatientPageProps {
  onRegister: (patient: Patient) => void;
}

const WARDS = ['Ward 4A', 'Ward 5B', 'Ward 6C', 'Ward 2D'];
const BEDS = Array.from({ length: 20 }, (_, i) => `Bed ${String(i + 1).padStart(2, '0')}`);

function generateMRN() {
  return `MRN-${String(Math.floor(10000 + Math.random() * 90000))}`;
}

export default function RegisterPatientPage({ onRegister }: RegisterPatientPageProps) {
  const [submitted, setSubmitted] = useState(false);
  const [registeredName, setRegisteredName] = useState('');

  const [form, setForm] = useState({
    name: '',
    dateOfBirth: '',
    gender: 'Female' as Patient['gender'],
    phone: '',
    ward: WARDS[0],
    bed: BEDS[0],
    admissionDate: new Date().toISOString().split('T')[0],
    diagnosis: '',
    allergies: 'None known',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const patient: Patient = {
      id: `p-${Date.now()}`,
      mrn: generateMRN(),
      name: form.name.trim(),
      dateOfBirth: form.dateOfBirth,
      gender: form.gender,
      phone: form.phone.trim(),
      ward: form.ward,
      bed: form.bed,
      admissionDate: form.admissionDate,
      diagnosis: form.diagnosis.trim(),
      allergies: form.allergies.trim(),
      prescriptions: [],
    };
    onRegister(patient);
    setRegisteredName(patient.name);
    setSubmitted(true);
    setForm({
      name: '', dateOfBirth: '', gender: 'Female', phone: '',
      ward: WARDS[0], bed: BEDS[0],
      admissionDate: new Date().toISOString().split('T')[0],
      diagnosis: '', allergies: 'None known',
    });
  };

  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>
          Register Patient
        </h1>
        <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
          Patient details will be available to doctors for prescribing and to pharmacists for dispensing.
        </p>
      </div>

      {submitted && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', background: '#DCFCE7', border: '1px solid #A7F3D0',
          borderRadius: 8, marginBottom: 20, fontSize: 13, color: '#16A34A', fontWeight: 500,
        }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="7.5" cy="7.5" r="6.5" stroke="#16A34A" strokeWidth="1.3"/>
            <path d="M4.5 7.5l2.5 2.5 4-4" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <strong>{registeredName}</strong> has been registered. A doctor can now add prescriptions.
        </div>
      )}

      <form onSubmit={handleSubmit} style={{
        background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8, padding: 24,
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <Section title="Personal Information">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Full name</label>
              <input required value={form.name} onChange={set('name')} placeholder="e.g. Ama Boateng" style={inp} />
            </div>
            <div>
              <label style={lbl}>Date of birth</label>
              <input required type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Gender</label>
              <select value={form.gender} onChange={set('gender')} style={inp}>
                <option>Female</option>
                <option>Male</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Phone number</label>
              <input value={form.phone} onChange={set('phone')} placeholder="+233 24 000 0000" style={inp} />
            </div>
          </div>
        </Section>

        <div style={{ height: 1, background: '#D9E8EF' }} />

        <Section title="Admission Details">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Ward</label>
              <select value={form.ward} onChange={set('ward')} style={inp}>
                {WARDS.map(w => <option key={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Bed</label>
              <select value={form.bed} onChange={set('bed')} style={inp}>
                {BEDS.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Admission date</label>
              <input type="date" value={form.admissionDate} onChange={set('admissionDate')} style={inp} />
            </div>
          </div>
        </Section>

        <div style={{ height: 1, background: '#D9E8EF' }} />

        <Section title="Clinical Information">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={lbl}>Diagnosis / presenting condition</label>
              <textarea
                required
                value={form.diagnosis}
                onChange={set('diagnosis')}
                rows={2}
                placeholder="e.g. Type 2 Diabetes Mellitus, Hypertension"
                style={{ ...inp, resize: 'vertical', minHeight: 60 }}
              />
            </div>
            <div>
              <label style={lbl}>Known allergies</label>
              <input
                value={form.allergies}
                onChange={set('allergies')}
                placeholder="e.g. Penicillin, Sulfonamides, or 'None known'"
                style={inp}
              />
            </div>
          </div>
        </Section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
          <button type="submit" style={{
            padding: '10px 24px',
            border: 'none', borderRadius: 6,
            background: '#0AADA8', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Register Patient
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 500, color: '#64748B', marginBottom: 5 };
const inp: React.CSSProperties = {
  width: '100%', padding: '8px 10px',
  border: '1px solid #D9E8EF', borderRadius: 6,
  fontSize: 13, color: '#0F172A', background: '#fff',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
