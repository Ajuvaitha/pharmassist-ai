import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SweepResult, WardPickupList } from '@pharmassist/shared'
import { apiGet, apiPost } from './client'
import { buildQuery } from './query'
import { activityKeyPrefix } from './activity'
import { billingKeyPrefix } from './billing'
import { inventoryKeyPrefix } from './inventory'
import { wardsQueryKey } from './wards'

export const pickupListKeyPrefix = ['pickup-list'] as const
export const pickupListQueryKey = (wardId: string, date?: string) =>
  [...pickupListKeyPrefix, wardId, date ?? 'today'] as const

export function usePickupList(wardId: string | null, date?: string) {
  return useQuery<WardPickupList>({
    queryKey: pickupListQueryKey(wardId ?? '', date),
    queryFn: () => apiGet<WardPickupList>(`/api/wards/${wardId}/pickup-list${buildQuery({ date })}`),
    enabled: wardId !== null,
  })
}

/** Dispensing changes stock, billing and the ward's sweep status too. */
function useInvalidateAfterDispense() {
  const client = useQueryClient()
  return () => {
    client.invalidateQueries({ queryKey: pickupListKeyPrefix })
    client.invalidateQueries({ queryKey: billingKeyPrefix })
    client.invalidateQueries({ queryKey: inventoryKeyPrefix })
    client.invalidateQueries({ queryKey: activityKeyPrefix })
    client.invalidateQueries({ queryKey: wardsQueryKey })
  }
}

export function useDispense() {
  const invalidate = useInvalidateAfterDispense()

  return useMutation({
    mutationFn: (input: { patientId: string; wardId: string; date?: string }) =>
      apiPost<{ patientId: string; lines: number; total: number }>('/api/indents/dispense', input),
    onSuccess: invalidate,
  })
}

export function useSweep() {
  const invalidate = useInvalidateAfterDispense()

  return useMutation({
    mutationFn: (input: { date?: string; wardId?: string; preview?: boolean } = {}) =>
      apiPost<SweepResult>('/api/indents/sweep', input),
    onSuccess: invalidate,
  })
}
