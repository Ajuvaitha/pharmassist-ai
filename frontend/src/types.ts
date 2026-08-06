/**
 * Domain types live in @pharmassist/shared so the backend and frontend
 * cannot drift. This module re-exports them, plus the frontend-only
 * navigation type.
 */
export type {
  BillingStatus,
  Drug,
  FoodTiming,
  Gender,
  InventoryItem,
  MedRoute,
  Patient,
  PatientStatus,
  Prescription,
  PrescriptionStatus,
  Role,
  StockStatus,
  SweepStatus,
  TimeOfDay,
  Transaction,
  Ward,
} from '@pharmassist/shared'

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
  | 'doctor'
