import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PrismaClient, type Prisma } from '@prisma/client'
import { parseMedicineLine } from './parse-medicine'

export async function seedMedicines(
  prisma: PrismaClient,
  csvPath: string,
  opts: { batchSize?: number } = {},
): Promise<{ inserted: number }> {
  const batchSize = opts.batchSize ?? 5000
  const rl = createInterface({ input: createReadStream(csvPath, { encoding: 'utf-8' }), crlfDelay: Infinity })

  let batch: Prisma.DrugCreateManyInput[] = []
  let inserted = 0
  const flush = async () => {
    if (batch.length === 0) return
    const res = await prisma.drug.createMany({ data: batch, skipDuplicates: true })
    inserted += res.count
    batch = []
  }

  for await (const line of rl) {
    const row = parseMedicineLine(line)
    if (!row) continue
    batch.push(row)
    if (batch.length >= batchSize) await flush()
  }
  await flush()
  return { inserted }
}

// Entrypoint: `pnpm --filter @pharmassist/backend seed:medicines`
// Compared via pathToFileURL rather than a raw `file://${process.argv[1]}` template because
// Windows paths use backslashes, which don't survive that naive interpolation.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed a production database')
  const prisma = new PrismaClient()
  const csvPath = process.env.MEDICINES_CSV ?? fileURLToPath(new URL('../../Medicine_Names.csv', import.meta.url))
  const { inserted } = await seedMedicines(prisma, csvPath)
  await prisma.$disconnect()
  console.log(`Medicine seed complete: ${inserted} rows inserted`)
}
