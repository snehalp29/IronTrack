import { ConfigService } from '@nestjs/config';

import { GoogleTokenVerifierService } from './google-token-verifier.service';

describe('GoogleTokenVerifierService', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let service: GoogleTokenVerifierService;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
    const configService = {
      get: (key: string) =>
        key === 'GOOGLE_CLIENT_ID' ? 'test-google-client-id' : undefined,
    } as unknown as ConfigService;
    service = new GoogleTokenVerifierService(configService);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('accepts a token with valid Google claims', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: 'test-google-client-id',
        email: 'Verified@IronTrack.local',
        email_verified: 'true',
        iss: 'https://accounts.google.com',
        name: 'Verified User',
        picture: 'https://example.com/avatar.png',
        sub: 'google-sub-123',
      }),
    } as Response);

    await expect(
      service.verifyIdToken('valid-google-id-token-1234567890'),
    ).resolves.toEqual({
      email: 'verified@irontrack.local',
      googleId: 'google-sub-123',
      name: 'Verified User',
      avatarUrl: 'https://example.com/avatar.png',
    });
  });

  it('accepts boolean email_verified and optional name/picture fields', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: 'test-google-client-id',
        email: 'verified@irontrack.local',
        email_verified: true,
        iss: 'accounts.google.com',
        sub: 'google-sub-123',
      }),
    } as Response);

    await expect(
      service.verifyIdToken('valid-google-id-token-boolean'),
    ).resolves.toEqual({
      email: 'verified@irontrack.local',
      googleId: 'google-sub-123',
      name: undefined,
      avatarUrl: undefined,
    });
  });

  it('normalizes blank optional strings to undefined', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: 'test-google-client-id',
        email: 'verified@irontrack.local',
        email_verified: 'true',
        iss: 'https://accounts.google.com',
        name: '   ',
        picture: '  ',
        sub: 'google-sub-123',
      }),
    } as Response);

    await expect(
      service.verifyIdToken('valid-google-id-token-blank-optional'),
    ).resolves.toEqual({
      email: 'verified@irontrack.local',
      googleId: 'google-sub-123',
      name: undefined,
      avatarUrl: undefined,
    });
  });

  it('rejects a token with invalid audience', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: 'wrong-client-id',
        email: 'verified@irontrack.local',
        email_verified: 'true',
        iss: 'https://accounts.google.com',
        sub: 'google-sub-123',
      }),
    } as Response);

    await expect(
      service.verifyIdToken('invalid-google-id-token-1234567890'),
    ).rejects.toMatchObject({
      response: {
        code: 'INVALID_GOOGLE_TOKEN',
      },
    });
  });

  it('rejects a token with invalid issuer', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: 'test-google-client-id',
        email: 'verified@irontrack.local',
        email_verified: 'true',
        iss: 'https://evil.example.com',
        sub: 'google-sub-123',
      }),
    } as Response);

    await expect(
      service.verifyIdToken('invalid-issuer-token'),
    ).rejects.toMatchObject({
      response: {
        code: 'INVALID_GOOGLE_TOKEN',
      },
    });
  });

  it('rejects a token when email_verified resolves to false', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: 'test-google-client-id',
        email: 'verified@irontrack.local',
        email_verified: 'false',
        iss: 'https://accounts.google.com',
        sub: 'google-sub-123',
      }),
    } as Response);

    await expect(
      service.verifyIdToken('email-not-verified-token'),
    ).rejects.toMatchObject({
      response: {
        code: 'INVALID_GOOGLE_TOKEN',
      },
    });
  });

  it('rejects when Google token endpoint returns an error', async () => {
    const jsonSpy = jest.fn().mockResolvedValue({});
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      json: jsonSpy,
    } as unknown as Response);

    await expect(
      service.verifyIdToken('invalid-google-id-token-1234567890'),
    ).rejects.toMatchObject({
      response: {
        code: 'INVALID_GOOGLE_TOKEN',
      },
    });
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('rejects when Google auth is not configured', async () => {
    const configService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const unconfiguredService = new GoogleTokenVerifierService(configService);

    await expect(
      unconfiguredService.verifyIdToken('any-token'),
    ).rejects.toMatchObject({
      response: {
        code: 'GOOGLE_AUTH_NOT_CONFIGURED',
      },
    });
  });

  it('rejects when token claims payload does not match schema', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: 'test-google-client-id',
        email_verified: 'true',
        iss: 'https://accounts.google.com',
        sub: 'google-sub-123',
      }),
    } as Response);

    await expect(
      service.verifyIdToken('invalid-schema-token'),
    ).rejects.toMatchObject({
      response: {
        code: 'INVALID_GOOGLE_TOKEN',
      },
    });
  });

  it('rejects when fetch throws unexpectedly', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));

    await expect(service.verifyIdToken('fetch-throws')).rejects.toMatchObject({
      response: {
        code: 'GOOGLE_TOKEN_VERIFICATION_FAILED',
      },
    });
  });

  it('rejects when Google returns a non-JSON body', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('invalid json');
      },
    } as unknown as Response);

    await expect(
      service.verifyIdToken('invalid-google-json'),
    ).rejects.toMatchObject({
      response: {
        code: 'GOOGLE_TOKEN_VERIFICATION_FAILED',
      },
    });
  });

  it('rejects when email_verified is non-boolean/non-string', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: 'test-google-client-id',
        email: 'verified@irontrack.local',
        email_verified: 1,
        iss: 'https://accounts.google.com',
        sub: 'google-sub-123',
      }),
    } as Response);

    await expect(
      service.verifyIdToken('invalid-email-verified'),
    ).rejects.toMatchObject({
      response: {
        code: 'INVALID_GOOGLE_TOKEN',
      },
    });
  });

  it('accepts string email_verified values case-insensitively', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: 'test-google-client-id',
        email: 'verified@irontrack.local',
        email_verified: 'TRUE',
        iss: 'https://accounts.google.com',
        sub: 'google-sub-123',
      }),
    } as Response);

    await expect(
      service.verifyIdToken('valid-google-id-token-uppercase-verified'),
    ).resolves.toEqual({
      email: 'verified@irontrack.local',
      googleId: 'google-sub-123',
      name: undefined,
      avatarUrl: undefined,
    });
  });
});
