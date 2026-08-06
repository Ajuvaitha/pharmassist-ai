import fp from 'fastify-plugin'
import { ZodError } from 'zod'
import { ErrorCode, type ApiErrorBody } from '@pharmassist/shared'
import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '../errors'

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
      .send(envelope(ErrorCode.DATABASE_ERROR, 'An internal error occurred'))
  })
}

export default fp(errorsPlugin, { name: 'errors' })
