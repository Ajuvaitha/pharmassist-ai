import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { buildApp } from '../app'
import { getTestPrisma } from './db'

/**
 * An app instance pinned to the test database, with logging off.
 *
 * Extra routes must be passed in rather than added afterwards: Fastify
 * runs plugins at ready(), so decorations like `app.authenticate` do not
 * exist before then, and routes cannot be added after.
 */
export async function buildTestApp(
  extraRoutes?: FastifyPluginAsync,
): Promise<FastifyInstance> {
  const app = await buildApp({ prisma: getTestPrisma() })
  if (extraRoutes) await app.register(extraRoutes)
  await app.ready()
  return app
}
