import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InventoryItem, RestockRequest } from '@pharmassist/shared'
import { apiGet, apiPost } from './client'
import { buildQuery } from './query'

export interface InventoryQuery {
  category?: string
  search?: string
}

export const inventoryQueryKey = (query: InventoryQuery = {}) => ['inventory', query] as const
export const categoriesQueryKey = ['inventory', 'categories'] as const

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
      client.invalidateQueries({ queryKey: ['inventory'] })
      client.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}
