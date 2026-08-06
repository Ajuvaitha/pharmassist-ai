import { useState } from 'react'
import { ApiError } from '../api/client'
import { useLogin } from '../api/auth'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const login = useLogin()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) return
    login.mutate({ username, password })
  }

  const errorMessage =
    login.error instanceof ApiError
      ? login.error.message
      : login.error
        ? 'Could not reach the server. Check your connection and try again.'
        : null

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Username</label>
              <input
                type="text"
                placeholder="e.g. k.asante"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
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
                autoComplete="current-password"
                style={inputStyle}
              />
            </div>
          </div>

          {errorMessage && (
            <div style={{
              padding: '10px 14px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 6,
              fontSize: 13,
              color: '#DC2626',
            }}>
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            style={{
              background: '#0AADA8',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '11px 0',
              fontSize: 14,
              fontWeight: 600,
              cursor: login.isPending ? 'default' : 'pointer',
              opacity: login.isPending ? 0.7 : 1,
              transition: 'opacity 0.12s',
            }}
          >
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </button>

          <p style={{ fontSize: 12, color: '#94A3B8', margin: 0, textAlign: 'center' }}>
            Your role and assigned ward come from your account.
          </p>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#64748B', marginTop: 20 }}>
          Korle Bu Teaching Hospital · Pharmacy Dept.
        </p>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: '#64748B',
  marginBottom: 5,
}

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
}
