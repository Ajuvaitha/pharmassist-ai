import cron from 'node-cron'
import type { FastifyInstance } from 'fastify'
import { runSweep } from '../modules/indents/service'

/** 06:00 every day, server time. */
const SCHEDULE = '0 6 * * *'

/**
 * Calls the same service the manual endpoint calls, so a re-trigger cannot
 * drift from the scheduled run. Registered only from server.ts — tests
 * build the app without ever starting a scheduler.
 */
export function registerSweepJob(app: FastifyInstance): void {
  cron.schedule(SCHEDULE, () => {
    void runSweep(app.prisma)
      .then((result) => {
        const lines = result.wards.reduce((sum, ward) => sum + ward.lineCount, 0)
        app.log.info({ date: result.date, wards: result.wards.length, lines }, 'Daily ward sweep complete')
      })
      .catch((error) => {
        app.log.error({ err: error }, 'Daily ward sweep failed')
      })
  })

  app.log.info({ schedule: SCHEDULE }, 'Daily ward sweep scheduled')
}
