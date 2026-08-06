import Fastify, { type FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { loadEnv } from './env'
import authPlugin from './plugins/auth'
import errorsPlugin from './plugins/errors'
import prismaPlugin from './plugins/prisma'
import authRoutes from './modules/auth/routes'

export interface BuildAppOptions {
  /** Supplied by tests to pin the app to the test database. */
  prisma?: PrismaClient
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const env = loadEnv()

  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: 'info' },
  })

  await app.register(errorsPlugin)
  await app.register(prismaPlugin, { prisma: options.prisma })
  await app.register(authPlugin)

  app.get('/api/health', async () => {
    await app.prisma.$queryRaw`SELECT 1`
    return { status: 'ok', database: 'up' }
  })

  await app.register(authRoutes)

  return app
}
