import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

const GOOGLE_TOKEN_INFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const VALID_ISSUERS = new Set([
  'accounts.google.com',
  'https://accounts.google.com',
]);
const googleTokenInfoSchema = z.object({
  aud: z.string().trim().min(1),
  email: z.string().trim().email(),
  email_verified: z.union([z.boolean(), z.string().trim()]),
  iss: z.string().trim().min(1),
  name: z.string().trim().optional(),
  picture: z.string().trim().optional(),
  sub: z.string().trim().min(1),
});

export interface VerifiedGoogleIdentity {
  email: string;
  googleId: string;
  name?: string;
  avatarUrl?: string;
}

@Injectable()
export class GoogleTokenVerifierService {
  constructor(private readonly configService: ConfigService) {}

  async verifyIdToken(idToken: string): Promise<VerifiedGoogleIdentity> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID')?.trim();
    if (!clientId) {
      throw new UnauthorizedException({
        code: 'GOOGLE_AUTH_NOT_CONFIGURED',
        message: 'Google authentication is not configured',
      });
    }

    let payload: z.infer<typeof googleTokenInfoSchema>;
    try {
      const response = await fetch(
        `${GOOGLE_TOKEN_INFO_URL}?id_token=${encodeURIComponent(idToken)}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new UnauthorizedException({
          code: 'INVALID_GOOGLE_TOKEN',
          message: 'Google ID token is invalid',
        });
      }

      const rawPayload: unknown = await response.json();
      const parsedPayload = googleTokenInfoSchema.safeParse(rawPayload);
      if (!parsedPayload.success) {
        throw new UnauthorizedException({
          code: 'INVALID_GOOGLE_TOKEN',
          message: 'Google ID token claims are invalid',
        });
      }

      payload = parsedPayload.data;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
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
    const issuer = payload.iss;
    const emailVerified = normalizeEmailVerified(payload.email_verified);

    if (
      !email ||
      !googleId ||
      !emailVerified ||
      audience !== clientId ||
      !issuer ||
      !VALID_ISSUERS.has(issuer)
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
