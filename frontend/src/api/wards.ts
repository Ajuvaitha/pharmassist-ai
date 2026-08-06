import { useQuery } from '@tanstack/react-query'
import type { Ward } from '@pharmassist/shared'
import { apiGet } from './client'

export const wardsQueryKey = ['wards'] as const

export function useWards() {
  return useQuery<Ward[]>({
    queryKey: wardsQueryKey,
    queryFn: () => apiGet<Ward[]>('/api/wards'),
  })
}
