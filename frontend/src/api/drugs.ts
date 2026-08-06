import { useQuery } from '@tanstack/react-query'
import type { Drug } from '@pharmassist/shared'
import { apiGet } from './client'
import { buildQuery } from './query'

const drugsQueryKey = (search?: string) => ['drugs', search ?? ''] as const

export function useDrugs(search?: string) {
  return useQuery<Drug[]>({
    queryKey: drugsQueryKey(search),
    queryFn: () => apiGet<Drug[]>(`/api/drugs${buildQuery({ search })}`),
    // The catalog changes rarely; avoid refetching it on every mount.
    staleTime: 5 * 60_000,
  })
}
