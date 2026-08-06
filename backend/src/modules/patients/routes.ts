import type { FastifyPluginAsync } from 'fastify'
import { createPatientSchema, patientListQuerySchema, type Patient } from '@pharmassist/shared'
import { requireUser } from '../../plugins/auth'
import { createPatient, getPatient, listPatients } from './service'

const patientRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/patients', { preHandler: app.guard() }, async (request): Promise<Patient[]> => {
    const query = patientListQuerySchema.parse(request.query)
    return listPatients(app.prisma, requireUser(request), query)
  })

  app.get<{ Params: { id: string } }>(
    '/api/patients/:id',
    { preHandler: app.guard() },
    async (request): Promise<Patient> => {
      return getPatient(app.prisma, requireUser(request), request.params.id)
    },
  )

  app.post('/api/patients', { preHandler: app.guard('nurse', 'pharmacist') }, async (request, reply): Promise<Patient> => {
    const input = createPatientSchema.parse(request.body)
    const patient = await createPatient(app.prisma, requireUser(request), input)
    reply.status(201)
    return patient
  })
}

export default patientRoutes
