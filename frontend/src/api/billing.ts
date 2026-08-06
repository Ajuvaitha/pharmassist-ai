import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PatientBillingGroup } from '@pharmassist/shared'
import { apiGet, apiPost } from './client'
import { buildQuery } from './query'
import { activityKeyPrefix } from './activity'

export interface BillingQueryInput {
  wardId?: string
  date?: string
}

export const billingKeyPrefix = ['billing'] as const
export const billingQueryKey = (query: BillingQueryInput = {}) => [...billingKeyPrefix, query] as const

export function useBilling(query: BillingQueryInput = {}) {
  return useQuery<PatientBillingGroup[]>({
    queryKey: billingQueryKey(query),
    queryFn: () => apiGet<PatientBillingGroup[]>(`/api/billing${buildQuery({ ...query })}`),
  })
}

export function useConfirmBilling() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (input: { patientId: string; date?: string }) =>
      apiPost<PatientBillingGroup>('/api/billing/confirm', input),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: billingKeyPrefix })
      client.invalidateQueries({ queryKey: activityKeyPrefix })
    },
  })
}
