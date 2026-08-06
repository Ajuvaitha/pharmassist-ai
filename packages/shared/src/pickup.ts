import type { MedRoute, SweepStatus } from './domain'

export interface PickupLine {
  lineId: string
  drug: string
  dose: string
  route: MedRoute
  qty: number
  treatmentDay: number
  durationDays: number
  status: 'pending' | 'dispensed' | 'cancelled'
}

/** The shape WardSweepPage renders, one entry per patient. */
export interface PickupPatient {
  patientId: string
  name: string
  mrn: string
  bed: string
  medicines: PickupLine[]
  dispensed: boolean
}

export interface WardPickupList {
  wardId: string
  wardCode: string
  date: string
  status: SweepStatus
  patients: PickupPatient[]
}

export interface SweepWardResult {
  wardId: string
  wardCode: string
  indentId: string | null
  lineCount: number
  patientCount: number
  status: SweepStatus
}

export interface SweepResult {
  date: string
  preview: boolean
  wards: SweepWardResult[]
}
