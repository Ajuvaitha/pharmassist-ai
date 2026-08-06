import { z } from 'zod'
import type { Role } from './domain'

export interface SessionWard {
  id: string
  code: string
  name: string
  label: string
}

/** The authenticated identity. Role and ward come from the database record. */
export interface SessionUser {
  id: string
  username: string
  displayName: string
  role: Role
  ward: SessionWard | null
}

export const loginRequestSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginRequest = z.infer<typeof loginRequestSchema>

export interface LoginResponse {
  user: SessionUser
}
