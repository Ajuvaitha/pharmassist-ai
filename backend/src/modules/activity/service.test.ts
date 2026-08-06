import { beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'
import { listActivity } from './service'
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

async function makeEvent(type: 'restock' | 'register', text: string, occurredAt: Date, wardCode?: string) {
  const ward = wardCode ? await prisma.ward.findUniqueOrThrow({ where: { code: wardCode } }) : null
  await prisma.activityEvent.create({
    data: { type, text, occurredAt, wardId: ward?.id ?? null },
  })
}

describe('listActivity', () => {
  it('returns events newest first', async () => {
    await makeEvent('restock', 'older', new Date('2026-08-05T07:00:00Z'))
    await makeEvent('restock', 'newer', new Date('2026-08-06T07:00:00Z'))

    const items = await listActivity(prisma, await viewerFor('k.asante'), { limit: 50 })
    expect(items[0].text).toBe('newer')
  })

  it('splits the timestamp into display date and time', async () => {
    await makeEvent('restock', 'x', new Date('2026-08-06T07:05:00Z'))

    const [item] = await listActivity(prisma, await viewerFor('k.asante'), { limit: 50 })
    expect(item.date).toBe('2026-08-06')
    expect(item.time).toBe('07:05')
  })

  it('filters by type', async () => {
    await makeEvent('restock', 'a restock', new Date('2026-08-06T07:00:00Z'))
    await makeEvent('register', 'a registration', new Date('2026-08-06T08:00:00Z'))

    const items = await listActivity(prisma, await viewerFor('k.asante'), { type: 'restock', limit: 50 })
    expect(items).toHaveLength(1)
    expect(items[0].text).toBe('a restock')
  })

  it('filters by date', async () => {
    await makeEvent('restock', 'on the 5th', new Date('2026-08-05T07:00:00Z'))
    await makeEvent('restock', 'on the 6th', new Date('2026-08-06T07:00:00Z'))

    const items = await listActivity(prisma, await viewerFor('k.asante'), { date: '2026-08-05', limit: 50 })
    expect(items).toHaveLength(1)
    expect(items[0].text).toBe('on the 5th')
  })

  it('honours the limit', async () => {
    for (let i = 0; i < 5; i += 1) {
      await makeEvent('restock', `event ${i}`, new Date(`2026-08-06T07:0${i}:00Z`))
    }

    expect(await listActivity(prisma, await viewerFor('k.asante'), { limit: 3 })).toHaveLength(3)
  })

  it('scopes a nurse to their own ward, including events with no ward', async () => {
    await makeEvent('restock', 'ward 4A event', new Date('2026-08-06T07:00:00Z'), 'Ward 4A')
    await makeEvent('restock', 'ward 2D event', new Date('2026-08-06T08:00:00Z'), 'Ward 2D')
    await makeEvent('restock', 'pharmacy-wide event', new Date('2026-08-06T09:00:00Z'))

    const texts = (await listActivity(prisma, await viewerFor('a.owusu'), { limit: 50 })).map((i) => i.text)
    expect(texts).toContain('ward 4A event')
    expect(texts).toContain('pharmacy-wide event')
    expect(texts).not.toContain('ward 2D event')
  })
})
