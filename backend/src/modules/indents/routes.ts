import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { dispenseRequestSchema, sweepRequestSchema, type SweepResult, type WardPickupList } from '@pharmassist/shared'
import { requireUser } from '../../plugins/auth'
import { parseOptionalIsoDate } from '../../domain/dates'
import { dispense, getPickupList, runSweep, type DispenseResult } from './service'

const dateQuerySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })

const indentRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/indents/sweep', { preHandler: app.guard('pharmacist') }, async (request): Promise<SweepResult> => {
    const input = sweepRequestSchema.parse(request.body ?? {})
    return runSweep(app.prisma, {
      date: parseOptionalIsoDate(input.date),
      wardId: input.wardId,
      preview: input.preview,
    })
  })

  app.get<{ Params: { id: string } }>(
    '/api/wards/:id/pickup-list',
    { preHandler: app.guard() },
    async (request): Promise<WardPickupList> => {
      const { date } = dateQuerySchema.parse(request.query)
      return getPickupList(app.prisma, requireUser(request), request.params.id, parseOptionalIsoDate(date))
    },
  )

  app.post('/api/indents/dispense', { preHandler: app.guard('pharmacist') }, async (request): Promise<DispenseResult> => {
    const input = dispenseRequestSchema.parse(request.body)
    return dispense(app.prisma, requireUser(request), { ...input, date: parseOptionalIsoDate(input.date) })
  })
}

export default indentRoutes
