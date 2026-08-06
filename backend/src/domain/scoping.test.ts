import { describe, expect, it } from 'vitest'
import type { SessionUser } from '@pharmassist/shared'
import { AppError } from '../errors'
import { assertWardAccess, wardScopeFor } from './scoping'

function user(role: SessionUser['role'], wardId: string | null): SessionUser {
  return {
    id: 'u1',
    username: 'test',
    displayName: 'Test',
    role,
    ward: wardId
      ? { id: wardId, code: 'Ward 4A', name: 'General Medicine', label: 'Ward 4A — General Medicine' }
      : null,
  }
}

describe('assertWardAccess', () => {
  it('permits a nurse their own ward', () => {
    expect(() => assertWardAccess(user('nurse', 'w1'), 'w1')).not.toThrow()
  })

  it('denies a nurse another ward', () => {
    expect(() => assertWardAccess(user('nurse', 'w1'), 'w2')).toThrow(AppError)
  })

  it('denies a nurse with no assigned ward, rather than permitting everything', () => {
    expect(() => assertWardAccess(user('nurse', null), 'w1')).toThrow(AppError)
  })

  it('denies with 403, not 404 — a 404 would leak whether the ward exists', () => {
    const error = (() => {
      try {
        assertWardAccess(user('nurse', 'w1'), 'w2')
        return null
      } catch (e) {
        return e
      }
    })()

    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).statusCode).toBe(403)
  })

  it('is a no-op for a pharmacist and a doctor', () => {
    expect(() => assertWardAccess(user('pharmacist', null), 'w9')).not.toThrow()
    expect(() => assertWardAccess(user('doctor', null), 'w9')).not.toThrow()
  })
})

describe('wardScopeFor', () => {
  it('scopes a nurse to their own ward', () => {
    expect(wardScopeFor(user('nurse', 'w1'))).toEqual({ wardId: 'w1' })
  })

  it('throws for a nurse with no assigned ward', () => {
    expect(() => wardScopeFor(user('nurse', null))).toThrow(AppError)
  })

  it('throws when a nurse requests another ward', () => {
    expect(() => wardScopeFor(user('nurse', 'w1'), 'w2')).toThrow(AppError)
  })

  it('honours a requested ward for a pharmacist', () => {
    expect(wardScopeFor(user('pharmacist', null), 'w3')).toEqual({ wardId: 'w3' })
  })

  it('returns an unscoped filter for a pharmacist with no request', () => {
    expect(wardScopeFor(user('pharmacist', null))).toEqual({})
  })
})
