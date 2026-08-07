import { PrismaClient } from '@prisma/client'
import { loadEnv } from '../src/env'

/**
 * Prints the planner's chosen strategy for each query the app runs hot.
 * Index decisions in this schema are made from this output, not from
 * reasoning about selectivity — two indexes were previously added on
 * reasoning and flagged as speculative.
 */
const QUERIES: { label: string; sql: string }[] = [
  {
    label: 'sweep: active prescriptions for a ward, started on or before today',
    sql: `
      SELECT p.id FROM "Prescription" p
      JOIN "Patient" pt ON pt.id = p."patientId"
      WHERE p.status = 'active'
        AND p."startDate" <= CURRENT_DATE
        AND pt."wardId" = (SELECT id FROM "Ward" LIMIT 1)
        AND pt.status = 'admitted'
    `,
  },
  {
    label: 'pickup list: lines for one indent',
    sql: `
      SELECT l.id FROM "IndentLine" l
      WHERE l."indentId" = (SELECT id FROM "DailyIndent" LIMIT 1)
        AND l.status <> 'cancelled'
    `,
  },
  {
    label: 'billing: lines for one ward',
    sql: `SELECT b.id FROM "BillingLine" b WHERE b."wardId" = (SELECT id FROM "Ward" LIMIT 1)`,
  },
  {
    label: 'activity feed: most recent, unfiltered',
    sql: `SELECT e.id FROM "ActivityEvent" e ORDER BY e."occurredAt" DESC LIMIT 50`,
  },
  {
    label: 'activity feed: filtered by type',
    sql: `SELECT e.id FROM "ActivityEvent" e WHERE e.type = 'dispense' ORDER BY e."occurredAt" DESC LIMIT 50`,
  },
  {
    label: 'wards list: admitted patient count per ward',
    sql: `SELECT "wardId", count(*) FROM "Patient" WHERE status = 'admitted' GROUP BY "wardId"`,
  },
  {
    label: 'users: by ward (is User.wardId worth an index?)',
    sql: `SELECT id FROM "User" WHERE "wardId" = (SELECT id FROM "Ward" LIMIT 1)`,
  },
]

async function main(): Promise<void> {
  const env = loadEnv()
  const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } })

  for (const query of QUERIES) {
    const rows = await prisma.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(
      `EXPLAIN (ANALYZE, BUFFERS) ${query.sql}`,
    )
    console.log(`\n=== ${query.label} ===`)
    for (const row of rows) console.log(row['QUERY PLAN'])
  }

  await prisma.$disconnect()
}

await main()
