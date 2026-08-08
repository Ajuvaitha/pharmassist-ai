import { beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'

const prisma = getTestPrisma()

beforeEach(async () => {
  await resetDatabase(prisma)
  await seed(prisma)
})

describe('agentic foundation', () => {
  it('seeds a chatbot actor user', async () => {
    const user = await prisma.user.findUnique({ where: { username: 'chatbot' } })
    expect(user?.role).toBe('pharmacist')
  })

  it('round-trips a pending action row', async () => {
    await prisma.chatbotPendingAction.create({
      data: { sessionId: 's1', action: 'restock', params: { drugId: 'd', qty: 5 }, summary: 'x' },
    })
    const row = await prisma.chatbotPendingAction.findUnique({ where: { sessionId: 's1' } })
    expect(row?.action).toBe('restock')
  })
})

async function call(fn: string, ...args: unknown[]) {
  const ph = args.map((_, i) => `$${i + 1}`).join(', ')
  const rows = await prisma.$queryRawUnsafe<{ r: any }[]>(`SELECT ${fn}(${ph}) AS r`, ...args)
  return rows[0].r
}

describe('sql_restock', () => {
  it('rejects a non-positive quantity', async () => {
    const r = await call('sql_restock', 'Aspirin 75mg', 0, true)
    expect(r.ok).toBe(false)
  })

  it('errors on an unknown drug', async () => {
    const r = await call('sql_restock', 'nonexistent-drug', 10, true)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/No drug/)
  })

  it('errors and lists matches on an ambiguous drug', async () => {
    const r = await call('sql_restock', 'in', 10, true) // matches many labels
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/Ambiguous/)
  })

  it('preview resolves without writing', async () => {
    const before = await prisma.inventoryItem.findFirstOrThrow({ where: { drug: { label: 'Aspirin 75mg' } } })
    const r = await call('sql_restock', 'Aspirin 75mg', 50, true)
    expect(r.ok).toBe(true)
    expect(r.params.qty).toBe(50)
    const after = await prisma.inventoryItem.findFirstOrThrow({ where: { drug: { label: 'Aspirin 75mg' } } })
    expect(after.currentStock).toBe(before.currentStock)
  })

  it('commit increments stock and writes movement + activity', async () => {
    const before = await prisma.inventoryItem.findFirstOrThrow({ where: { drug: { label: 'Aspirin 75mg' } } })
    const r = await call('sql_restock', 'Aspirin 75mg', 50, false)
    expect(r.ok).toBe(true)
    const after = await prisma.inventoryItem.findFirstOrThrow({ where: { drug: { label: 'Aspirin 75mg' } } })
    expect(after.currentStock).toBe(before.currentStock + 50)
    const mv = await prisma.stockMovement.findFirst({ where: { drugId: after.drugId, reason: 'restock', delta: 50 } })
    expect(mv).not.toBeNull()
    const ev = await prisma.activityEvent.findFirst({ where: { type: 'restock', drugId: after.drugId } })
    expect(ev?.text).toMatch(/via assistant/)
    const chatbot = await prisma.user.findUniqueOrThrow({ where: { username: 'chatbot' } })
    expect(mv?.actorId).toBe(chatbot.id)
  })
})
