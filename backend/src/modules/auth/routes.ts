import { loginRequestSchema, type LoginResponse } from '@pharmassist/shared'
import type { FastifyPluginAsync } from 'fastify'
import { requireUser } from '../../plugins/auth'
import { authenticate } from './service'

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/api/auth/login',
    {
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
    },
    async (request, reply): Promise<LoginResponse> => {
      // Parsed, not merged: any extra field in the body — a role, a ward —
      // is discarded rather than trusted.
      const credentials = loginRequestSchema.parse(request.body)

      const user = await authenticate(app.prisma, credentials.username, credentials.password)
      await app.issueSession(reply, user)

      return { user }
    },
  )

  app.get(
    '/api/auth/me',
    { preHandler: [app.authenticate] },
    async (request): Promise<LoginResponse> => {
      return { user: requireUser(request) }
    },
  )

  app.post('/api/auth/logout', async (_request, reply) => {
    app.clearSession(reply)
    return { success: true }
  })
}

export default authRoutes
