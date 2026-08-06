import { beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'
import { AppError } from '../../errors'
import { dispense, runSweep } from '../indents/service'
import { confirmBilling, listBilling } from './service'
import type { SessionUser } from '@pharmassist/shared'

const prisma = getTestPrisma()
const DATE = new Date('2026-08-03T00:00:00Z')

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
  await runSweep(prisma, { date: DATE })

  const ward = await prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 4A' } })
  const patient = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-004821' } })
  await dispense(prisma, await viewerFor('k.asante'), { patientId: patient.id, wardId: ward.id, date: DATE })
})

describe('listBilling', () => {
  it('groups billing lines by patient with a total', async () => {
    const groups = await listBilling(prisma, await viewerFor('k.asante'), {})

    expect(groups).toHaveLength(1)
    expect(groups[0].patient).toBe('Margaret Osei')
    expect(groups[0].transactions.length).toBeGreaterThan(0)
    expect(groups[0].total).toBeGreaterThan(0)
    expect(groups[0].billed).toBe(false)
  })

  it('sends money as numbers, not Decimal strings', async () => {
    const [group] = await listBilling(prisma, await viewerFor('k.asante'), {})

    expect(typeof group.total).toBe('number')
    expect(typeof group.transactions[0].unitPrice).toBe('number')
    expect(typeof group.transactions[0].total).toBe('number')
  })

  it('scopes a nurse to their own ward', async () => {
    const groups = await listBilling(prisma, await viewerFor('y.darko'), {})
    expect(groups).toHaveLength(0)
  })
})

describe('confirmBilling', () => {
  it('marks the patient group billed', async () => {
    const patient = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-004821' } })
    const group = await confirmBilling(prisma, await viewerFor('k.asante'), { patientId: patient.id, date: DATE })

    expect(group.billed).toBe(true)
    expect(group.pendingCount).toBe(0)

    const lines = await prisma.billingLine.findMany({ where: { patientId: patient.id } })
    expect(lines.every((l) => l.status === 'billed')).toBe(true)
    expect(lines.every((l) => l.billedAt !== null)).toBe(true)
  })

  it('rejects confirming an already-billed group', async () => {
    const patient = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-004821' } })
    const viewer = await viewerFor('k.asante')
    await confirmBilling(prisma, viewer, { patientId: patient.id, date: DATE })

    const error = await confirmBilling(prisma, viewer, { patientId: patient.id, date: DATE }).catch((e) => e)
    expect(error).toBeInstanceOf(AppError)
    expect(error.code).toBe('ALREADY_BILLED')
  })

  it('rejects a patient with nothing to bill', async () => {
    const other = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-002017' } })
    await expect(confirmBilling(prisma, await viewerFor('k.asante'), { patientId: other.id, date: DATE }))
      .rejects.toBeInstanceOf(AppError)
  })
})
