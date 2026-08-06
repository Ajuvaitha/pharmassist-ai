import { buildApp } from './app'
import { loadEnv } from './env'
import { registerSweepJob } from './jobs/sweep'

const env = loadEnv()
const app = await buildApp()

registerSweepJob(app)

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
