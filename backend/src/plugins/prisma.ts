import { PrismaClient } from '@prisma/client'
import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
}

interface PrismaPluginOptions {
  /** Injected by tests so they can share one client against the test DB. */
  prisma?: PrismaClient
}

const prismaPlugin: FastifyPluginAsync<PrismaPluginOptions> = async (app, options) => {
  const client = options.prisma ?? new PrismaClient()
  await client.$connect()

  app.decorate('prisma', client)

  // Only the client this plugin created is ours to close. A test-supplied
  // client outlives the app instance.
  if (!options.prisma) {
    app.addHook('onClose', async () => {
      await client.$disconnect()
    })
  }
}

export default fp(prismaPlugin, { name: 'prisma' })
