import { beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'
import { listWards } from './service'
import type { SessionUser } from '@pharmassist/shared'

const prisma = getTestPrisma()

async function viewerFor(username: string): Promise<SessionUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { username }, include: { ward: true } })
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    ward: user.ward
      ? { id: user.ward.id, code: user.ward.code, name: user.ward.name, label: `${user.ward.code} — ${user.ward.name}` }
      : null,
  }
}

beforeEach(async () => {
  await resetDatabase(prisma)
  await seed(prisma)
})

describe('listWards', () => {
  it('returns every ward for a pharmacist', async () => {
    const wards = await listWards(prisma, await viewerFor('k.asante'))
    expect(wards.map((w) => w.code).sort()).toEqual(['Ward 2D', 'Ward 4A', 'Ward 5B', 'Ward 6C'])
  })

  it('returns only the assigned ward for a nurse', async () => {
    const wards = await listWards(prisma, await viewerFor('a.owusu'))
    expect(wards).toHaveLength(1)
    expect(wards[0].code).toBe('Ward 4A')
  })

  it('composes the display label', async () => {
    const wards = await listWards(prisma, await viewerFor('a.owusu'))
    expect(wards[0].label).toBe('Ward 4A — General Medicine')
  })

  it('counts admitted patients per ward', async () => {
    const wards = await listWards(prisma, await viewerFor('k.asante'))
    const ward4a = wards.find((w) => w.code === 'Ward 4A')
    expect(ward4a?.activePatients).toBe(2)
  })

  it('excludes discharged patients from the count', async () => {
    const patient = await prisma.patient.findFirstOrThrow({ where: { ward: { code: 'Ward 4A' } } })
    await prisma.patient.update({ where: { id: patient.id }, data: { status: 'discharged' } })

    const wards = await listWards(prisma, await viewerFor('k.asante'))
    expect(wards.find((w) => w.code === 'Ward 4A')?.activePatients).toBe(1)
  })

  it('reports pending when no indent exists for the day', async () => {
    const wards = await listWards(prisma, await viewerFor('k.asante'))
    expect(wards.every((w) => w.sweepStatus === 'pending')).toBe(true)
  })

  it("reflects today's indent status", async () => {
    const ward = await prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 5B' } })
    const today = new Date()
    const indentDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    await prisma.dailyIndent.create({ data: { wardId: ward.id, indentDate, status: 'swept' } })

    const wards = await listWards(prisma, await viewerFor('k.asante'))
    expect(wards.find((w) => w.code === 'Ward 5B')?.sweepStatus).toBe('swept')
    expect(wards.find((w) => w.code === 'Ward 4A')?.sweepStatus).toBe('pending')
  })
})
