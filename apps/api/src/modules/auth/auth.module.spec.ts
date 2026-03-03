import { MODULE_METADATA } from '@nestjs/common/constants';
import { JwtModule } from '@nestjs/jwt';

import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

describe('AuthModule', () => {
  it('does not register unused Google passport strategy provider', () => {
    const providers =
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AuthModule) ?? [];

    expect(providers).not.toContain(GoogleStrategy);
    expect(providers).toEqual(
      expect.arrayContaining([AuthService, JwtStrategy]),
    );
  });

  it('parses JWT access expiry from config into seconds', () => {
    const imports =
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, AuthModule) ?? [];
    const jwtDynamicModule = imports.find(
      (entry: unknown) => (entry as { module?: unknown }).module === JwtModule,
    ) as {
      providers?: Array<{ useFactory?: (...args: unknown[]) => unknown }>;
    };

    const jwtOptionsFactory = jwtDynamicModule.providers?.find(
      (provider) => typeof provider.useFactory === 'function',
    )?.useFactory as (...args: unknown[]) => {
      signOptions: { expiresIn: number };
    };

    const configServiceMock = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'JWT_ACCESS_SECRET') {
          return 'access-secret-1234567890';
        }
        if (key === 'JWT_ACCESS_EXPIRY') {
          return '2h';
        }
        throw new Error(`Unexpected key: ${key}`);
      }),
    };

    const jwtOptions = jwtOptionsFactory(configServiceMock);

    expect(jwtOptions.signOptions.expiresIn).toBe(7200);
  });

  it('falls back to 15 minutes when JWT access expiry is invalid', () => {
    const imports =
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, AuthModule) ?? [];
    const jwtDynamicModule = imports.find(
      (entry: unknown) => (entry as { module?: unknown }).module === JwtModule,
    ) as {
      providers?: Array<{ useFactory?: (...args: unknown[]) => unknown }>;
    };

    const jwtOptionsFactory = jwtDynamicModule.providers?.find(
      (provider) => typeof provider.useFactory === 'function',
    )?.useFactory as (...args: unknown[]) => {
      signOptions: { expiresIn: number };
    };

    const configServiceMock = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'JWT_ACCESS_SECRET') {
          return 'access-secret-1234567890';
        }
        if (key === 'JWT_ACCESS_EXPIRY') {
          return 'invalid';
        }
        throw new Error(`Unexpected key: ${key}`);
      }),
    };

    const jwtOptions = jwtOptionsFactory(configServiceMock);

    expect(jwtOptions.signOptions.expiresIn).toBe(900);
  });
});
