import { PrismaClient } from '@prisma/client'
import { loadEnv } from '../env'

let client: PrismaClient | undefined

/**
 * A Prisma client pinned to TEST_DATABASE_URL. Tests share one client and
 * one database, so vitest.config.ts disables file parallelism.
 */
export function getTestPrisma(): PrismaClient {
  if (!client) {
    const env = loadEnv()
    if (!env.TEST_DATABASE_URL) {
      throw new Error('TEST_DATABASE_URL is required to run tests')
    }
    client = new PrismaClient({ datasources: { db: { url: env.TEST_DATABASE_URL } } })
  }
  return client
}

/**
 * Truncates every domain table. RESTART IDENTITY keeps sequences clean;
 * CASCADE handles the foreign keys so the order of this list does not
 * matter.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ChatbotPendingAction", "ActivityEvent", "BillingLine", "IndentLine", "DailyIndent",
      "StockMovement", "Prescription", "InventoryItem", "Drug",
      "Patient", "User", "Ward"
    RESTART IDENTITY CASCADE
  `)
}
