import { z } from 'zod';

import {
  trimString,
  trimStringOrUndefined,
} from '../common/validation/string-normalization';

const durationSchema = z
  .string()
  .trim()
  .regex(
    /^[1-9]\d*[smhd]$/,
    'Expected positive duration format like 15m, 7d, 30s, or 2h',
  );

const postgresConnectionSchema = z
  .string()
  .regex(
    /^postgres(?:ql)?:\/\//i,
    'Expected DATABASE_URL to start with postgres:// or postgresql://',
  );

const databaseUrlSchema = z.string().url().pipe(postgresConnectionSchema);

const optionalTrimmedStringSchema = z.preprocess(
  trimStringOrUndefined,
  z.string().optional(),
);

const optionalTrimmedUrlSchema = z.preprocess(
  trimStringOrUndefined,
  z.string().url().optional(),
);

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    API_PORT: z.coerce.number().int().positive().default(3000),
    API_PREFIX: z.preprocess(
      trimStringOrUndefined,
      z.string().default('api/v1'),
    ),
    DATABASE_URL: z.preprocess(trimString, databaseUrlSchema),
    JWT_ACCESS_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_ACCESS_EXPIRY: durationSchema.default('15m'),
    JWT_REFRESH_EXPIRY: durationSchema.default('7d'),
    GOOGLE_CLIENT_ID: optionalTrimmedStringSchema,
    GOOGLE_CLIENT_SECRET: optionalTrimmedStringSchema,
    GOOGLE_CALLBACK_URL: optionalTrimmedUrlSchema,
    ML_SERVICE_URL: z.string().url().default('http://localhost:5000'),
    CORS_ORIGINS: z.preprocess(
      trimStringOrUndefined,
      z
        .string()
        .default(
          'http://localhost:3000,http://localhost:5173,http://localhost:8081',
        ),
    ),
  })
  .superRefine((env, ctx) => {
    const hasGoogleClientId = Boolean(env.GOOGLE_CLIENT_ID);
    const hasGoogleClientSecret = Boolean(env.GOOGLE_CLIENT_SECRET);
    const hasGoogleCallbackUrl = Boolean(env.GOOGLE_CALLBACK_URL);

    const hasAnyGoogleConfig =
      hasGoogleClientId || hasGoogleClientSecret || hasGoogleCallbackUrl;
    const hasCompleteGoogleConfig =
      hasGoogleClientId && hasGoogleClientSecret && hasGoogleCallbackUrl;

    if (env.NODE_ENV === 'production' && !hasCompleteGoogleConfig) {
      if (!hasGoogleClientId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GOOGLE_CLIENT_ID'],
          message: 'GOOGLE_CLIENT_ID is required when NODE_ENV=production',
        });
      }
      if (!hasGoogleClientSecret) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GOOGLE_CLIENT_SECRET'],
          message: 'GOOGLE_CLIENT_SECRET is required when NODE_ENV=production',
        });
      }
      if (!hasGoogleCallbackUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GOOGLE_CALLBACK_URL'],
          message: 'GOOGLE_CALLBACK_URL is required when NODE_ENV=production',
        });
      }
      return;
    }

    if (
      env.NODE_ENV !== 'production' &&
      hasAnyGoogleConfig &&
      !hasCompleteGoogleConfig
    ) {
      if (!hasGoogleClientId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GOOGLE_CLIENT_ID'],
          message:
            'GOOGLE_CLIENT_ID must be provided with GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL',
        });
      }
      if (!hasGoogleClientSecret) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GOOGLE_CLIENT_SECRET'],
          message:
            'GOOGLE_CLIENT_SECRET must be provided with GOOGLE_CLIENT_ID and GOOGLE_CALLBACK_URL',
        });
      }
      if (!hasGoogleCallbackUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GOOGLE_CALLBACK_URL'],
          message:
            'GOOGLE_CALLBACK_URL must be provided with GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET',
        });
      }
    }
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
