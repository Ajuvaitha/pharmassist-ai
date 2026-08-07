import { describe, expect, it } from 'vitest'
import { loadEnv } from './env'

const valid = {
  DATABASE_URL: 'postgresql://u:p@localhost:5433/db',
  TEST_DATABASE_URL: 'postgresql://u:p@localhost:5433/db_test',
  JWT_SECRET: 'x'.repeat(32),
  PORT: '3000',
  NODE_ENV: 'development',
}

describe('loadEnv', () => {
  it('parses a valid environment and coerces PORT to a number', () => {
    const env = loadEnv(valid)
    expect(env.PORT).toBe(3000)
    expect(env.NODE_ENV).toBe('development')
  })

  it('defaults PORT when it is absent', () => {
    const { PORT: _omitted, ...rest } = valid
    expect(loadEnv(rest).PORT).toBe(3000)
  })

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    expect(() => loadEnv({ ...valid, JWT_SECRET: 'too-short' }))
      .toThrow(/JWT_SECRET/)
  })

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL: _omitted, ...rest } = valid
    expect(() => loadEnv(rest)).toThrow(/DATABASE_URL/)
  })

  it('requires TEST_DATABASE_URL when NODE_ENV is test', () => {
    const { TEST_DATABASE_URL: _omitted, ...rest } = valid
    expect(() => loadEnv({ ...rest, NODE_ENV: 'test' })).toThrow(/TEST_DATABASE_URL/)
  })

  it('does not require TEST_DATABASE_URL when NODE_ENV is production', () => {
    const { TEST_DATABASE_URL: _omitted, ...rest } = valid
    const env = loadEnv({ ...rest, NODE_ENV: 'production' })
    expect(env.TEST_DATABASE_URL).toBeUndefined()
  })

  it('leaves CORS_ORIGIN unset by default', () => {
    const env = loadEnv(valid)
    expect(env.CORS_ORIGIN).toBeUndefined()
  })

  it('accepts a configured CORS_ORIGIN', () => {
    const env = loadEnv({ ...valid, CORS_ORIGIN: 'https://pharmassist.example.org' })
    expect(env.CORS_ORIGIN).toBe('https://pharmassist.example.org')
  })

  it('rejects a CORS_ORIGIN of "*"', () => {
    expect(() => loadEnv({ ...valid, CORS_ORIGIN: '*' })).toThrow(/CORS_ORIGIN/)
  })

  it('rejects a CORS_ORIGIN of "*," — a wildcard segment plus a trailing comma', () => {
    expect(() => loadEnv({ ...valid, CORS_ORIGIN: '*,' })).toThrow(/CORS_ORIGIN/)
  })

  it('rejects a CORS_ORIGIN of " * " — a wildcard segment padded with whitespace', () => {
    expect(() => loadEnv({ ...valid, CORS_ORIGIN: ' * ' })).toThrow(/CORS_ORIGIN/)
  })

  it('rejects a CORS_ORIGIN with a real origin followed by a wildcard segment', () => {
    expect(() => loadEnv({ ...valid, CORS_ORIGIN: 'https://good.example,*' }))
      .toThrow(/CORS_ORIGIN/)
  })

  it('accepts a comma-separated CORS_ORIGIN and parses exactly two origins', () => {
    const env = loadEnv({
      ...valid,
      CORS_ORIGIN: 'https://a.example, https://b.example',
    })
    expect(env.CORS_ORIGINS).toEqual(['https://a.example', 'https://b.example'])
  })
})
