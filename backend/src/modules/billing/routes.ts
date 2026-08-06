import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { confirmBillingSchema, type PatientBillingGroup } from '@pharmassist/shared'
import { requireUser } from '../../plugins/auth'
import { confirmBilling, listBilling } from './service'

const querySchema = z.object({
  wardId: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

function parseDate(value?: string): Date | undefined {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined
}

const billingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/billing', { preHandler: app.guard() }, async (request): Promise<PatientBillingGroup[]> => {
    const query = querySchema.parse(request.query)
    return listBilling(app.prisma, requireUser(request), {
      wardId: query.wardId,
      date: parseDate(query.date),
    })
  })

  app.post('/api/billing/confirm', { preHandler: app.guard('pharmacist') }, async (request): Promise<PatientBillingGroup> => {
    const input = confirmBillingSchema.parse(request.body)
    return confirmBilling(app.prisma, requireUser(request), { ...input, date: parseDate(input.date) })
  })
}

export default billingRoutes
