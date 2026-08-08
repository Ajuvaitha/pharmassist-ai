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
