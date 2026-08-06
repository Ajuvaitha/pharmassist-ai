import type { Prisma, PrismaClient } from '@prisma/client'
import { wardLabel, type SessionUser } from '@pharmassist/shared'
import { AppError } from '../../errors'
import { verifyPassword } from './password'

const withWard = { ward: true } satisfies Prisma.UserInclude

type UserWithWard = Prisma.UserGetPayload<{ include: typeof withWard }>

/** Strips the password hash and composes the ward display label. */
export function toSessionUser(user: UserWithWard): SessionUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    ward: user.ward
      ? {
          id: user.ward.id,
          code: user.ward.code,
          name: user.ward.name,
          label: wardLabel(user.ward),
        }
      : null,
  }
}

/**
 * An unknown username and a wrong password produce the identical error,
 * so the response cannot be used to enumerate valid accounts.
 */
export async function authenticate(
  prisma: PrismaClient,
  username: string,
  password: string,
): Promise<SessionUser> {
  const invalid = () => AppError.authExpired('Invalid username or password')

  const user = await prisma.user.findUnique({
    where: { username },
    include: withWard,
  })

  if (!user) {
    // Hash anyway so a missing account is not measurably faster than a
    // wrong password.
    await verifyPassword('$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHQ$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', password)
    throw invalid()
  }

  if (!(await verifyPassword(user.passwordHash, password))) {
    throw invalid()
  }

  return toSessionUser(user)
}

export async function getSessionUser(
  prisma: PrismaClient,
  userId: string,
): Promise<SessionUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: withWard,
  })

  if (!user) {
    throw AppError.authExpired('Session refers to an account that no longer exists')
  }

  return toSessionUser(user)
}
