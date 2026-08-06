import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreatePatientRequest, Patient } from '@pharmassist/shared'
import { apiGet, apiPost } from './client'
import { buildQuery } from './query'
import { activityKeyPrefix } from './activity'
import { wardsQueryKey } from './wards'

export interface PatientsQuery {
  wardId?: string
  search?: string
}

export const patientsKeyPrefix = ['patients'] as const
const patientsQueryKey = (query: PatientsQuery = {}) => [...patientsKeyPrefix, query] as const
const patientQueryKey = (id: string) => [...patientsKeyPrefix, 'detail', id] as const

export function usePatients(query: PatientsQuery = {}) {
  return useQuery<Patient[]>({
    queryKey: patientsQueryKey(query),
    queryFn: () => apiGet<Patient[]>(`/api/patients${buildQuery({ ...query })}`),
  })
}

export function usePatient(id: string | null) {
  return useQuery<Patient>({
    queryKey: patientQueryKey(id ?? ''),
    queryFn: () => apiGet<Patient>(`/api/patients/${id}`),
    enabled: id !== null,
  })
}

export function useCreatePatient() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (input: CreatePatientRequest) => apiPost<Patient>('/api/patients', input),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: patientsKeyPrefix })
      // A new admission changes the ward's patient count.
      client.invalidateQueries({ queryKey: wardsQueryKey })
      // Registering a patient writes an ActivityEvent server-side.
      client.invalidateQueries({ queryKey: activityKeyPrefix })
    },
  })
}
