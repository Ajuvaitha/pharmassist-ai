import { useQuery } from '@tanstack/react-query'
import type { Drug, DrugSearchResult } from '@pharmassist/shared'
import { apiGet } from './client'
import { buildQuery } from './query'

const drugsQueryKey = (search?: string) => ['drugs', search ?? ''] as const
const drugSearchQueryKey = (q: string) => ['drugs', 'search', q] as const

export function useDrugs(search?: string) {
  return useQuery<Drug[]>({
    queryKey: drugsQueryKey(search),
    queryFn: () => apiGet<Drug[]>(`/api/drugs${buildQuery({ search })}`),
    // The catalog changes rarely; avoid refetching it on every mount.
    staleTime: 5 * 60_000,
  })
}

export function useDrugSearch(q: string) {
  const query = q.trim()
  return useQuery<DrugSearchResult[]>({
    queryKey: drugSearchQueryKey(query),
    queryFn: () => apiGet<DrugSearchResult[]>(`/api/drugs/search${buildQuery({ q: query, limit: 8 })}`),
    enabled: query.length >= 2,
    staleTime: 60_000,
  })
}
