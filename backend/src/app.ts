import Fastify, { type FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { loadEnv } from './env'
import authPlugin from './plugins/auth'
import errorsPlugin from './plugins/errors'
import prismaPlugin from './plugins/prisma'
import authRoutes from './modules/auth/routes'
import healthRoutes from './modules/health/routes'
import wardRoutes from './modules/wards/routes'
import patientRoutes from './modules/patients/routes'
import drugRoutes from './modules/drugs/routes'
import prescriptionRoutes from './modules/prescriptions/routes'

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

  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(wardRoutes)
  await app.register(patientRoutes)
  await app.register(drugRoutes)
  await app.register(prescriptionRoutes)

  return app
}
