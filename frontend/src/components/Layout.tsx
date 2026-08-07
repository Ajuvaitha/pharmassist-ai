import type { Role, Page } from '../types';
import ChatAssistant from './ChatAssistant';

function GridIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/><rect x="8.5" y="1" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="8.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/></svg>;
}
function SweepIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 7.5h11M8 3l4 4.5-4 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function PatientsIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M2 13c0-2.761 2.462-5 5.5-5s5.5 2.239 5.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
}
function BoxIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 5l5.5-3 5.5 3v5L7.5 13 2 10V5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M7.5 2v11M2 5l5.5 3 5.5-3" stroke="currentColor" strokeWidth="1.3"/></svg>;
}
function LedgerIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="2" y="2" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 5.5h5M5 7.5h5M5 9.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
}
function DocIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M4 2h7a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3"/><path d="M5 5.5h5M5 7.5h5M5 9.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
}
function AddPersonIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="6.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 13c0-2.761 2.239-5 5.5-5 1.27 0 2.44.43 3.37 1.15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M11.5 9.5v4M9.5 11.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
}
function ActivityIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1.5 7.5h2l1.5-4 2 8 2-9 1.5 5H13.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function PenIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M10.5 2.5l2 2L5 12H3v-2l7.5-7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M8.5 4.5l2 2" stroke="currentColor" strokeWidth="1.3"/></svg>;
}

interface LayoutProps {
  role: Role;
  page: Page;
  user: string;
  ward: string;
  onNavigate: (page: Page) => void;
  children: React.ReactNode;
}

const NAV_PHARMACIST: NavItem[] = [
  { page: 'dashboard', label: 'Dashboard', icon: <GridIcon /> },
  { page: 'ward-sweep', label: 'Ward Sweep', icon: <SweepIcon /> },
  { page: 'patients', label: 'Patients', icon: <PatientsIcon /> },
  { page: 'inventory', label: 'Inventory', icon: <BoxIcon /> },
  { page: 'billing', label: 'Billing Ledger', icon: <LedgerIcon /> },
  { page: 'recent-activity', label: 'Recent Activity', icon: <ActivityIcon /> },
];

const NAV_NURSE: NavItem[] = [
  { page: 'dashboard', label: 'Dashboard', icon: <GridIcon /> },
  { page: 'ward-sweep', label: 'Ward Pickup', icon: <SweepIcon /> },
  { page: 'patients', label: 'Patients', icon: <PatientsIcon /> },
  { page: 'register-patient', label: 'Register Patient', icon: <AddPersonIcon /> },
];

const NAV_DOCTOR: NavItem[] = [
  { page: 'doctor-patients', label: 'Patients', icon: <PatientsIcon /> },
  { page: 'prescription-writer', label: 'Prescription Writer', icon: <PenIcon /> },
  { page: 'doctor', label: 'My Prescriptions', icon: <DocIcon /> },
];

interface NavItem { page: Page; label: string; icon: React.ReactNode; }

function navItems(role: Role): NavItem[] {
  if (role === 'nurse') return NAV_NURSE;
  if (role === 'doctor') return NAV_DOCTOR;
  return NAV_PHARMACIST;
}

const ROLE_LABELS: Record<Role, string> = { pharmacist: 'Pharmacist', nurse: 'Nurse', doctor: 'Doctor' };
const ROLE_COLORS: Record<Role, { bg: string; color: string }> = {
  pharmacist: { bg: '#D4F0EF', color: '#0AADA8' },
  nurse:      { bg: '#DBEAFE', color: '#2563EB' },
  doctor:     { bg: '#FEF3C7', color: '#D97706' },
};

export default function Layout({ role, page, user, ward, onNavigate, children }: LayoutProps) {
  const items = navItems(role);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const roleStyle = ROLE_COLORS[role];

  return (
    <>
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#E8F3F8' }}>
      {/* Sidebar */}
      <aside style={{
        width: 228, flexShrink: 0, background: '#fff',
        borderRight: '1px solid #D9E8EF', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid #D9E8EF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, background: '#0AADA8', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4 9h10M9 4v10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
                <circle cx="9" cy="9" r="7" stroke="#fff" strokeWidth="1.6"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Pharmassist</div>
              <div style={{ fontSize: 10, color: '#64748B', fontWeight: 400 }}>Korle Bu Teaching Hospital</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map(item => {
            const active = item.page === page;
            return (
              <button
                key={item.page}
                onClick={() => onNavigate(item.page)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '9px 12px',
                  border: 'none', cursor: 'pointer',
                  textAlign: 'left', fontFamily: 'inherit',
                  borderRadius: 8,
                  background: active ? '#0AADA8' : 'transparent',
                  color: active ? '#fff' : '#475569',
                  fontWeight: active ? 600 : 400,
                  fontSize: 13.5,
                  transition: 'all 0.12s',
                }}
                onMouseOver={e => {
                  if (!active) {
                    e.currentTarget.style.background = '#F0FAFA';
                    e.currentTarget.style.color = '#0AADA8';
                  }
                }}
                onMouseOut={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#475569';
                  }
                }}
              >
                <span style={{ color: active ? '#fff' : '#94A3B8', flexShrink: 0, display: 'flex', transition: 'color 0.12s' }}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid #D9E8EF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: roleStyle.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: roleStyle.color, flexShrink: 0,
            }}>
              {user.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user}</div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', padding: '0px 6px',
                background: roleStyle.bg, color: roleStyle.color,
                borderRadius: 20, fontSize: 10, fontWeight: 600, marginTop: 2,
              }}>
                {ROLE_LABELS[role]}
              </div>
            </div>
          </div>
          {role === 'nurse' && (
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 8, paddingLeft: 2 }}>{ward.split(' — ')[0]}</div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <header style={{
          height: 54, background: '#fff', borderBottom: '1px solid #D9E8EF',
          display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0,
        }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Breadcrumb */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" stroke="#CBD5E1" strokeWidth="1.3"/>
              <rect x="8" y="1" width="5" height="5" rx="1" stroke="#CBD5E1" strokeWidth="1.3"/>
              <rect x="1" y="8" width="5" height="5" rx="1" stroke="#CBD5E1" strokeWidth="1.3"/>
              <rect x="8" y="8" width="5" height="5" rx="1" stroke="#CBD5E1" strokeWidth="1.3"/>
            </svg>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>Pharmassist</span>
            {role === 'nurse' && (
              <>
                <span style={{ color: '#CBD5E1', fontSize: 12 }}>/</span>
                <span style={{ fontSize: 12, color: '#0F172A', fontWeight: 500 }}>{ward.split(' — ')[0]}</span>
              </>
            )}
          </div>

          {/* Right: date + notification dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#64748B' }}>{dateStr}</span>
              <span style={{ fontSize: 12, color: '#CBD5E1' }}>·</span>
              <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: '#0F172A', fontWeight: 500 }}>{timeStr}</span>
            </div>

            {/* Notification bell */}
            <div style={{ position: 'relative', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2a5 5 0 00-5 5v3l-1.5 2H15.5L14 10V7a5 5 0 00-5-5z" stroke="#64748B" strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M7 14a2 2 0 004 0" stroke="#64748B" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <span style={{
                position: 'absolute', top: -2, right: -2,
                width: 7, height: 7, borderRadius: '50%',
                background: '#DC2626', border: '1.5px solid #fff',
              }} />
            </div>

            {/* User chip */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '4px 10px', border: '1px solid #D9E8EF',
              borderRadius: 20, cursor: 'pointer', background: '#F8FBFC',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: ROLE_COLORS[role].bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: ROLE_COLORS[role].color,
              }}>
                {user.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#0F172A' }}>{user}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2.5 4l2.5 2.5L7.5 4" stroke="#94A3B8" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {children}
        </main>
      </div>
    </div>
    <ChatAssistant />
    </>
  );
}
