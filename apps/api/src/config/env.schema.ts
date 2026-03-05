import { z } from 'zod';

import {
  trimString,
  trimStringOrUndefined,
} from '../common/validation/string-normalization';

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8081',
];
const DEFAULT_CORS_ORIGINS_RAW = DEFAULT_CORS_ORIGINS.join(',');
const CORS_EMPTY_ENTRIES_MESSAGE =
  'CORS_ORIGINS must not contain empty entries';
const CORS_INVALID_ORIGIN_MESSAGE =
  'CORS_ORIGINS entries must be valid HTTP or HTTPS origins (no path, query, or fragment)';
const ACCESS_TOKEN_MAX_DURATION_SECONDS = 24 * 60 * 60;
const REFRESH_TOKEN_MAX_DURATION_SECONDS = 365 * 24 * 60 * 60;

const durationSchema = z
  .string()
  .trim()
  .regex(
    /^[1-9]\d*[smhd]$/,
    'Expected positive duration format like 15m, 7d, 30s, or 2h',
  );

const durationUnitInSeconds = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
} as const;

type DurationUnit = keyof typeof durationUnitInSeconds;

function durationToSeconds(duration: string): number {
  // Defensive guard: Zod may still execute refine callbacks after regex failure.
  const match = duration.match(/^([1-9]\d*)([smhd])$/);
  if (!match) {
    return Number.NaN;
  }

  const amount = Number(match[1]);
  const unit = match[2] as DurationUnit;
  return amount * durationUnitInSeconds[unit];
}

const accessExpirySchema = durationSchema.refine(
  (duration) =>
    durationToSeconds(duration) <= ACCESS_TOKEN_MAX_DURATION_SECONDS,
  {
    message: 'JWT_ACCESS_EXPIRY must be less than or equal to 24h',
  },
);

const refreshExpirySchema = durationSchema.refine(
  (duration) =>
    durationToSeconds(duration) <= REFRESH_TOKEN_MAX_DURATION_SECONDS,
  {
    message: 'JWT_REFRESH_EXPIRY must be less than or equal to 365d',
  },
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

const optionalTrimmedGoogleClientSecretSchema = z.preprocess(
  trimStringOrUndefined,
  z.string().min(10).optional(),
);

const jwtSecretSchema = z.preprocess(trimString, z.string().min(16));

function isValidCorsOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }
    return (
      url.pathname === '/' && url.search.length === 0 && url.hash.length === 0
    );
  } catch {
    return false;
  }
}

const corsOriginsSchema = z
  .string()
  .transform((value) => value.split(',').map((origin) => origin.trim()))
  .refine((origins) => origins.every((origin) => origin !== ''), {
    message: CORS_EMPTY_ENTRIES_MESSAGE,
  })
  // filter(Boolean) prevents double-reporting: empty entries are handled above.
  .refine((origins) => origins.filter(Boolean).every(isValidCorsOrigin), {
    message: CORS_INVALID_ORIGIN_MESSAGE,
  });

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
    JWT_ACCESS_SECRET: jwtSecretSchema,
    JWT_REFRESH_SECRET: jwtSecretSchema,
    JWT_ACCESS_EXPIRY: accessExpirySchema.default('15m'),
    JWT_REFRESH_EXPIRY: refreshExpirySchema.default('7d'),
    GOOGLE_CLIENT_ID: optionalTrimmedStringSchema,
    GOOGLE_CLIENT_SECRET: optionalTrimmedGoogleClientSecretSchema,
    GOOGLE_CALLBACK_URL: optionalTrimmedUrlSchema,
    ML_SERVICE_URL: z.preprocess(
      trimStringOrUndefined,
      z.string().url().default('http://localhost:5000'),
    ),
    CORS_ORIGINS: z.preprocess((value) => {
      const normalized = trimStringOrUndefined(value);
      return normalized ?? DEFAULT_CORS_ORIGINS_RAW;
    }, corsOriginsSchema),
  })
  .superRefine((env, ctx) => {
    const accessExpirySeconds = durationToSeconds(env.JWT_ACCESS_EXPIRY);
    const refreshExpirySeconds = durationToSeconds(env.JWT_REFRESH_EXPIRY);
    if (accessExpirySeconds >= refreshExpirySeconds) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_ACCESS_EXPIRY'],
        message: 'JWT_ACCESS_EXPIRY must be shorter than JWT_REFRESH_EXPIRY',
      });
    }

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
          code: 'custom',
          path: ['GOOGLE_CLIENT_ID'],
          message: 'GOOGLE_CLIENT_ID is required when NODE_ENV=production',
        });
      }
      if (!hasGoogleClientSecret) {
        ctx.addIssue({
          code: 'custom',
          path: ['GOOGLE_CLIENT_SECRET'],
          message: 'GOOGLE_CLIENT_SECRET is required when NODE_ENV=production',
        });
      }
      if (!hasGoogleCallbackUrl) {
        ctx.addIssue({
          code: 'custom',
          path: ['GOOGLE_CALLBACK_URL'],
          message: 'GOOGLE_CALLBACK_URL is required when NODE_ENV=production',
        });
      }
    }

    if (
      env.NODE_ENV === 'production' &&
      env.ML_SERVICE_URL.startsWith('http://')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['ML_SERVICE_URL'],
        message: 'ML_SERVICE_URL must use https when NODE_ENV=production',
      });
    }

    if (env.NODE_ENV === 'production') {
      return;
    }

    if (hasAnyGoogleConfig && !hasCompleteGoogleConfig) {
      if (!hasGoogleClientId) {
        ctx.addIssue({
          code: 'custom',
          path: ['GOOGLE_CLIENT_ID'],
          message:
            'GOOGLE_CLIENT_ID must be provided with GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL',
        });
      }
      if (!hasGoogleClientSecret) {
        ctx.addIssue({
          code: 'custom',
          path: ['GOOGLE_CLIENT_SECRET'],
          message:
            'GOOGLE_CLIENT_SECRET must be provided with GOOGLE_CLIENT_ID and GOOGLE_CALLBACK_URL',
        });
      }
      if (!hasGoogleCallbackUrl) {
        ctx.addIssue({
          code: 'custom',
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
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
        return `${path}: ${issue.message}`;
      })
      .join(', ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return parsed.data;
}
