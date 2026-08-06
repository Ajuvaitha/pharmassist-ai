import { useState } from 'react';
import type { Role, Page, Patient, Prescription } from './types';
import { INITIAL_PATIENTS } from './data';
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
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState<Role>('pharmacist');
  const [page, setPage] = useState<Page>('dashboard');
  const [user, setUser] = useState('K. Asante');
  const [ward, setWard] = useState('Ward 4A — General Medicine');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);

  const handleLogin = (r: Role, u: string, w: string) => {
    setRole(r);
    setUser(u || (r === 'pharmacist' ? 'K. Asante' : r === 'nurse' ? 'A. Owusu' : 'Dr. B. Kwame'));
    setWard(w);
    setPage(r === 'doctor' ? 'doctor-patients' : 'dashboard');
    setLoggedIn(true);
  };

  const navigate = (p: Page) => {
    setPage(p);
    if (p !== 'patient-detail') setSelectedPatientId(null);
  };

  const openPatient = (patient: Patient) => {
    setSelectedPatientId(patient.id);
    setPage('patient-detail');
  };

  const registerPatient = (patient: Patient) => {
    setPatients(prev => [...prev, patient]);
  };

  const addPrescription = (patientId: string, rx: Omit<Prescription, 'id' | 'currentDay' | 'status'>) => {
    setPatients(prev => prev.map(p =>
      p.id === patientId
        ? { ...p, prescriptions: [...p.prescriptions, { ...rx, id: `rx-${Date.now()}`, currentDay: 1, status: 'active' as const }] }
        : p
    ));
  };

  const editPrescription = (patientId: string, rxId: string, rx: Omit<Prescription, 'id' | 'currentDay' | 'status'>) => {
    setPatients(prev => prev.map(p =>
      p.id === patientId
        ? { ...p, prescriptions: p.prescriptions.map(r => r.id === rxId ? { ...r, ...rx } : r) }
        : p
    ));
  };

  const stopPrescription = (patientId: string, rxId: string, reason: string) => {
    setPatients(prev => prev.map(p =>
      p.id === patientId
        ? { ...p, prescriptions: p.prescriptions.map(r => r.id === rxId ? { ...r, status: 'stopped' as const, stopReason: reason } : r) }
        : p
    ));
  };

  if (!loggedIn) return <LoginPage onLogin={handleLogin} />;

  const selectedPatient = selectedPatientId ? patients.find(p => p.id === selectedPatientId) : null;

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <DashboardPage role={role} ward={ward} patients={patients} />;
      case 'ward-sweep':
        return <WardSweepPage patients={patients} />;
      case 'patients':
        return <PatientsPage patients={patients} onSelectPatient={openPatient} />;
      case 'patient-detail':
        return selectedPatient
          ? <PatientDetailPage patient={selectedPatient} onBack={() => navigate('patients')} onStopPrescription={stopPrescription} />
          : null;
      case 'inventory':
        return <InventoryPage />;
      case 'billing':
        return <BillingPage />;
      case 'register-patient':
        return <RegisterPatientPage onRegister={registerPatient} />;
      case 'doctor-patients':
        return (
          <DoctorPatientsPage
            patients={patients}
            doctorName={user}
            onAddPrescription={addPrescription}
            onEditPrescription={editPrescription}
          />
        );
      case 'doctor':
        return <DoctorPage />;
      case 'recent-activity':
        return <RecentActivityPage />;
      default:
        return <DashboardPage role={role} ward={ward} patients={patients} />;
    }
  };

  return (
    <Layout role={role} page={page} user={user} ward={ward} onNavigate={navigate}>
      {renderPage()}
    </Layout>
  );
}
