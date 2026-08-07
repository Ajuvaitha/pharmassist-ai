import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import fp from 'fastify-plugin'
import { ErrorCode } from '@pharmassist/shared'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { AppError } from '../errors'
import { loadEnv } from '../env'

/**
 * Keys the login throttle on the submitted username plus the caller's IP,
 * not IP alone. Behind a reverse proxy or hospital NAT, every clinician on
 * the ward shares one address — an IP-only bucket would let one person's
 * failed attempts lock out the whole ward. The body may be missing or
 * malformed this early in the request lifecycle, so parsing is defensive:
 * fall back to the IP alone rather than throwing inside the key generator.
 */
function loginRateLimitKey(request: FastifyRequest): string {
  const body = request.body
  if (
    typeof body === 'object' &&
    body !== null &&
    'username' in body &&
    typeof (body as { username: unknown }).username === 'string'
  ) {
    return `${(body as { username: string }).username}:${request.ip}`
  }
  return request.ip
}

const securityPlugin: FastifyPluginAsync = async (app) => {
  const env = loadEnv()

  if (env.CORS_ORIGINS.length > 0) {
    await app.register(cors, {
      // An exact allow-list. Never `true` and never `*`: the session is a
      // credentialed cookie, and echoing the request origin would let any
      // site make authenticated requests on a signed-in user's behalf.
      origin: env.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    })
  }

  await app.register(rateLimit, {
    global: false,
    // The default 'onRequest' hook runs before Fastify parses the body, so
    // keyGenerator would only ever see `undefined` and silently fall back
    // to IP-only keying. 'preHandler' runs after body parsing, so the
    // username is actually available to key on.
    hook: 'preHandler',
    keyGenerator: loginRateLimitKey,
    // Returns an AppError, which the errors plugin's existing
    // `error instanceof AppError` branch already forwards with the right
    // status code and message — no bespoke envelope-shaped duck type needed.
    errorResponseBuilder: (_request, context) =>
      new AppError(
        ErrorCode.TOO_MANY_REQUESTS,
        'Too many attempts. Wait a moment and try again.',
        context.statusCode,
      ),
  })
}

export default fp(securityPlugin, { name: 'security' })
