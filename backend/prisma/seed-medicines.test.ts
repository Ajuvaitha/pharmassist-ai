import { afterAll, describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PrismaClient } from '@prisma/client'
import { seedMedicines } from './seed-medicines'

const prisma = new PrismaClient()
const csv = join(tmpdir(), `meds-${Date.now()}.csv`)
writeFileSync(csv, 'str\nZzztestol 10 MG Tablet\nZzztestol 10 MG Tablet\nYyytestine 5 MG Injection\n')

afterAll(async () => {
  await prisma.drug.deleteMany({ where: { label: { startsWith: 'Zzztestol' } } })
  await prisma.drug.deleteMany({ where: { label: { startsWith: 'Yyytestine' } } })
  await prisma.$disconnect()
})

describe('seedMedicines', () => {
  it('inserts parsed rows and dedupes on label', async () => {
    const { inserted } = await seedMedicines(prisma, csv, { batchSize: 1 })
    expect(inserted).toBeGreaterThanOrEqual(2)
    const zz = await prisma.drug.findUnique({ where: { label: 'Zzztestol 10 MG Tablet' } })
    expect(zz).toMatchObject({ form: 'Tablet', category: 'Uncategorized' })
  })

  it('is idempotent — a second run inserts no duplicates', async () => {
    await seedMedicines(prisma, csv, { batchSize: 1 })
    const count = await prisma.drug.count({ where: { label: 'Zzztestol 10 MG Tablet' } })
    expect(count).toBe(1)
  })
})
