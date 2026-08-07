import type { PrismaClient } from '@prisma/client'
import type { Drug } from '@pharmassist/shared'
import { decimalToNumber } from '../../domain/dto'

export async function listDrugs(prisma: PrismaClient, search?: string): Promise<Drug[]> {
  const term = search?.trim()

  const drugs = await prisma.drug.findMany({
    where: term
      ? { label: { contains: term, mode: 'insensitive' } }
      : { inventoryItem: { isNot: null } },
    orderBy: { label: 'asc' },
    take: 100,
  })

  return drugs.map((drug) => ({
    id: drug.id,
    label: drug.label,
    name: drug.name,
    strength: drug.strength,
    form: drug.form,
    category: drug.category,
    unitPrice: decimalToNumber(drug.unitPrice),
  }))
}
