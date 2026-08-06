import { ErrorCode, type ApiErrorBody } from '@pharmassist/shared'

/** A failed API call, carrying the server's error code so callers can branch. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    'message' in value
  )
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, {
    // The session lives in an httpOnly cookie, so every request must
    // carry credentials or the server sees an anonymous caller.
    credentials: 'include',
    ...init,
  })

  if (response.status === 204) {
    return null as T
  }

  const raw = await response.text()
  let parsed: unknown = null

  if (raw) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
  }

  if (!response.ok) {
    if (isErrorBody(parsed)) {
      throw new ApiError(parsed.error, parsed.message, response.status)
    }
    // A proxy error or an HTML error page — not our envelope.
    throw new ApiError(
      ErrorCode.DATABASE_ERROR,
      `Request failed with status ${response.status}`,
      response.status,
    )
  }

  return parsed as T
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' })
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    // Only declare a JSON content-type when there is actually a JSON body —
    // Fastify's body parser rejects an empty body sent with this header
    // (e.g. the bodyless POST /api/auth/logout call).
    ...(body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })
}
