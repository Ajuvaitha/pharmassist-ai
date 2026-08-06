import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import type { Drug } from '@pharmassist/shared'
import { listDrugs } from './service'

const querySchema = z.object({ search: z.string().trim().optional() })

const drugRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/drugs', { preHandler: app.guard() }, async (request): Promise<Drug[]> => {
    return listDrugs(app.prisma, querySchema.parse(request.query).search)
  })
}

export default drugRoutes
