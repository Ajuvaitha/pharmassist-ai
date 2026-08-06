import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { confirmBillingSchema, type PatientBillingGroup } from '@pharmassist/shared'
import { requireUser } from '../../plugins/auth'
import { parseOptionalIsoDate } from '../../domain/dates'
import { confirmBilling, listBilling } from './service'

const querySchema = z.object({
  wardId: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const billingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/billing', { preHandler: app.guard() }, async (request): Promise<PatientBillingGroup[]> => {
    const query = querySchema.parse(request.query)
    return listBilling(app.prisma, requireUser(request), {
      wardId: query.wardId,
      date: parseOptionalIsoDate(query.date),
    })
  })

  app.post('/api/billing/confirm', { preHandler: app.guard('pharmacist') }, async (request): Promise<PatientBillingGroup> => {
    const input = confirmBillingSchema.parse(request.body)
    return confirmBilling(app.prisma, requireUser(request), { ...input, date: parseOptionalIsoDate(input.date) })
  })
}

export default billingRoutes
