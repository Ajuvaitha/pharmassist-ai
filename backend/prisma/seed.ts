import { PrismaClient } from '@prisma/client'
import { hash } from '@node-rs/argon2'
import { toFoodTimingEnum } from '../src/domain/enums'
import { DRUGS, INVENTORY, PATIENTS, SEED_PASSWORD, USERS, WARDS } from './seed-data'

/**
 * Idempotent: every write is an upsert keyed on a natural unique column,
 * so re-running against a populated database is a no-op rather than a
 * duplicate-key crash.
 */
export async function seed(prisma: PrismaClient): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database')
  }

  for (const ward of WARDS) {
    await prisma.ward.upsert({
      where: { code: ward.code },
      update: { name: ward.name },
      create: { code: ward.code, name: ward.name },
    })
  }

  for (const drug of DRUGS) {
    await prisma.drug.upsert({
      where: { label: drug.label },
      update: { unitPrice: drug.unitPrice, category: drug.category },
      create: {
        label: drug.label,
        name: drug.name,
        strength: drug.strength,
        form: drug.form,
        category: drug.category,
        unitPrice: drug.unitPrice,
      },
    })
  }

  for (const item of INVENTORY) {
    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: item.drug } })
    await prisma.inventoryItem.upsert({
      where: { drugId: drug.id },
      update: { reorderLevel: item.reorderLevel },
      create: {
        drugId: drug.id,
        currentStock: item.currentStock,
        reorderLevel: item.reorderLevel,
      },
    })
  }

  const passwordHash = await hash(SEED_PASSWORD)

  for (const user of USERS) {
    const ward = user.wardCode
      ? await prisma.ward.findUniqueOrThrow({ where: { code: user.wardCode } })
      : null

    await prisma.user.upsert({
      where: { username: user.username },
      update: { displayName: user.displayName, role: user.role, wardId: ward?.id ?? null },
      create: {
        username: user.username,
        passwordHash,
        displayName: user.displayName,
        role: user.role,
        wardId: ward?.id ?? null,
      },
    })
  }

  for (const patient of PATIENTS) {
    const ward = await prisma.ward.findUniqueOrThrow({ where: { code: patient.wardCode } })

    const record = await prisma.patient.upsert({
      where: { mrn: patient.mrn },
      update: { wardId: ward.id, bed: patient.bed },
      create: {
        mrn: patient.mrn,
        name: patient.name,
        dateOfBirth: new Date(patient.dateOfBirth),
        gender: patient.gender,
        phone: patient.phone,
        wardId: ward.id,
        bed: patient.bed,
        admissionDate: new Date(patient.admissionDate),
        diagnosis: patient.diagnosis,
        allergies: patient.allergies,
      },
    })

    for (const rx of patient.prescriptions) {
      const drug = await prisma.drug.findUniqueOrThrow({ where: { label: rx.drug } })
      const prescriber = await prisma.user.findUniqueOrThrow({
        where: { username: rx.prescribedBy },
      })

      // Prescriptions have no natural unique key, so identity here is
      // (patient, drug, startDate). Re-seeding must not duplicate them.
      const existing = await prisma.prescription.findFirst({
        where: {
          patientId: record.id,
          drugId: drug.id,
          startDate: new Date(rx.startDate),
        },
      })

      if (existing) continue

      await prisma.prescription.create({
        data: {
          patientId: record.id,
          drugId: drug.id,
          dose: rx.dose,
          route: rx.route,
          frequency: rx.frequency,
          foodTiming: toFoodTimingEnum(rx.foodTiming),
          timeOfDay: [...rx.timeOfDay],
          startDate: new Date(rx.startDate),
          durationDays: rx.durationDays,
          status: rx.status,
          stopReason: 'stopReason' in rx ? rx.stopReason : null,
          notes: 'notes' in rx ? rx.notes : null,
          prescribedById: prescriber.id,
          prescribedAt: new Date(rx.prescribedAt),
        },
      })
    }
  }
}

// Entrypoint for `pnpm --filter @pharmassist/backend seed`.
if (import.meta.url === `file://${process.argv[1]}`) {
  const prisma = new PrismaClient()
  await seed(prisma)
  await prisma.$disconnect()
  console.log('Seed complete')
}
