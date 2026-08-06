import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import fp from 'fastify-plugin'
import { ErrorCode } from '@pharmassist/shared'
import type { FastifyPluginAsync } from 'fastify'
import { loadEnv } from '../env'

const securityPlugin: FastifyPluginAsync = async (app) => {
  const env = loadEnv()

  const origins = env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? []

  if (origins.length > 0) {
    await app.register(cors, {
      // An exact allow-list. Never `true` and never `*`: the session is a
      // credentialed cookie, and echoing the request origin would let any
      // site make authenticated requests on a signed-in user's behalf.
      origin: origins,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    })
  }

  await app.register(rateLimit, {
    global: false,
    // Returns the envelope the rest of the API uses, rather than
    // Fastify's default error shape. @fastify/rate-limit throws whatever
    // this returns, so the statusCode travels alongside the envelope for
    // errorsPlugin to forward as-is (see isEnvelopeError in plugins/errors.ts).
    errorResponseBuilder: (_request, context) => ({
      success: false,
      error: ErrorCode.FORBIDDEN,
      message: 'Too many attempts. Wait a moment and try again.',
      statusCode: context.statusCode,
    }),
  })
}

export default fp(securityPlugin, { name: 'security' })
