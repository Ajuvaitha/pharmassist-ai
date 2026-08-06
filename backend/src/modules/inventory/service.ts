import type { Prisma, PrismaClient } from '@prisma/client'
import type { InventoryItem, RestockRequest, SessionUser } from '@pharmassist/shared'
import { AppError } from '../../errors'
import { toInventoryDto } from '../../domain/dto'

const itemInclude = { drug: true } satisfies Prisma.InventoryItemInclude

export interface InventoryQuery {
  category?: string
  search?: string
}

export async function listInventory(
  prisma: PrismaClient,
  query: InventoryQuery,
): Promise<InventoryItem[]> {
  const search = query.search?.trim()

  const items = await prisma.inventoryItem.findMany({
    where: {
      drug: {
        ...(query.category && query.category !== 'All' ? { category: query.category } : {}),
        ...(search ? { label: { contains: search, mode: 'insensitive' } } : {}),
      },
    },
    include: itemInclude,
    orderBy: { drug: { label: 'asc' } },
  })

  return items.map(toInventoryDto)
}

export async function listCategories(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.drug.findMany({
    distinct: ['category'],
    select: { category: true },
    orderBy: { category: 'asc' },
  })
  return rows.map((row) => row.category)
}

/**
 * Stock and its movement log are written together, so the append-only
 * movements always reconcile with the running total.
 */
export async function restock(
  prisma: PrismaClient,
  actor: SessionUser,
  drugId: string,
  input: RestockRequest,
): Promise<InventoryItem> {
  const item = await prisma.inventoryItem.findUnique({ where: { drugId }, include: itemInclude })
  if (!item) throw AppError.notFound(`No inventory record found for drug ${drugId}`)

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.inventoryItem.update({
      where: { drugId },
      data: { currentStock: { increment: input.qty } },
      include: itemInclude,
    })

    await tx.stockMovement.create({
      data: {
        drugId,
        delta: input.qty,
        reason: 'restock',
        ref: input.ref ?? null,
        actorId: actor.id,
      },
    })

    await tx.activityEvent.create({
      data: {
        type: 'restock',
        drugId,
        actorId: actor.id,
        text: `Restocked ${item.drug.label} — +${input.qty} ${item.drug.form.toLowerCase()}s${input.ref ? ` (Ref: ${input.ref})` : ''}`,
      },
    })

    return next
  })

  return toInventoryDto(updated)
}
