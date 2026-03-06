import {
  BadGatewayException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, verify } from 'node:crypto';
import { z } from 'zod';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const DEFAULT_JWKS_CACHE_TTL_SECONDS = 300;
const GOOGLE_JWKS_REQUEST_TIMEOUT_MS = 5000;
const GOOGLE_TOKEN_CLOCK_SKEW_TOLERANCE_MS = 60_000;
const VALID_ISSUERS = new Set([
  'accounts.google.com',
  'https://accounts.google.com',
]);
const jwtHeaderSchema = z.object({
  alg: z.string().trim().min(1),
  kid: z.string().trim().min(1),
});
const googleJwkSchema = z.object({
  kid: z.string().trim().min(1),
  kty: z.literal('RSA'),
  n: z.string().trim().min(1),
  e: z.string().trim().min(1),
  alg: z.string().trim().optional(),
  use: z.string().trim().optional(),
});
const googleJwksSchema = z.object({
  keys: z.array(googleJwkSchema).min(1),
});
const googleTokenClaimsSchema = z.object({
  aud: z.union([z.string().trim().min(1), z.array(z.string().trim().min(1))]),
  azp: z.string().trim().min(1).optional(),
  email: z.string().trim().email(),
  email_verified: z.union([z.boolean(), z.string().trim()]),
  exp: z.number().int().positive(),
  iss: z.string().trim().min(1),
  name: z.string().trim().optional(),
  picture: z.string().trim().optional(),
  sub: z.string().trim().min(1),
});
type GoogleTokenClaims = z.infer<typeof googleTokenClaimsSchema>;
type GoogleJwk = z.infer<typeof googleJwkSchema>;
type CachedGoogleJwks = {
  keys: GoogleJwk[];
  expiresAtMs: number;
};

export interface VerifiedGoogleIdentity {
  email: string;
  googleId: string;
  name?: string;
  avatarUrl?: string;
}

@Injectable()
export class GoogleTokenVerifierService {
  private jwksCache?: CachedGoogleJwks;

  constructor(private readonly configService: ConfigService) {}

  async verifyIdToken(idToken: string): Promise<VerifiedGoogleIdentity> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID')?.trim();
    if (!clientId) {
      throw new UnauthorizedException({
        code: 'GOOGLE_AUTH_NOT_CONFIGURED',
        message: 'Google authentication is not configured',
      });
    }

    let payload: GoogleTokenClaims;
    try {
      const rawPayload = await this.verifyJwtAndDecodePayload(idToken);
      const parsedPayload = googleTokenClaimsSchema.safeParse(rawPayload);
      if (!parsedPayload.success) {
        throw new UnauthorizedException({
          code: 'INVALID_GOOGLE_TOKEN',
          message: 'Google ID token claims are invalid',
        });
      }

      payload = parsedPayload.data;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadGatewayException
      ) {
        throw error;
      }

      throw new UnauthorizedException({
        code: 'GOOGLE_TOKEN_VERIFICATION_FAILED',
        message: 'Unable to verify Google ID token',
      });
    }

    const email = payload.email.toLowerCase();
    const googleId = payload.sub;
    const audience = payload.aud;
    const authorizedParty = payload.azp;
    const issuer = payload.iss;
    const emailVerified = normalizeEmailVerified(payload.email_verified);
    const notExpired =
      payload.exp * 1000 + GOOGLE_TOKEN_CLOCK_SKEW_TOLERANCE_MS > Date.now();

    if (
      !emailVerified ||
      !hasAudience(audience, clientId) ||
      !hasValidAuthorizedParty(audience, authorizedParty, clientId) ||
      !VALID_ISSUERS.has(issuer) ||
      !notExpired
    ) {
      throw new UnauthorizedException({
        code: 'INVALID_GOOGLE_TOKEN',
        message: 'Google ID token claims are invalid',
      });
    }

    return {
      email,
      googleId,
      name: normalizeOptionalString(payload.name),
      avatarUrl: normalizeOptionalString(payload.picture),
    };
  }

  private async verifyJwtAndDecodePayload(idToken: string): Promise<unknown> {
    const segments = idToken.split('.');
    if (segments.length !== 3) {
      throw new UnauthorizedException({
        code: 'INVALID_GOOGLE_TOKEN',
        message: 'Google ID token claims are invalid',
      });
    }

    const [encodedHeader, encodedPayload, encodedSignature] = segments;
    const parsedHeader = jwtHeaderSchema.safeParse(
      parseJsonBase64UrlSegment(encodedHeader),
    );
    if (!parsedHeader.success || parsedHeader.data.alg !== 'RS256') {
      throw new UnauthorizedException({
        code: 'INVALID_GOOGLE_TOKEN',
        message: 'Google ID token claims are invalid',
      });
    }

    const jwk = await this.resolveSigningKey(parsedHeader.data.kid);
    const signature = parseBinaryBase64UrlSegment(encodedSignature);
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const publicKey = createPublicKey({
      key: { kty: 'RSA', n: jwk.n, e: jwk.e },
      format: 'jwk',
    });
    const signatureValid = verify(
      'RSA-SHA256',
      Buffer.from(signingInput),
      publicKey,
      signature,
    );
    if (!signatureValid) {
      throw new UnauthorizedException({
        code: 'INVALID_GOOGLE_TOKEN',
        message: 'Google ID token claims are invalid',
      });
    }

    return parseJsonBase64UrlSegment(encodedPayload);
  }

  private async resolveSigningKey(kid: string): Promise<GoogleJwk> {
    const hasValidCachedKeys =
      this.jwksCache && this.jwksCache.expiresAtMs > Date.now();
    const keys = await this.getGoogleSigningKeys();
    const key = findSigningKey(keys, kid);
    if (key && key !== 'invalid') {
      return key;
    }

    if (key === null && hasValidCachedKeys) {
      const refreshedKeys = await this.getGoogleSigningKeys(true);
      const refreshedKey = findSigningKey(refreshedKeys, kid);
      if (refreshedKey && refreshedKey !== 'invalid') {
        return refreshedKey;
      }
    }

    throw new UnauthorizedException({
      code: 'INVALID_GOOGLE_TOKEN',
      message: 'Google ID token claims are invalid',
    });
  }

  private async getGoogleSigningKeys(
    forceRefresh = false,
  ): Promise<GoogleJwk[]> {
    const now = Date.now();
    if (!forceRefresh && this.jwksCache && this.jwksCache.expiresAtMs > now) {
      return this.jwksCache.keys;
    }

    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => {
      abortController.abort();
    }, GOOGLE_JWKS_REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(GOOGLE_JWKS_URL, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: abortController.signal,
      });
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (!response.ok) {
      throw new BadGatewayException({
        code: 'GOOGLE_JWKS_UNAVAILABLE',
        message: 'Unable to fetch Google signing keys',
      });
    }

    const rawPayload: unknown = await response.json();
    const parsedPayload = googleJwksSchema.safeParse(rawPayload);
    if (!parsedPayload.success) {
      throw new UnauthorizedException({
        code: 'INVALID_GOOGLE_TOKEN',
        message: 'Google ID token claims are invalid',
      });
    }

    const maxAgeSeconds =
      parseCacheMaxAgeSeconds(response.headers.get('cache-control')) ??
      DEFAULT_JWKS_CACHE_TTL_SECONDS;
    this.jwksCache = {
      keys: parsedPayload.data.keys,
      expiresAtMs: now + maxAgeSeconds * 1000,
    };

    return parsedPayload.data.keys;
  }
}

function normalizeOptionalString(
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeEmailVerified(value: boolean | string): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  return value.toLowerCase() === 'true';
}

function findSigningKey(
  keys: GoogleJwk[],
  kid: string,
): GoogleJwk | 'invalid' | null {
  const key = keys.find((entry) => entry.kid === kid);
  if (!key) {
    return null;
  }

  if (
    (key.use !== undefined && key.use !== 'sig') ||
    (key.alg !== undefined && key.alg !== 'RS256')
  ) {
    return 'invalid';
  }

  return key;
}

function hasAudience(audience: string | string[], clientId: string): boolean {
  return Array.isArray(audience)
    ? audience.includes(clientId)
    : audience === clientId;
}

function hasValidAuthorizedParty(
  audience: string | string[],
  authorizedParty: string | undefined,
  clientId: string,
): boolean {
  if (!Array.isArray(audience)) {
    return true;
  }

  return authorizedParty === clientId;
}

function parseCacheMaxAgeSeconds(
  cacheControl: string | null,
): number | undefined {
  if (!cacheControl) {
    return undefined;
  }

  const match = /max-age=(\d+)/i.exec(cacheControl);
  if (!match) {
    return undefined;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function parseJsonBase64UrlSegment(segment: string): unknown {
  const decoded = parseBinaryBase64UrlSegment(segment).toString('utf8');
  try {
    return JSON.parse(decoded);
  } catch {
    throw new UnauthorizedException({
      code: 'INVALID_GOOGLE_TOKEN',
      message: 'Google ID token claims are invalid',
    });
  }
}

function parseBinaryBase64UrlSegment(segment: string): Buffer {
  return Buffer.from(segment, 'base64url');
}
