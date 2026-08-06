import type { FastifyPluginAsync } from 'fastify'
import { checkDatabase } from './service'

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/health', async () => checkDatabase(app.prisma))
}

export default healthRoutes
