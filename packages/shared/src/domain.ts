import type { Frequency } from './frequency'

export type Role = 'pharmacist' | 'nurse' | 'doctor'
export type Gender = 'Male' | 'Female' | 'Other'
export type MedRoute = 'Oral' | 'IV' | 'IM' | 'SC' | 'Topical' | 'Inhaled'
export type FoodTiming = 'before-food' | 'after-food' | 'with-food' | 'not-applicable'
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night'
export type PatientStatus = 'admitted' | 'discharged'
export type PrescriptionStatus = 'active' | 'stopped' | 'completed'
export type SweepStatus = 'pending' | 'swept' | 'dispensed'
export type StockStatus = 'ok' | 'low' | 'critical'
export type BillingStatus = 'billed' | 'pending' | 'voided'

export interface Ward {
  id: string
  /** Short identifier, e.g. "Ward 4A". */
  code: string
  /** Specialty, e.g. "General Medicine". */
  name: string
  /** Composed display string, e.g. "Ward 4A — General Medicine". */
  label: string
  sweepStatus: SweepStatus
  activePatients: number
}

export interface Drug {
  id: string
  /** Composed display string, e.g. "Furosemide 40mg". */
  label: string
  name: string
  strength: string
  form: string
  category: string
  unitPrice: number
}

export interface Prescription {
  id: string
  drugId: string
  /** Denormalised drug label so list views need no join client-side. */
  drug: string
  dose: string
  route: MedRoute
  frequency: Frequency
  foodTiming: FoodTiming
  timeOfDay: TimeOfDay[]
  startDate: string
  durationDays: number
  /** Derived server-side: days since startDate + 1. Never stored. */
  currentDay: number
  status: PrescriptionStatus
  stopReason?: string
  notes?: string
  prescribedBy: string
  prescribedAt: string
}

export interface Patient {
  id: string
  mrn: string
  name: string
  dateOfBirth: string
  gender: Gender
  phone: string
  /** Ward code, e.g. "Ward 4A". */
  ward: string
  wardId: string
  bed: string
  admissionDate: string
  diagnosis: string
  allergies: string
  status: PatientStatus
  prescriptions: Prescription[]
}

export interface InventoryItem {
  id: string
  drugId: string
  drug: string
  category: string
  unit: string
  currentStock: number
  reorderLevel: number
  /** Derived server-side from currentStock and reorderLevel. Never stored. */
  status: StockStatus
}

export interface Transaction {
  id: string
  batchId: string
  patient: string
  ward: string
  drug: string
  qty: number
  unitPrice: number
  total: number
  timestamp: string
  status: BillingStatus
}

export type ActivityType = 'dispense' | 'prescription' | 'stop' | 'restock' | 'register'

export interface ActivityItem {
  id: string
  /** HH:MM, already formatted for display. */
  time: string
  /** YYYY-MM-DD. */
  date: string
  type: ActivityType
  patient?: string
  ward?: string
  drug?: string
  text: string
  status?: BillingStatus
}
