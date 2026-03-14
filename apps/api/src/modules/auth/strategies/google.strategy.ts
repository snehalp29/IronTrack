import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    const nodeEnv =
      configService.get<string>('NODE_ENV')?.trim() ??
      process.env.NODE_ENV ??
      'development';
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID')?.trim();
    const clientSecret = configService
      .get<string>('GOOGLE_CLIENT_SECRET')
      ?.trim();
    const callbackURL = configService
      .get<string>('GOOGLE_CALLBACK_URL')
      ?.trim();

    const hasAnyConfig = Boolean(clientID || clientSecret || callbackURL);
    const hasCompleteConfig = Boolean(clientID && clientSecret && callbackURL);

    if (nodeEnv === 'production' && !hasCompleteConfig) {
      throw new Error(
        'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL are required in production.',
      );
    }

    if (nodeEnv !== 'production' && hasAnyConfig && !hasCompleteConfig) {
      throw new Error(
        'Google OAuth config must provide GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL together.',
      );
    }

    super({
      // Keep API bootable in local/dev when Google OAuth is not configured.
      clientID: clientID ?? 'local-dev-google-client-id',
      clientSecret: clientSecret ?? 'local-dev-google-client-secret',
      callbackURL:
        callbackURL ?? 'http://localhost:3000/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    done(null, {
      accessToken,
      refreshToken,
      profile,
    });
  }
}
