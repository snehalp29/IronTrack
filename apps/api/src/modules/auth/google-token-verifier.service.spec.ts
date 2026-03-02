import { UnauthorizedException } from '@nestjs/common';
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

  it('rejects a token with invalid claims', async () => {
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
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when Google token endpoint returns an error', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    await expect(
      service.verifyIdToken('invalid-google-id-token-1234567890'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
