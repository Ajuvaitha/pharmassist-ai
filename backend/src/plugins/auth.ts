import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify'
import type { Role, SessionUser } from '@pharmassist/shared'
import { loadEnv } from '../env'
import { AppError } from '../errors'
import { getSessionUser } from '../modules/auth/service'

export const SESSION_COOKIE = 'pharmassist_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12

/**
 * Narrows request.user from SessionUser | null to SessionUser, so route
 * handlers registered behind the `authenticate` preHandler don't each
 * have to null-check (or reach for a `!`) before using it. Throws the
 * same error `authenticate` itself throws when a session is missing —
 * this should only ever be reached if a route uses requireUser without
 * the preHandler, which is itself a bug worth surfacing as AUTH_EXPIRED
 * rather than a crash.
 */
export function requireUser(request: FastifyRequest): SessionUser {
  if (!request.user) {
    throw AppError.authExpired()
  }
  return request.user
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: preHandlerHookHandler
    requireRole: (...roles: Role[]) => preHandlerHookHandler
    guard: (...roles: Role[]) => preHandlerHookHandler[]
    issueSession: (reply: FastifyReply, user: SessionUser) => Promise<void>
    clearSession: (reply: FastifyReply) => void
  }

  interface FastifyRequest {
    user: SessionUser | null
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string }
    // @fastify/jwt's own type declarations unconditionally add
    // `user: fastifyJwt.UserType` to FastifyRequest, where UserType
    // resolves from this field. It must equal SessionUser | null (the type
    // our own `declare module 'fastify'` block above gives
    // FastifyRequest.user) or the two declarations of the same interface
    // member conflict. The JWT subject claim is read from jwtVerify()'s
    // return value instead, so this doesn't need to be the raw payload shape.
    user: SessionUser | null
  }
}

const authPlugin: FastifyPluginAsync = async (app) => {
  const env = loadEnv()

  await app.register(cookie)
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    // The token lives in a cookie, never in a header or the response
    // body, so a script injected into the page cannot read it.
    cookie: { cookieName: SESSION_COOKIE, signed: false },
    sign: { expiresIn: `${SESSION_MAX_AGE_SECONDS}s` },
  })

  app.decorate('issueSession', async (reply: FastifyReply, user: SessionUser) => {
    const token = await reply.jwtSign({ sub: user.id })

    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    })
  })

  app.decorate('clearSession', (reply: FastifyReply) => {
    reply.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      path: '/',
    })
  })

  app.decorate('authenticate', async (request: FastifyRequest) => {
    let decoded: { sub: string }
    try {
      decoded = await request.jwtVerify<{ sub: string }>()
    } catch (err) {
      request.log.debug({ err }, 'JWT verification failed')
      throw AppError.authExpired()
    }

    // @fastify/jwt assigns the raw { sub } payload to request.user inside
    // jwtVerify() above. Overwrite it explicitly before the lookup below
    // so a future try/catch around that call can never leave request.user
    // holding the raw claim bag while its declared type says SessionUser.
    request.user = null

    // Re-read the user each request so a role or ward change takes effect
    // without waiting for the token to expire.
    request.user = await getSessionUser(request.server.prisma, decoded.sub)
  })

  app.decorate('requireRole', (...roles: Role[]): preHandlerHookHandler => {
    return async (request: FastifyRequest) => {
      const user = request.user
      if (!user) {
        throw AppError.authExpired()
      }

      if (!roles.includes(user.role)) {
        throw AppError.forbidden(
          `This action requires one of: ${roles.join(', ')}`,
        )
      }
    }
  })

  /**
   * The only sanctioned way to protect a route. Composing the pair by hand
   * makes it possible to attach requireRole without authenticate, which
   * denies with a 500 rather than a 403.
   */
  app.decorate('guard', (...roles: Role[]): preHandlerHookHandler[] => {
    return roles.length === 0
      ? [app.authenticate]
      : [app.authenticate, app.requireRole(...roles)]
  })
}

export default fp(authPlugin, { name: 'auth', dependencies: ['prisma'] })
