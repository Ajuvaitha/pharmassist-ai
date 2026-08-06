import { beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'
import { AppError } from '../../errors'
import { listCategories, listInventory, restock } from './service'
import type { SessionUser } from '@pharmassist/shared'

const prisma = getTestPrisma()

async function viewerFor(username: string): Promise<SessionUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { username }, include: { ward: true } })
  return {
    id: user.id, username: user.username, displayName: user.displayName, role: user.role,
    ward: user.ward
      ? { id: user.ward.id, code: user.ward.code, name: user.ward.name, label: `${user.ward.code} — ${user.ward.name}` }
      : null,
  }
}

beforeEach(async () => {
  await resetDatabase(prisma)
  await seed(prisma)
})

describe('listInventory', () => {
  it('returns every stocked drug with a derived status', async () => {
    const items = await listInventory(prisma, {})
    expect(items).toHaveLength(15)

    expect(items.find((i) => i.drug === 'Furosemide 40mg')?.status).toBe('low')
    expect(items.find((i) => i.drug === 'Clopidogrel 75mg')?.status).toBe('critical')
    expect(items.find((i) => i.drug === 'Aspirin 75mg')?.status).toBe('ok')
  })

  it('exposes the drug form as the unit', async () => {
    const items = await listInventory(prisma, {})
    expect(items.find((i) => i.drug === 'Amoxicillin 500mg')?.unit).toBe('Capsule')
  })

  it('filters by category and by search term', async () => {
    expect((await listInventory(prisma, { category: 'Diuretics' })).length).toBe(2)
    expect((await listInventory(prisma, { search: 'aspir' }))[0].drug).toBe('Aspirin 75mg')
  })
})

describe('listCategories', () => {
  it('returns distinct categories in alphabetical order', async () => {
    const categories = await listCategories(prisma)
    expect(categories).toContain('Antibiotics')
    expect(categories).toContain('Diuretics')
    expect([...categories].sort()).toEqual(categories)
    expect(new Set(categories).size).toBe(categories.length)
  })
})

describe('restock', () => {
  it('increases stock and recomputes the status', async () => {
    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: 'Clopidogrel 75mg' } })
    const updated = await restock(prisma, await viewerFor('k.asante'), drug.id, { qty: 200, ref: 'PO-2026-0480' })

    expect(updated.currentStock).toBe(207)
    expect(updated.status).toBe('ok')
  })

  it('writes a stock movement that reconciles with the new total', async () => {
    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: 'Clopidogrel 75mg' } })
    await restock(prisma, await viewerFor('k.asante'), drug.id, { qty: 200, ref: 'PO-2026-0480' })

    const movement = await prisma.stockMovement.findFirstOrThrow({ where: { drugId: drug.id } })
    expect(movement.delta).toBe(200)
    expect(movement.reason).toBe('restock')
    expect(movement.ref).toBe('PO-2026-0480')
  })

  it('records a restock activity event', async () => {
    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: 'Clopidogrel 75mg' } })
    await restock(prisma, await viewerFor('k.asante'), drug.id, { qty: 200 })

    const event = await prisma.activityEvent.findFirstOrThrow({ where: { type: 'restock' } })
    expect(event.text).toContain('Clopidogrel 75mg')
    expect(event.text).toContain('200')
  })

  it('rejects an unknown drug', async () => {
    await expect(restock(prisma, await viewerFor('k.asante'), 'nope', { qty: 10 }))
      .rejects.toBeInstanceOf(AppError)
  })
})
