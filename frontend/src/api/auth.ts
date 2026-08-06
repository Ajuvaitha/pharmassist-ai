import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LoginRequest, LoginResponse, SessionUser } from '@pharmassist/shared'
import { ApiError, apiGet, apiPost } from './client'

const meQueryKey = ['auth', 'me'] as const

/**
 * Resolves to null rather than throwing when there is no session, so the
 * app can render the login screen instead of an error boundary.
 */
export function useMe() {
  return useQuery<SessionUser | null>({
    queryKey: meQueryKey,
    queryFn: async () => {
      try {
        const response = await apiGet<LoginResponse>('/api/auth/me')
        return response.user
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
  })
}

export function useLogin() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (credentials: LoginRequest) =>
      apiPost<LoginResponse>('/api/auth/login', credentials),
    onSuccess: (response) => {
      client.setQueryData(meQueryKey, response.user)
    },
  })
}

export function useLogout() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: () => apiPost<{ success: true }>('/api/auth/logout'),
    onSuccess: () => {
      // Drop every cached query — the next user must not see the previous
      // user's patients.
      client.clear()
    },
  })
}
