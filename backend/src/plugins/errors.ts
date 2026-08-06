import fp from 'fastify-plugin'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { ErrorCode, type ApiErrorBody } from '@pharmassist/shared'
import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '../errors'

/**
 * P2034 is Postgres aborting one side of a deadlock; P2028 is a
 * transaction that ran past its timeout. Both are transient — the
 * transaction did not corrupt anything, it just lost a race — so the
 * client can retry rather than being told the same thing as a genuine
 * internal error.
 */
const RETRYABLE_TRANSACTION_CODES = new Set(['P2034', 'P2028'])

function envelope(error: ErrorCode, message: string): ApiErrorBody {
  return { success: false, error, message }
}

const errorsPlugin: FastifyPluginAsync = async (app) => {
  app.setNotFoundHandler((request, reply) => {
    reply
      .status(404)
      .send(envelope(
        ErrorCode.NOT_FOUND,
        `Route ${request.method} ${request.url} not found`,
      ))
  })

  app.setErrorHandler((error: Error & { statusCode?: number; validation?: unknown[] }, request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send(envelope(error.code, error.message))
      return
    }

    if (error instanceof ZodError) {
      const detail = error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')
      reply.status(400).send(envelope(ErrorCode.INVALID_INPUT, detail))
      return
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      RETRYABLE_TRANSACTION_CODES.has(error.code)
    ) {
      reply
        .status(409)
        .send(envelope(ErrorCode.DATABASE_ERROR, 'The request conflicted with another in-progress change; please retry'))
      return
    }

    // Fastify's own validation and auth errors carry a usable statusCode.
    if (error.statusCode === 400 && error.validation) {
      reply.status(400).send(envelope(ErrorCode.INVALID_INPUT, error.message))
      return
    }

    // Anything else is unexpected. Log the real error; tell the client
    // nothing that could expose internals.
    request.log.error({ err: error }, 'Unhandled error')
    reply
      .status(500)
      .send(envelope(ErrorCode.INTERNAL_ERROR, 'An internal error occurred'))
  })
}

export default fp(errorsPlugin, { name: 'errors' })
