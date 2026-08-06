import type { FastifyPluginAsync } from 'fastify'
import { activityQuerySchema, type ActivityItem } from '@pharmassist/shared'
import { requireUser } from '../../plugins/auth'
import { listActivity } from './service'

const activityRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/activity', { preHandler: app.guard() }, async (request): Promise<ActivityItem[]> => {
    const query = activityQuerySchema.parse(request.query)
    return listActivity(app.prisma, requireUser(request), query)
  })
}

export default activityRoutes
