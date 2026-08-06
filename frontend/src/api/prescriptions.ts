import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  CreatePrescriptionRequest,
  Prescription,
  UpdatePrescriptionRequest,
} from '@pharmassist/shared'
import { apiPatch, apiPost } from './client'
import { activityKeyPrefix } from './activity'
import { patientsKeyPrefix } from './patients'
import { pickupListKeyPrefix } from './indents'

/**
 * Every prescription change invalidates patient data, which embeds them,
 * and the activity feed, which every prescription write reports to.
 * Stopping a prescription also cancels today's pending indent lines, so
 * the ward's pickup list must be invalidated too — otherwise it keeps
 * offering a drug that was just stopped until its staleTime lapses.
 */
function useInvalidateAfterPrescriptionChange() {
  const client = useQueryClient()
  return () => {
    client.invalidateQueries({ queryKey: patientsKeyPrefix })
    client.invalidateQueries({ queryKey: activityKeyPrefix })
    client.invalidateQueries({ queryKey: pickupListKeyPrefix })
  }
}

export function useCreatePrescription() {
  const invalidate = useInvalidateAfterPrescriptionChange()

  return useMutation({
    mutationFn: ({ patientId, input }: { patientId: string; input: CreatePrescriptionRequest }) =>
      apiPost<Prescription>(`/api/patients/${patientId}/prescriptions`, input),
    onSuccess: invalidate,
  })
}

export function useUpdatePrescription() {
  const invalidate = useInvalidateAfterPrescriptionChange()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePrescriptionRequest }) =>
      apiPatch<Prescription>(`/api/prescriptions/${id}`, input),
    onSuccess: invalidate,
  })
}

export function useStopPrescription() {
  const invalidate = useInvalidateAfterPrescriptionChange()

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiPost<Prescription>(`/api/prescriptions/${id}/stop`, { reason }),
    onSuccess: invalidate,
  })
}
