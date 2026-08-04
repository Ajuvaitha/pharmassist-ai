import React, { useState, useEffect } from 'react';
import { Activity, Clock, ShieldCheck, Pill, ClipboardList, Bed, Receipt, Code2, Sparkles } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, activePrescriptionsCount, readyPickupsCount }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="glass-panel" style={{ borderRadius: '0 0 20px 20px', marginBottom: '24px', padding: '16px 28px', borderTop: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        
        {/* Brand / Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(56, 189, 248, 0.4)'
          }}>
            <Pill size={26} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #ffffff 0%, #38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Pharmassist
              </h1>
              <span className="glow-pill-cyan">Module 3</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Inpatient Daily Unit-Dose Auto-Indent Engine
            </p>
          </div>
        </div>

        {/* Live System Status & Cron Widget */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
          
          <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid var(--border-subtle)', padding: '8px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="pulse-dot"></div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>06:00 AM Cron Engine</div>
              <div style={{ fontSize: '0.84rem', color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={14} /> Active Daily Worker
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid var(--border-subtle)', padding: '8px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={18} color="var(--primary-cyan)" />
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>System Clock</div>
              <div className="code-font" style={{ fontSize: '0.88rem', color: 'var(--text-main)', fontWeight: 600 }}>
                {time.toLocaleTimeString()}
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        
        <button
          className={`btn-secondary ${activeTab === 'sweep' ? 'active-tab' : ''}`}
          onClick={() => setActiveTab('sweep')}
          style={{
            background: activeTab === 'sweep' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(15, 23, 42, 0.6)',
            borderColor: activeTab === 'sweep' ? 'var(--primary-cyan)' : 'var(--border-subtle)',
            color: activeTab === 'sweep' ? '#38bdf8' : 'var(--text-muted)'
          }}
        >
          <ClipboardList size={18} />
          6:00 AM Ward Indents
          {readyPickupsCount > 0 && <span className="glow-pill-cyan" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>{readyPickupsCount} Ready</span>}
        </button>

        <button
          className={`btn-secondary ${activeTab === 'prescribe' ? 'active-tab' : ''}`}
          onClick={() => setActiveTab('prescribe')}
          style={{
            background: activeTab === 'prescribe' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(15, 23, 42, 0.6)',
            borderColor: activeTab === 'prescribe' ? 'var(--primary-cyan)' : 'var(--border-subtle)',
            color: activeTab === 'prescribe' ? '#38bdf8' : 'var(--text-muted)'
          }}
        >
          <Pill size={18} />
          Doctor Rx Entry & Batches
        </button>

        <button
          className={`btn-secondary ${activeTab === 'patients' ? 'active-tab' : ''}`}
          onClick={() => setActiveTab('patients')}
          style={{
            background: activeTab === 'patients' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(15, 23, 42, 0.6)',
            borderColor: activeTab === 'patients' ? 'var(--primary-cyan)' : 'var(--border-subtle)',
            color: activeTab === 'patients' ? '#38bdf8' : 'var(--text-muted)'
          }}
        >
          <Bed size={18} />
          Inpatient Bed & Rx Monitor
          <span className="glow-pill-emerald" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>{activePrescriptionsCount} Active</span>
        </button>

        <button
          className={`btn-secondary ${activeTab === 'billing' ? 'active-tab' : ''}`}
          onClick={() => setActiveTab('billing')}
          style={{
            background: activeTab === 'billing' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(15, 23, 42, 0.6)',
            borderColor: activeTab === 'billing' ? 'var(--primary-cyan)' : 'var(--border-subtle)',
            color: activeTab === 'billing' ? '#38bdf8' : 'var(--text-muted)'
          }}
        >
          <Receipt size={18} />
          Pharmacy Ledger & Auto-Billing
        </button>

        <button
          className={`btn-secondary ${activeTab === 'apidocs' ? 'active-tab' : ''}`}
          onClick={() => setActiveTab('apidocs')}
          style={{
            background: activeTab === 'apidocs' ? 'rgba(139, 92, 246, 0.18)' : 'rgba(15, 23, 42, 0.6)',
            borderColor: activeTab === 'apidocs' ? '#a78bfa' : 'var(--border-subtle)',
            color: activeTab === 'apidocs' ? '#a78bfa' : 'var(--text-muted)'
          }}
        >
          <Code2 size={18} />
          API Docs & Playground
        </button>

      </div>
    </header>
  );
}
