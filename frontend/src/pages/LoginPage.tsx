import { useState } from 'react';
import type { Role } from '../types';

interface LoginPageProps {
  onLogin: (role: Role, user: string, ward: string) => void;
}

const ROLES: { value: Role; label: string; description: string }[] = [
  { value: 'pharmacist', label: 'Pharmacist', description: 'Full dispensing & inventory access' },
  { value: 'nurse', label: 'Nurse', description: 'Ward-scoped pickup & patient view' },
  { value: 'doctor', label: 'Doctor', description: 'Read-only prescription reference' },
];

const WARDS = ['Ward 4A — General Medicine', 'Ward 5B — Cardiology', 'Ward 6C — Orthopaedics', 'Ward 2D — Oncology'];

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [role, setRole] = useState<Role>('pharmacist');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [ward, setWard] = useState(WARDS[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(role, username || 'K. Asante', ward);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F0F9FB',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Wordmark */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 32, height: 32,
              background: '#0AADA8',
              borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4 9h10M9 4v10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="9" cy="9" r="7" stroke="#fff" strokeWidth="1.5"/>
              </svg>
            </div>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' }}>
              Pharmassist
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#64748B', margin: 0, marginLeft: 42 }}>
            Hospital Medication Dispensing System
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{
          background: '#fff',
          border: '1px solid #D9E8EF',
          borderRadius: 8,
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 10 }}>
              Sign in as
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ROLES.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    border: role === r.value ? '1px solid #0AADA8' : '1px solid #D9E8EF',
                    borderRadius: 6,
                    background: role === r.value ? '#D4F0EF' : '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.12s',
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 500, color: role === r.value ? '#0AADA8' : '#0F172A' }}>
                    {r.label}
                  </span>
                  <span style={{ fontSize: 12, color: '#64748B' }}>{r.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Username</label>
              <input
                type="text"
                placeholder="e.g. k.asante"
                value={username}
                onChange={e => setUsername(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={inputStyle}
              />
            </div>

            {role === 'nurse' && (
              <div>
                <label style={labelStyle}>Assigned Ward</label>
                <select value={ward} onChange={e => setWard(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {WARDS.map(w => <option key={w}>{w}</option>)}
                </select>
              </div>
            )}
          </div>

          <button
            type="submit"
            style={{
              background: '#0AADA8',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '11px 0',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.12s',
            }}
            onMouseOver={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseOut={e => (e.currentTarget.style.opacity = '1')}
          >
            Sign in
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#64748B', marginTop: 20 }}>
          Korle Bu Teaching Hospital · Pharmacy Dept.
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: '#64748B',
  marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #D9E8EF',
  borderRadius: 6,
  fontSize: 14,
  color: '#0F172A',
  background: '#fff',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
