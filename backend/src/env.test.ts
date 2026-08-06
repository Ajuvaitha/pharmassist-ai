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
})
