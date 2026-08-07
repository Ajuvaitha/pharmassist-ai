import type { Prisma } from '@prisma/client'
import {
  wardLabel,
  type InventoryItem,
  type Patient,
  type Prescription,
  type StockStatus,
  type SweepStatus,
  type Transaction,
  type Ward,
} from '@pharmassist/shared'
import { toFoodTimingWire } from './enums'
import { toDateString, todayUtc, treatmentDayFor } from './dates'

/**
 * Prisma serialises Decimal to a JSON *string*, but the shared wire types
 * declare money as `number`. Every money field crosses this function on
 * its way out; a route that sends a raw Prisma row ships a string where
 * the client expects a number and `toFixed` throws.
 */
export function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber()
}

/** Mirrors the threshold the UI used before it had a backend. */
export function stockStatusFor(currentStock: number, reorderLevel: number): StockStatus {
  if (currentStock <= reorderLevel * 0.2) return 'critical'
  if (currentStock <= reorderLevel) return 'low'
  return 'ok'
}

type PrescriptionRow = {
  id: string
  drugId: string
  dose: string
  route: Prescription['route']
  frequency: Prescription['frequency']
  foodTiming: Parameters<typeof toFoodTimingWire>[0]
  timeOfDay: Prescription['timeOfDay']
  startDate: Date
  durationDays: number
  status: 'active' | 'stopped' | 'completed'
  stopReason: string | null
  notes: string | null
  prescribedAt: Date
  editedAt: Date | null
  drug: { label: string }
  prescribedBy: { displayName: string }
}

/**
 * `currentDay` is derived, never stored. An `active` prescription whose
 * course has elapsed reports as `completed` — but a `stopped` one is
 * never reinterpreted, because a stop order is a clinical decision that
 * outranks the calendar.
 */
export function toPrescriptionDto(rx: PrescriptionRow, on: Date = todayUtc()): Prescription {
  const currentDay = treatmentDayFor(rx.startDate, on)
  const status = rx.status === 'active' && currentDay > rx.durationDays ? 'completed' : rx.status

  return {
    id: rx.id,
    drugId: rx.drugId,
    drug: rx.drug.label,
    dose: rx.dose,
    route: rx.route,
    frequency: rx.frequency,
    foodTiming: toFoodTimingWire(rx.foodTiming),
    timeOfDay: rx.timeOfDay,
    startDate: toDateString(rx.startDate),
    durationDays: rx.durationDays,
    currentDay,
    status,
    ...(rx.stopReason ? { stopReason: rx.stopReason } : {}),
    ...(rx.notes ? { notes: rx.notes } : {}),
    prescribedBy: rx.prescribedBy.displayName,
    prescribedAt: rx.prescribedAt.toISOString(),
    editedAt: rx.editedAt?.toISOString() ?? null,
  }
}

type PatientRow = {
  id: string
  mrn: string
  name: string
  dateOfBirth: Date
  gender: Patient['gender']
  phone: string
  wardId: string
  bed: string
  admissionDate: Date
  diagnosis: string
  allergies: string
  status: Patient['status']
  ward: { code: string }
  prescriptions: PrescriptionRow[]
}

export function toPatientDto(patient: PatientRow, on: Date = todayUtc()): Patient {
  return {
    id: patient.id,
    mrn: patient.mrn,
    name: patient.name,
    dateOfBirth: toDateString(patient.dateOfBirth),
    gender: patient.gender,
    phone: patient.phone,
    ward: patient.ward.code,
    wardId: patient.wardId,
    bed: patient.bed,
    admissionDate: toDateString(patient.admissionDate),
    diagnosis: patient.diagnosis,
    allergies: patient.allergies,
    status: patient.status,
    prescriptions: patient.prescriptions.map((rx) => toPrescriptionDto(rx, on)),
  }
}

type InventoryRow = {
  id: string
  drugId: string
  currentStock: number
  reorderLevel: number
  drug: {
    id: string
    label: string
    name: string
    strength: string
    form: string
    category: string
    unitPrice: Prisma.Decimal
  }
}

export function toInventoryDto(item: InventoryRow): InventoryItem {
  return {
    id: item.id,
    drugId: item.drugId,
    drug: item.drug.label,
    category: item.drug.category,
    unit: item.drug.form,
    currentStock: item.currentStock,
    reorderLevel: item.reorderLevel,
    status: stockStatusFor(item.currentStock, item.reorderLevel),
  }
}

export function toWardDto(
  ward: { id: string; code: string; name: string },
  opts: { sweepStatus: SweepStatus; activePatients: number },
): Ward {
  return {
    id: ward.id,
    code: ward.code,
    name: ward.name,
    label: wardLabel(ward),
    sweepStatus: opts.sweepStatus,
    activePatients: opts.activePatients,
  }
}

type BillingRow = {
  id: string
  qty: number
  unitPrice: Prisma.Decimal
  total: Prisma.Decimal
  status: Transaction['status']
  createdAt: Date
  patient: { name: string }
  ward: { code: string }
  drug: { label: string }
  indentLine: { indent: { id: string; indentDate: Date } }
}

export function toTransactionDto(line: BillingRow): Transaction {
  return {
    id: line.id,
    // The UI's batchId is the parent indent — stored once, not duplicated
    // onto every billing line.
    batchId: line.indentLine.indent.id,
    patient: line.patient.name,
    ward: line.ward.code,
    drug: line.drug.label,
    qty: line.qty,
    unitPrice: decimalToNumber(line.unitPrice),
    total: decimalToNumber(line.total),
    timestamp: line.createdAt.toISOString(),
    status: line.status,
  }
}
