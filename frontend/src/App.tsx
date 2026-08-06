import { useState } from 'react';
import type { Page } from './types';
import { useLogout, useMe } from './api/auth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import WardSweepPage from './pages/WardSweepPage';
import PatientsPage from './pages/PatientsPage';
import PatientDetailPage from './pages/PatientDetailPage';
import InventoryPage from './pages/InventoryPage';
import BillingPage from './pages/BillingPage';
import RegisterPatientPage from './pages/RegisterPatientPage';
import DoctorPatientsPage from './pages/DoctorPatientsPage';
import DoctorPage from './pages/DoctorPage';
import RecentActivityPage from './pages/RecentActivityPage';
import Layout from './components/Layout';

export default function App() {
  const { data: me, isLoading } = useMe();
  const logout = useLogout();

  const [page, setPage] = useState<Page | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const navigate = (p: Page) => {
    setPage(p);
    if (p !== 'patient-detail') setSelectedPatientId(null);
  };

  const openPatient = (patientId: string) => {
    setSelectedPatientId(patientId);
    setPage('patient-detail');
  };

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#F0F9FB',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, color: '#64748B',
      }}>
        Loading…
      </div>
    );
  }

  if (!me) return <LoginPage />;

  const role = me.role;
  const user = me.displayName;
  const ward = me.ward?.label ?? '';
  // Doctors land on their own patient list; everyone else on the dashboard.
  const activePage: Page = page ?? (role === 'doctor' ? 'doctor-patients' : 'dashboard');

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage role={role} ward={ward} />;
      case 'ward-sweep':
        return <WardSweepPage />;
      case 'patients':
        return <PatientsPage onSelectPatient={openPatient} />;
      case 'patient-detail':
        return selectedPatientId
          ? <PatientDetailPage patientId={selectedPatientId} onBack={() => navigate('patients')} />
          : null;
      case 'inventory':
        return <InventoryPage />;
      case 'billing':
        return <BillingPage />;
      case 'register-patient':
        return <RegisterPatientPage />;
      case 'doctor-patients':
        return <DoctorPatientsPage doctorName={user} />;
      case 'doctor':
        return <DoctorPage />;
      case 'recent-activity':
        return <RecentActivityPage />;
      default:
        return <DashboardPage role={role} ward={ward} />;
    }
  };

  return (
    <Layout
      role={role}
      page={activePage}
      user={user}
      ward={ward}
      onNavigate={navigate}
      onLogout={() => logout.mutate()}
    >
      {renderPage()}
    </Layout>
  );
}
