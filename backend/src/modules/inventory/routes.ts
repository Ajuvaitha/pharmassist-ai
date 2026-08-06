import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { restockSchema, type InventoryItem } from '@pharmassist/shared'
import { requireUser } from '../../plugins/auth'
import { listCategories, listInventory, restock } from './service'

const querySchema = z.object({
  category: z.string().trim().optional(),
  search: z.string().trim().optional(),
})

const inventoryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/inventory', { preHandler: app.guard() }, async (request): Promise<InventoryItem[]> => {
    return listInventory(app.prisma, querySchema.parse(request.query))
  })

  app.get('/api/inventory/categories', { preHandler: app.guard() }, async (): Promise<string[]> => {
    return listCategories(app.prisma)
  })

  app.post<{ Params: { drugId: string } }>(
    '/api/inventory/:drugId/restock',
    { preHandler: app.guard('pharmacist') },
    async (request): Promise<InventoryItem> => {
      const input = restockSchema.parse(request.body)
      return restock(app.prisma, requireUser(request), request.params.drugId, input)
    },
  )
}

export default inventoryRoutes
