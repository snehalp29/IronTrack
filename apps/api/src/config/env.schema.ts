import { z } from 'zod';

const durationSchema = z
  .string()
  .regex(/^\d+[smhd]$/, 'Expected duration format like 15m, 7d, 30s, or 2h');

const postgresConnectionSchema = z
  .string()
  .regex(
    /^postgres(?:ql)?:\/\//i,
    'Expected DATABASE_URL to start with postgres:// or postgresql://',
  );

const databaseUrlSchema = z.string().url().pipe(postgresConnectionSchema);

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().default('api/v1'),
  DATABASE_URL: databaseUrlSchema,
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRY: durationSchema.default('15m'),
  JWT_REFRESH_EXPIRY: durationSchema.default('7d'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  ML_SERVICE_URL: z.string().url().default('http://localhost:5000'),
  CORS_ORIGINS: z
    .string()
    .default(
      'http://localhost:3000,http://localhost:5173,http://localhost:8081',
    ),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return parsed.data;
}
