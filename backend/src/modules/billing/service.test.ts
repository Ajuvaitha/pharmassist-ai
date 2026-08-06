import { beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'
import { AppError } from '../../errors'
import { dispense, runSweep } from '../indents/service'
import { confirmBilling, listBilling } from './service'
import type { PatientBillingGroup, SessionUser } from '@pharmassist/shared'

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

  it('rejects a nurse whose account has no assigned ward instead of returning every ward\'s billing', async () => {
    const viewer: SessionUser = { ...(await viewerFor('y.darko')), ward: null }
    await expect(listBilling(prisma, viewer, {})).rejects.toBeInstanceOf(AppError)
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

  it('lets exactly one side of many concurrent confirms win, on money', async () => {
    // This is money, so a concurrent confirm must not report success twice.
    // confirmBilling is not wrapped in a transaction, so firing many real
    // calls at once (mirroring the concurrent-sweep test in
    // indents/sweep.test.ts) reliably lets several of them read the lines
    // as still pending before any of them has written — 50 concurrent
    // callers against a real Postgres connection pool consistently drives
    // the loser into the updateMany-matched-zero-rows branch rather than
    // just the pre-check (verified manually: with the discarded-result bug
    // reintroduced, this exact test observes all 50 calls fulfilling with
    // billed: true instead of 49 rejecting).
    const patient = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-004821' } })
    const viewer = await viewerFor('k.asante')

    const results = await Promise.allSettled(
      Array.from({ length: 50 }, () => confirmBilling(prisma, viewer, { patientId: patient.id, date: DATE })),
    )

    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<PatientBillingGroup> => r.status === 'fulfilled',
    )
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(49)
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(AppError)
      expect(r.reason.code).toBe('ALREADY_BILLED')
    }

    // And the money itself only moved once: every line ends up billed, not
    // double-processed.
    const lines = await prisma.billingLine.findMany({ where: { patientId: patient.id } })
    expect(lines.every((l) => l.status === 'billed')).toBe(true)
  })
})
