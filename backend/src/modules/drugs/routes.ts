import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import type { Drug, DrugSearchResult } from '@pharmassist/shared'
import { drugSearchQuerySchema } from '@pharmassist/shared'
import { listDrugs } from './service'

const querySchema = z.object({ search: z.string().trim().optional() })

const drugRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/drugs', { preHandler: app.guard() }, async (request): Promise<Drug[]> => {
    return listDrugs(app.prisma, querySchema.parse(request.query).search)
  })

  app.get('/api/drugs/search', { preHandler: app.guard() }, async (request): Promise<DrugSearchResult[]> => {
    const { q, limit } = drugSearchQuerySchema.parse(request.query)
    return app.drugSearch.search(q, limit)
  })
}

export default drugRoutes
