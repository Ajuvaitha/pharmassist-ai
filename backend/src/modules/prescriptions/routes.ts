import type { FastifyPluginAsync } from 'fastify'
import {
  createPrescriptionSchema,
  stopPrescriptionSchema,
  updatePrescriptionSchema,
  type Prescription,
} from '@pharmassist/shared'
import { requireUser } from '../../plugins/auth'
import { createPrescription, stopPrescription, updatePrescription } from './service'

const prescriptionRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { id: string } }>(
    '/api/patients/:id/prescriptions',
    { preHandler: app.guard('doctor') },
    async (request, reply): Promise<Prescription> => {
      const input = createPrescriptionSchema.parse(request.body)
      const rx = await createPrescription(app.prisma, requireUser(request), request.params.id, input)
      reply.status(201)
      return rx
    },
  )

  app.patch<{ Params: { id: string } }>(
    '/api/prescriptions/:id',
    { preHandler: app.guard('doctor') },
    async (request): Promise<Prescription> => {
      const input = updatePrescriptionSchema.parse(request.body)
      return updatePrescription(app.prisma, requireUser(request), request.params.id, input)
    },
  )

  app.post<{ Params: { id: string } }>(
    '/api/prescriptions/:id/stop',
    { preHandler: app.guard('doctor') },
    async (request): Promise<Prescription> => {
      const { reason } = stopPrescriptionSchema.parse(request.body)
      return stopPrescription(app.prisma, requireUser(request), request.params.id, reason)
    },
  )
}

export default prescriptionRoutes
