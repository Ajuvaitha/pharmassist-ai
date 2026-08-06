import { z } from 'zod'

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    // Only tests need this, so it must not block a production deploy that
    // has no test database at all. See the superRefine below.
    TEST_DATABASE_URL: z.string().min(1).optional(),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    /**
     * Comma-separated list of origins permitted to send credentialed
     * requests. Leave unset for a same-origin deployment (the Vite dev proxy
     * makes development same-origin). Never set this to "*" — a wildcard
     * cannot be combined with credentials.
     */
    CORS_ORIGIN: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'test' && !env.TEST_DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['TEST_DATABASE_URL'],
        message: 'TEST_DATABASE_URL is required',
      })
    }
  })
  .refine((env) => env.CORS_ORIGIN !== '*', {
    message: 'CORS_ORIGIN must not be "*" — a wildcard cannot be combined with credentials',
    path: ['CORS_ORIGIN'],
  })

export type Env = z.infer<typeof envSchema>

/**
 * Validates the environment at startup so a misconfigured deploy fails
 * immediately rather than at the first request that needs the value.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source)

  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid environment — ${detail}`)
  }

  return result.data
}
