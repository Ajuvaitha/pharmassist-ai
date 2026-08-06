import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreatePatientRequest, Patient } from '@pharmassist/shared'
import { apiGet, apiPost } from './client'
import { buildQuery } from './query'
import { wardsQueryKey } from './wards'

export interface PatientsQuery {
  wardId?: string
  search?: string
}

export const patientsQueryKey = (query: PatientsQuery = {}) => ['patients', query] as const
export const patientQueryKey = (id: string) => ['patients', 'detail', id] as const

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
      client.invalidateQueries({ queryKey: ['patients'] })
      // A new admission changes the ward's patient count.
      client.invalidateQueries({ queryKey: wardsQueryKey })
    },
  })
}
