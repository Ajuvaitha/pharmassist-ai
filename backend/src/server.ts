import { buildApp } from './app'
import { loadEnv } from './env'

const env = loadEnv()
const app = await buildApp()

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
