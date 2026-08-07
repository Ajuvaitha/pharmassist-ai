import { z } from 'zod'
import { FREQUENCIES } from './frequency'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date')

export const patientListQuerySchema = z.object({
  wardId: z.string().min(1).optional(),
  search: z.string().trim().optional(),
})
export type PatientListQuery = z.infer<typeof patientListQuerySchema>

export const createPatientSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  dateOfBirth: isoDate,
  gender: z.enum(['Male', 'Female', 'Other']),
  phone: z.string().trim(),
  wardId: z.string().min(1, 'Ward is required'),
  bed: z.string().trim().min(1, 'Bed is required'),
  admissionDate: isoDate,
  diagnosis: z.string().trim().min(1, 'Diagnosis is required'),
  allergies: z.string().trim(),
})
export type CreatePatientRequest = z.infer<typeof createPatientSchema>

export const createPrescriptionSchema = z.object({
  drugId: z.string().min(1, 'Drug is required'),
  dose: z.string().trim().min(1, 'Dose is required'),
  route: z.enum(['Oral', 'IV', 'IM', 'SC', 'Topical', 'Inhaled']),
  frequency: z.enum(FREQUENCIES),
  foodTiming: z.enum(['before-food', 'after-food', 'with-food', 'not-applicable']),
  timeOfDay: z.array(z.enum(['morning', 'afternoon', 'evening', 'night'])).min(1, 'Pick at least one time of day'),
  startDate: isoDate,
  durationDays: z.number().int().positive('Duration must be at least one day'),
  notes: z.string().trim().optional(),
})
export type CreatePrescriptionRequest = z.infer<typeof createPrescriptionSchema>

export const updatePrescriptionSchema = createPrescriptionSchema.partial()
export type UpdatePrescriptionRequest = z.infer<typeof updatePrescriptionSchema>

export const stopPrescriptionSchema = z.object({
  reason: z.string().trim().min(1, 'A stop reason is required'),
})
export type StopPrescriptionRequest = z.infer<typeof stopPrescriptionSchema>

export const restockSchema = z.object({
  qty: z.number().int().positive('Restock quantity must be greater than 0'),
  ref: z.string().trim().optional(),
})
export type RestockRequest = z.infer<typeof restockSchema>

export const sweepRequestSchema = z.object({
  date: isoDate.optional(),
  wardId: z.string().min(1).optional(),
  preview: z.boolean().default(false),
})
export type SweepRequest = z.infer<typeof sweepRequestSchema>

export const dispenseRequestSchema = z.object({
  patientId: z.string().min(1),
  wardId: z.string().min(1),
  date: isoDate.optional(),
})
export type DispenseRequest = z.infer<typeof dispenseRequestSchema>

export const confirmBillingSchema = z.object({
  patientId: z.string().min(1),
  date: isoDate.optional(),
})
export type ConfirmBillingRequest = z.infer<typeof confirmBillingSchema>

export const activityQuerySchema = z.object({
  type: z.enum(['dispense', 'prescription', 'stop', 'restock', 'register']).optional(),
  date: isoDate.optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
})
export type ActivityQuery = z.infer<typeof activityQuerySchema>

export type MatchType =
  | 'exact'
  | 'brand'
  | 'prefix'
  | 'substring'
  | 'token'
  | 'phonetic'
  | 'fuzzy'

export interface DrugSearchResult {
  id: string
  label: string
  name: string
  strength: string
  form: string
  matchType: MatchType
  /** Lower is a better match; used only for ordering. */
  score: number
}

export const drugSearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'A search query is required'),
  limit: z.coerce.number().int().positive().default(8).transform(v => Math.min(v, 25)),
})
export type DrugSearchQuery = z.infer<typeof drugSearchQuerySchema>
