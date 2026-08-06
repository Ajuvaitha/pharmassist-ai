export type Role = 'pharmacist' | 'nurse' | 'doctor';
export type Page =
  | 'login'
  | 'dashboard'
  | 'ward-sweep'
  | 'patient-detail'
  | 'recent-activity'
  | 'patients'
  | 'inventory'
  | 'billing'
  | 'register-patient'
  | 'doctor-patients'
  | 'doctor';

export interface Ward {
  id: string;
  name: string;
  sweepStatus: 'pending' | 'swept' | 'dispensed';
  activePatients: number;
}

export type FoodTiming = 'before-food' | 'after-food' | 'with-food' | 'not-applicable';
export type MedRoute = 'Oral' | 'IV' | 'IM' | 'SC' | 'Topical' | 'Inhaled';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export interface Prescription {
  id: string;
  drug: string;
  dose: string;
  route: MedRoute;
  frequency: string;
  foodTiming: FoodTiming;
  timeOfDay: TimeOfDay[];
  startDate: string;
  durationDays: number;
  currentDay: number;
  status: 'active' | 'stopped' | 'completed';
  stopReason?: string;
  notes?: string;
  prescribedBy: string;
  prescribedAt: string;
}

export interface Patient {
  id: string;
  mrn: string;
  name: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female' | 'Other';
  phone: string;
  ward: string;
  bed: string;
  admissionDate: string;
  diagnosis: string;
  allergies: string;
  prescriptions: Prescription[];
}

export interface InventoryItem {
  id: string;
  drug: string;
  category: string;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  status: 'ok' | 'low' | 'critical';
}

export interface Transaction {
  id: string;
  batchId: string;
  patient: string;
  ward: string;
  drug: string;
  qty: number;
  unitPrice: number;
  total: number;
  timestamp: string;
  status: 'billed' | 'pending' | 'voided';
}
