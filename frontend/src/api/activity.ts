import { useQuery } from '@tanstack/react-query'
import type { ActivityItem, ActivityType } from '@pharmassist/shared'
import { apiGet } from './client'
import { buildQuery } from './query'

export interface ActivityQueryInput {
  type?: ActivityType
  date?: string
  limit?: number
}

export const activityQueryKey = (query: ActivityQueryInput = {}) => ['activity', query] as const

export function useActivity(query: ActivityQueryInput = {}) {
  return useQuery<ActivityItem[]>({
    queryKey: activityQueryKey(query),
    queryFn: () => apiGet<ActivityItem[]>(`/api/activity${buildQuery({ ...query })}`),
  })
}
