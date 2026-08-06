import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiGet, apiPost } from './client'

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiGet', () => {
  it('returns the parsed body on success', async () => {
    mockFetch(200, { user: { username: 'k.asante' } })

    await expect(apiGet('/api/auth/me')).resolves.toEqual({
      user: { username: 'k.asante' },
    })
  })

  it('sends credentials so the session cookie travels with the request', async () => {
    const fetchMock = mockFetch(200, {})

    await apiGet('/api/auth/me')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('throws an ApiError carrying the envelope code and status', async () => {
    mockFetch(401, {
      success: false,
      error: 'AUTH_EXPIRED',
      message: 'Session expired or missing',
    })

    const error = await apiGet('/api/auth/me').catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    if (!(error instanceof ApiError)) throw error
    expect(error.code).toBe('AUTH_EXPIRED')
    expect(error.status).toBe(401)
    expect(error.message).toBe('Session expired or missing')
  })

  it('falls back to a generic message when the body is not an envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>502</html>', { status: 502 })),
    )

    const error = await apiGet('/api/auth/me').catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    if (!(error instanceof ApiError)) throw error
    expect(error.status).toBe(502)
    expect(error.code).toBe('DATABASE_ERROR')
  })
})

describe('apiPost', () => {
  it('serialises the body as JSON', async () => {
    const fetchMock = mockFetch(200, { user: {} })

    await apiPost('/api/auth/login', { username: 'k.asante', password: 'x' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'k.asante', password: 'x' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })

  it('handles a 204 with no body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

    await expect(apiPost('/api/auth/logout')).resolves.toBeNull()
  })
})
