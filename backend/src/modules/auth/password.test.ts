import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password hashing', () => {
  it('produces an argon2 hash that is not the plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple')

    expect(hash.startsWith('$argon2')).toBe(true)
    expect(hash).not.toContain('correct horse')
  })

  it('salts, so the same password hashes differently each time', async () => {
    const [first, second] = await Promise.all([
      hashPassword('same-password'),
      hashPassword('same-password'),
    ])

    expect(first).not.toBe(second)
  })

  it('verifies a correct password', async () => {
    const hash = await hashPassword('pharmassist')
    expect(await verifyPassword(hash, 'pharmassist')).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('pharmassist')
    expect(await verifyPassword(hash, 'Pharmassist')).toBe(false)
  })

  it('returns false rather than throwing on a malformed hash', async () => {
    expect(await verifyPassword('not-a-hash', 'pharmassist')).toBe(false)
  })
})
