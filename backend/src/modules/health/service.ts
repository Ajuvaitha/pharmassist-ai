import type { PrismaClient } from '@prisma/client'

export interface HealthReport {
  status: 'ok'
  database: 'up'
}

/** Services are the only layer permitted to touch Prisma — including this one. */
export async function checkDatabase(prisma: PrismaClient): Promise<HealthReport> {
  await prisma.$queryRaw`SELECT 1`
  return { status: 'ok', database: 'up' }
}
