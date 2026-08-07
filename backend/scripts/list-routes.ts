import { buildApp } from '../src/app'

/**
 * Prints every route the app actually registers. The API document is
 * written from this output, so it cannot describe an endpoint that does
 * not exist.
 */
const app = await buildApp()
await app.ready()
console.log(app.printRoutes({ commonPrefix: false }))
await app.close()
