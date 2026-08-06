import type { FastifyPluginAsync } from 'fastify'
import type { Ward } from '@pharmassist/shared'
import { requireUser } from '../../plugins/auth'
import { listWards } from './service'

const wardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/wards', { preHandler: app.guard() }, async (request): Promise<Ward[]> => {
    return listWards(app.prisma, requireUser(request))
  })
}

export default wardRoutes
