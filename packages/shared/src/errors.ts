export const ErrorCode = {
  INVALID_INPUT: 'INVALID_INPUT',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  RX_NOT_FOUND: 'RX_NOT_FOUND',
  RX_NOT_ACTIVE: 'RX_NOT_ACTIVE',
  NOT_FOUND: 'NOT_FOUND',
  BATCH_ALREADY_FULFILLED: 'BATCH_ALREADY_FULFILLED',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  ALREADY_BILLED: 'ALREADY_BILLED',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export interface ApiErrorBody {
  success: false
  error: ErrorCode
  message: string
}
