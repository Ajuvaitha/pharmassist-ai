import { hash, verify } from '@node-rs/argon2'

export function hashPassword(plain: string): Promise<string> {
  return hash(plain)
}

/**
 * Returns false for a malformed or unrecognised hash rather than
 * throwing, so a corrupted row reads as a failed login instead of a 500
 * that tells an attacker the account exists.
 */
export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain)
  } catch {
    return false
  }
}
