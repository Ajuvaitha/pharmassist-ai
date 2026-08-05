import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SEED_APPOINTMENTS, SEED_PATIENTS, type Appointment, type Patient } from "@/data/patients";

export interface PrescriptionItem {
  id: string;
  medicineName: string;
  brand: string;
  form: string;
  strength: string;
  quantity: number;
  frequency: string;
  frequencyShort: string;
  timing: "Before food" | "After food";
  durationDays: number;
  instructions: string[];
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  createdAt: string;
  items: PrescriptionItem[];
  followUpDate: string | null;
  notes?: string;
  /** PNG data URLs of doctor's handwritten notes attached to this prescription. */
  handwrittenNotes?: string[];
}

export interface Doctor {
  name: string;
  specialty: string;
  clinic: string;
  regNo: string;
  email: string;
  initials: string;
}

const DOCTOR: Doctor = {
  name: "Dr. Nisha Menon",
  specialty: "General Physician, MBBS MD",
  clinic: "Lotus Family Clinic",
  regNo: "MCI-2291874",
  email: "doctor@clinic.com",
  initials: "NM",
};

const SEED_PRESCRIPTIONS: Prescription[] = [
  {
    id: "RX-20481",
    patientId: "PT-1042",
    patientName: "Rohit Verma",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    followUpDate: null,
    items: [
      {
        id: "i1", medicineName: "Telmisartan", brand: "Telma", form: "Tablet", strength: "40mg",
        quantity: 30, frequency: "Once daily", frequencyShort: "1-0-0", timing: "After food",
        durationDays: 30, instructions: ["Take after food"],
      },
    ],
  },
  {
    id: "RX-20476",
    patientId: "PT-1043",
    patientName: "Meera Iyer",
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    followUpDate: null,
    items: [
      {
        id: "i2", medicineName: "Levocetirizine", brand: "Levocet", form: "Tablet", strength: "5mg",
        quantity: 5, frequency: "Once daily", frequencyShort: "1-0-0", timing: "After food",
        durationDays: 5, instructions: ["Avoid alcohol"],
      },
    ],
  },
];

interface AppState {
  doctor: Doctor;
  /** True once persisted state has been restored on the client. */
  hydrated: boolean;
  patients: Patient[];
  appointments: Appointment[];
  addPatient: (p: Omit<Patient, "id">) => Patient;
  prescriptions: Prescription[];
  savePrescription: (p: Omit<Prescription, "id" | "createdAt">) => Prescription;
}

const Ctx = createContext<AppState | null>(null);

const STORAGE_KEY = "eprescribe.state.v1";

interface PersistedState {
  patients: Patient[];
  prescriptions: Prescription[];
}

function readPersisted(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (typeof parsed !== "object" || parsed === null) return null;
    return {
      patients: Array.isArray(parsed.patients) && parsed.patients.length ? parsed.patients : SEED_PATIENTS,
      prescriptions: Array.isArray(parsed.prescriptions) ? parsed.prescriptions : SEED_PRESCRIPTIONS,
    };
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>(SEED_PATIENTS);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(SEED_PRESCRIPTIONS);
  const [hydrated, setHydrated] = useState(false);
  const skipWrite = useRef(true);

  // Restore after mount so SSR markup and first client render stay identical.
  useEffect(() => {
    const saved = readPersisted();
    if (saved) {
      setPatients(saved.patients);
      setPrescriptions(saved.prescriptions);
    }
    skipWrite.current = false;
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (skipWrite.current || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ patients, prescriptions } satisfies PersistedState),
      );
    } catch {
      /* storage full or blocked — keep working in-memory */
    }
  }, [patients, prescriptions]);


  const addPatient = useCallback((p: Omit<Patient, "id">) => {
    const created: Patient = { ...p, id: `PT-${1047 + Math.floor(Math.random() * 900)}` };
    setPatients((prev) => [created, ...prev]);
    return created;
  }, []);

  const savePrescription = useCallback((p: Omit<Prescription, "id" | "createdAt">) => {
    const created: Prescription = {
      ...p,
      id: `RX-${20500 + Math.floor(Math.random() * 500)}`,
      createdAt: new Date().toISOString(),
    };
    setPrescriptions((prev) => [created, ...prev]);
    return created;
  }, []);

  const value = useMemo<AppState>(
    () => ({
      doctor: DOCTOR,
      hydrated,
      patients,
      appointments: SEED_APPOINTMENTS,
      addPatient,
      prescriptions,
      savePrescription,
    }),
    [hydrated, patients, prescriptions, addPatient, savePrescription],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
