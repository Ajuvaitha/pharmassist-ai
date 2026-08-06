import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  CreatePrescriptionRequest,
  Prescription,
  UpdatePrescriptionRequest,
} from '@pharmassist/shared'
import { apiPatch, apiPost } from './client'

/** Every prescription change invalidates patient data, which embeds them. */
function useInvalidatePatients() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: ['patients'] })
}

export function useCreatePrescription() {
  const invalidate = useInvalidatePatients()

  return useMutation({
    mutationFn: ({ patientId, input }: { patientId: string; input: CreatePrescriptionRequest }) =>
      apiPost<Prescription>(`/api/patients/${patientId}/prescriptions`, input),
    onSuccess: invalidate,
  })
}

export function useUpdatePrescription() {
  const invalidate = useInvalidatePatients()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePrescriptionRequest }) =>
      apiPatch<Prescription>(`/api/prescriptions/${id}`, input),
    onSuccess: invalidate,
  })
}

export function useStopPrescription() {
  const invalidate = useInvalidatePatients()

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiPost<Prescription>(`/api/prescriptions/${id}/stop`, { reason }),
    onSuccess: invalidate,
  })
}
