import { beforeEach, describe, expect, it } from 'vitest'
import { getTestPrisma, resetDatabase } from '../src/test/db'
import { seed } from './seed'

const prisma = getTestPrisma()

beforeEach(async () => {
  await resetDatabase(prisma)
})

describe('seed', () => {
  it('creates the full reference dataset', async () => {
    await seed(prisma)

    expect(await prisma.ward.count()).toBe(4)
    expect(await prisma.drug.count()).toBe(15)
    expect(await prisma.inventoryItem.count()).toBe(15)
    expect(await prisma.user.count()).toBe(7)
    expect(await prisma.patient.count()).toBe(5)
    expect(await prisma.prescription.count()).toBe(15)
  })

  it('gives every prescribed drug an inventory row', async () => {
    await seed(prisma)

    const prescriptions = await prisma.prescription.findMany({ select: { drugId: true } })
    const stocked = await prisma.inventoryItem.findMany({ select: { drugId: true } })
    const stockedIds = new Set(stocked.map((item) => item.drugId))

    for (const { drugId } of prescriptions) {
      expect(stockedIds.has(drugId)).toBe(true)
    }
  })

  it('is idempotent — a second run changes no counts', async () => {
    await seed(prisma)
    await seed(prisma)

    expect(await prisma.drug.count()).toBe(15)
    expect(await prisma.patient.count()).toBe(5)
    expect(await prisma.prescription.count()).toBe(15)
  })

  it('stores prices as exact decimals', async () => {
    await seed(prisma)

    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: 'Aspirin 75mg' } })
    expect(drug.unitPrice.toString()).toBe('0.12')
  })

  it('hashes seeded passwords rather than storing them in clear text', async () => {
    await seed(prisma)

    const user = await prisma.user.findUniqueOrThrow({ where: { username: 'k.asante' } })
    expect(user.passwordHash).not.toContain('pharmassist')
    expect(user.passwordHash.startsWith('$argon2')).toBe(true)
  })

  it('scopes nurses to a ward and leaves other roles unscoped', async () => {
    await seed(prisma)

    const nurse = await prisma.user.findUniqueOrThrow({
      where: { username: 'a.owusu' },
      include: { ward: true },
    })
    const pharmacist = await prisma.user.findUniqueOrThrow({ where: { username: 'k.asante' } })

    expect(nurse.ward?.code).toBe('Ward 4A')
    expect(pharmacist.wardId).toBeNull()
  })
})
