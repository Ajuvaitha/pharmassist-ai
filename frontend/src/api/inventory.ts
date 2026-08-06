import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InventoryItem, RestockRequest } from '@pharmassist/shared'
import { apiGet, apiPost } from './client'
import { buildQuery } from './query'
import { activityKeyPrefix } from './activity'

export interface InventoryQuery {
  category?: string
  search?: string
}

export const inventoryKeyPrefix = ['inventory'] as const
const inventoryQueryKey = (query: InventoryQuery = {}) => [...inventoryKeyPrefix, query] as const
const categoriesQueryKey = [...inventoryKeyPrefix, 'categories'] as const

export function useInventory(query: InventoryQuery = {}) {
  return useQuery<InventoryItem[]>({
    queryKey: inventoryQueryKey(query),
    queryFn: () => apiGet<InventoryItem[]>(`/api/inventory${buildQuery({ ...query })}`),
  })
}

export function useCategories() {
  return useQuery<string[]>({
    queryKey: categoriesQueryKey,
    queryFn: () => apiGet<string[]>('/api/inventory/categories'),
  })
}

export function useRestock() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({ drugId, input }: { drugId: string; input: RestockRequest }) =>
      apiPost<InventoryItem>(`/api/inventory/${drugId}/restock`, input),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: inventoryKeyPrefix })
      client.invalidateQueries({ queryKey: activityKeyPrefix })
    },
  })
}
