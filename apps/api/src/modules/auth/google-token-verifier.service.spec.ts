import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign } from 'jsonwebtoken';
import { generateKeyPairSync } from 'node:crypto';

import { GoogleTokenVerifierService } from './google-token-verifier.service';

const CLIENT_ID = 'test-google-client-id';
const KID = 'google-key-1';
const ALT_KID = 'google-key-2';

type TokenClaims = {
  aud: string | string[];
  azp?: string;
  email: string;
  email_verified: boolean | string;
  exp: number;
  iss: string;
  name?: string;
  picture?: string;
  sub: string;
};

describe('GoogleTokenVerifierService', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let privateKeyPem: string;
  let alternatePrivateKeyPem: string;
  let keyN: string;
  let keyE: string;
  let alternateKeyN: string;
  let alternateKeyE: string;
  let service: GoogleTokenVerifierService;

  beforeAll(() => {
    const mainKeyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    privateKeyPem = mainKeyPair.privateKey
      .export({ type: 'pkcs1', format: 'pem' })
      .toString();
    const publicJwk = mainKeyPair.publicKey.export({ format: 'jwk' }) as {
      n?: string;
      e?: string;
    };
    if (!publicJwk.n || !publicJwk.e) {
      throw new Error('Failed to create RSA JWK fixture');
    }
    keyN = publicJwk.n;
    keyE = publicJwk.e;

    const alternateKeyPair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    alternatePrivateKeyPem = alternateKeyPair.privateKey
      .export({ type: 'pkcs1', format: 'pem' })
      .toString();
    const alternatePublicJwk = alternateKeyPair.publicKey.export({
      format: 'jwk',
    }) as {
      n?: string;
      e?: string;
    };
    if (!alternatePublicJwk.n || !alternatePublicJwk.e) {
      throw new Error('Failed to create alternate RSA JWK fixture');
    }
    alternateKeyN = alternatePublicJwk.n;
    alternateKeyE = alternatePublicJwk.e;
  });

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
    service = createService(CLIENT_ID);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.useRealTimers();
  });

  it('accepts a token with valid claims and normalizes email + optional fields', async () => {
    fetchSpy.mockResolvedValue(
      createJwksResponse(
        { keys: [createSigningJwk()] },
        { cacheControl: 'public, max-age=600' },
      ),
    );

    await expect(
      service.verifyIdToken(
        createToken({
          email: 'Verified@IronTrack.local',
          email_verified: 'true',
          name: ' Verified User ',
          picture: ' https://example.com/avatar.png ',
        }),
      ),
    ).resolves.toEqual({
      email: 'verified@irontrack.local',
      googleId: 'google-sub-123',
      name: 'Verified User',
      avatarUrl: 'https://example.com/avatar.png',
    });
  });

  it('accepts boolean email_verified and omits undefined optional fields', async () => {
    fetchSpy.mockResolvedValue(
      createJwksResponse({ keys: [createSigningJwk()] }),
    );

    await expect(
      service.verifyIdToken(
        createToken({
          email: 'verified@irontrack.local',
          email_verified: true,
          iss: 'accounts.google.com',
          name: undefined,
          picture: undefined,
        }),
      ),
    ).resolves.toEqual({
      email: 'verified@irontrack.local',
      googleId: 'google-sub-123',
      name: undefined,
      avatarUrl: undefined,
    });
  });

  it('normalizes blank optional strings to undefined', async () => {
    fetchSpy.mockResolvedValue(
      createJwksResponse({ keys: [createSigningJwk()] }),
    );

    await expect(
      service.verifyIdToken(
        createToken({
          name: '   ',
          picture: '   ',
        }),
      ),
    ).resolves.toEqual({
      email: 'verified@irontrack.local',
      googleId: 'google-sub-123',
      name: undefined,
      avatarUrl: undefined,
    });
  });

  it('accepts audience arrays containing configured client id', async () => {
    fetchSpy.mockResolvedValue(
      createJwksResponse({ keys: [createSigningJwk()] }),
    );

    await expect(
      service.verifyIdToken(
        createToken({
          aud: ['another-client', CLIENT_ID],
          azp: CLIENT_ID,
        }),
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        email: 'verified@irontrack.local',
      }),
    );
  });

  it('rejects audience arrays whose authorized party does not match the configured client id', async () => {
    fetchSpy.mockResolvedValue(
      createJwksResponse({ keys: [createSigningJwk()] }),
    );

    await expect(
      service.verifyIdToken(
        createToken({
          aud: ['another-client', CLIENT_ID],
          azp: 'another-client',
        }),
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'INVALID_GOOGLE_TOKEN',
      },
    });
  });

  it('rejects a token with invalid audience', async () => {
    fetchSpy.mockResolvedValue(
      createJwksResponse({ keys: [createSigningJwk()] }),
    );

    await expect(
      service.verifyIdToken(
        createToken({
          aud: 'wrong-client-id',
        }),
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'INVALID_GOOGLE_TOKEN',
      },
    });
  });

  it('rejects a token with invalid issuer', async () => {
    fetchSpy.mockResolvedValue(
      createJwksResponse({ keys: [createSigningJwk()] }),
    );

    await expect(
      service.verifyIdToken(
        createToken({
          iss: 'https://evil.example.com',
        }),
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'INVALID_GOOGLE_TOKEN',
      },
    });
  });

  it('rejects when email_verified resolves to false', async () => {
    fetchSpy.mockResolvedValue(
      createJwksResponse({ keys: [createSigningJwk()] }),
    );

    await expect(
      service.verifyIdToken(
        createToken({
          email_verified: 'false',
        }),
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'INVALID_GOOGLE_TOKEN',
      },
    });
  });

  it('accepts string email_verified values case-insensitively', async () => {
    fetchSpy.mockResolvedValue(
      createJwksResponse({ keys: [createSigningJwk()] }),
    );

    await expect(
      service.verifyIdToken(
        createToken({
          email_verified: 'TRUE',
        }),
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        email: 'verified@irontrack.local',
      }),
    );
  });

  it('rejects missing GOOGLE_CLIENT_ID configuration', async () => {
    const unconfiguredService = createService(undefined);

    await expect(
      unconfiguredService.verifyIdToken(createToken()),
    ).rejects.toMatchObject({
      response: {
        code: 'GOOGLE_AUTH_NOT_CONFIGURED',
      },
    });
  });

  it('rejects when Google JWKS endpoint returns non-2xx', async () => {
    const jsonSpy = jest.fn().mockResolvedValue({});
    fetchSpy.mockResolvedValue(
      createJwksResponse({}, { ok: false, json: jsonSpy }),
    );

    await expect(service.verifyIdToken(createToken())).rejects.toMatchObject({
      response: {
        code: 'GOOGLE_JWKS_UNAVAILABLE',
      },
    });
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('rejects when JWKS payload does not match schema', async () => {
    fetchSpy.mockResolvedValue(createJwksResponse({ keys: [] }));

    await expect(service.verifyIdToken(createToken())).rejects.toMatchObject({
      response: {
        code: 'INVALID_GOOGLE_TOKEN',
      },
    });
  });

  it('maps non-OK JWKS responses to a bad gateway error', async () => {
    fetchSpy.mockResolvedValue(
      createJwksResponse(
        { error: 'unavailable' },
        {
          ok: false,
          status: 503,
        },
      ),
    );

    await expect(service.verifyIdToken(createToken())).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    await expect(service.verifyIdToken(createToken())).rejects.toMatchObject({
      response: {
        code: 'GOOGLE_JWKS_UNAVAILABLE',
      },
    });
  });

  it('rejects when JWT is expired', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-06T12:00:00.000Z'));
    fetchSpy.mockResolvedValue(
      createJwksResponse({ keys: [createSigningJwk()] }),
    );

    await expect(
      service.verifyIdToken(
        createToken({
          exp: Math.floor(Date.now() / 1000) - 61,
        }),
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'INVALID_GOOGLE_TOKEN',
      },
    });
  });

  it('accepts tokens within the allowed clock skew tolerance window', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-06T12:00:00.000Z'));
    fetchSpy.mockResolvedValue(
      createJwksResponse({ keys: [createSigningJwk()] }),
    );

    await expect(
      service.verifyIdToken(
        createToken({
          exp: Math.floor(Date.now() / 1000) - 30,
        }),
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        email: 'verified@irontrack.local',
      }),
    );
  });

  it('rejects when token kid does not exist in signing keys', async () => {
    fetchSpy.mockResolvedValue(
      createJwksResponse({ keys: [createSigningJwk()] }),
    );

    await expect(
      service.verifyIdToken(createToken({}, { kid: 'unknown-kid' })),
    ).rejects.toMatchObject({
      response: {
        code: 'INVALID_GOOGLE_TOKEN',
      },
    });
  });

  it('refreshes JWKS when cached keys miss the requested kid before cache expiry', async () => {
    fetchSpy
      .mockResolvedValueOnce(
        createJwksResponse(
          { keys: [createSigningJwk()] },
          { cacheControl: 'public, max-age=600' },
        ),
      )
      .mockResolvedValueOnce(
        createJwksResponse(
          { keys: [createSigningJwk(ALT_KID, alternateKeyN, alternateKeyE)] },
          { cacheControl: 'public, max-age=600' },
        ),
      );

    await expect(
      service.verifyIdToken(createToken({ sub: 'cached-kid-user' })),
    ).resolves.toEqual(
      expect.objectContaining({
        email: 'verified@irontrack.local',
      }),
    );

    await expect(
      service.verifyIdToken(
        createToken(
          { sub: 'rotated-kid-user' },
          { kid: ALT_KID, key: alternatePrivateKeyPem },
        ),
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        email: 'verified@irontrack.local',
      }),
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('rejects JWKS keys that are not marked for signature use', async () => {
    fetchSpy.mockResolvedValue(
      createJwksResponse({
        keys: [{ ...createSigningJwk(), use: 'enc' }],
      }),
    );

    await expect(service.verifyIdToken(createToken())).rejects.toMatchObject({
      response: {
        code: 'INVALID_GOOGLE_TOKEN',
      },
    });
  });

  it('rejects JWKS keys that advertise a non-RS256 algorithm', async () => {
    fetchSpy.mockResolvedValue(
      createJwksResponse({
        keys: [{ ...createSigningJwk(), alg: 'HS256' }],
      }),
    );

    await expect(service.verifyIdToken(createToken())).rejects.toMatchObject({
      response: {
        code: 'INVALID_GOOGLE_TOKEN',
      },
    });
  });

  it('rejects malformed JWT payloads', async () => {
    fetchSpy.mockResolvedValue(
      createJwksResponse({ keys: [createSigningJwk()] }),
    );

    await expect(service.verifyIdToken('not-a-jwt')).rejects.toMatchObject({
      response: {
        code: 'INVALID_GOOGLE_TOKEN',
      },
    });

    await expect(service.verifyIdToken('a.b.c')).rejects.toMatchObject({
      response: {
        code: 'INVALID_GOOGLE_TOKEN',
      },
    });
  });

  it('rejects non-RS256 tokens before signature verification', async () => {
    fetchSpy.mockResolvedValue(
      createJwksResponse({ keys: [createSigningJwk()] }),
    );
    const hsToken = sign(defaultClaims(), 'hs-secret', {
      algorithm: 'HS256',
      keyid: KID,
      noTimestamp: true,
    });

    await expect(service.verifyIdToken(hsToken)).rejects.toMatchObject({
      response: {
        code: 'INVALID_GOOGLE_TOKEN',
      },
    });
  });

  it('rejects tokens with invalid signatures', async () => {
    fetchSpy.mockResolvedValue(
      createJwksResponse({ keys: [createSigningJwk()] }),
    );

    await expect(
      service.verifyIdToken(createToken({}, { key: alternatePrivateKeyPem })),
    ).rejects.toMatchObject({
      response: {
        code: 'INVALID_GOOGLE_TOKEN',
      },
    });
  });

  it('reuses cached JWKS while cache remains valid', async () => {
    fetchSpy.mockResolvedValue(
      createJwksResponse(
        { keys: [createSigningJwk()] },
        { cacheControl: 'public, max-age=600' },
      ),
    );

    await service.verifyIdToken(createToken({ sub: 'user-a' }));
    await service.verifyIdToken(createToken({ sub: 'user-b' }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('refreshes JWKS when cache expires', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-03T12:00:00.000Z'));
    fetchSpy.mockResolvedValue(
      createJwksResponse(
        { keys: [createSigningJwk()] },
        { cacheControl: 'public, max-age=1' },
      ),
    );

    await service.verifyIdToken(createToken({ sub: 'cache-user-a' }));
    jest.setSystemTime(new Date('2026-03-03T12:00:02.000Z'));
    await service.verifyIdToken(createToken({ sub: 'cache-user-b' }));

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('uses default JWKS TTL when cache-control is missing or unparseable', async () => {
    fetchSpy.mockResolvedValueOnce(
      createJwksResponse({ keys: [createSigningJwk()] }),
    );

    await service.verifyIdToken(createToken({ sub: 'ttl-default-a' }));
    await service.verifyIdToken(createToken({ sub: 'ttl-default-b' }));
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockClear();
    const noMaxAgeService = createService(CLIENT_ID);
    fetchSpy.mockResolvedValue(
      createJwksResponse(
        { keys: [createSigningJwk()] },
        { cacheControl: 'public' },
      ),
    );
    await noMaxAgeService.verifyIdToken(createToken({ sub: 'ttl-fallback-a' }));
    await noMaxAgeService.verifyIdToken(createToken({ sub: 'ttl-fallback-b' }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to verification failure when key fetch/parsing throws unexpectedly', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network down'));

    await expect(service.verifyIdToken(createToken())).rejects.toMatchObject({
      response: {
        code: 'GOOGLE_TOKEN_VERIFICATION_FAILED',
      },
    });

    fetchSpy.mockResolvedValueOnce(
      createJwksResponse(
        {},
        { ok: true, json: () => Promise.reject(new Error('bad json')) },
      ),
    );
    await expect(service.verifyIdToken(createToken())).rejects.toMatchObject({
      response: {
        code: 'GOOGLE_TOKEN_VERIFICATION_FAILED',
      },
    });
  });

  it('aborts stalled JWKS fetches and returns verification failure', async () => {
    jest.useFakeTimers();
    fetchSpy.mockImplementation(
      async (_input: string | URL | Request, init?: RequestInit) =>
        await new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            return;
          }

          signal.addEventListener('abort', () => {
            const abortError = new Error('aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        }),
    );

    const verification = service.verifyIdToken(createToken({ sub: 'timeout' }));
    let settled = false;
    void verification.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    await jest.advanceTimersByTimeAsync(5_001);
    expect(settled).toBe(true);

    await expect(verification).rejects.toMatchObject({
      response: {
        code: 'GOOGLE_TOKEN_VERIFICATION_FAILED',
      },
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('rejects when claims payload shape is invalid after successful signature verification', async () => {
    fetchSpy.mockResolvedValue(
      createJwksResponse({ keys: [createSigningJwk()] }),
    );

    await expect(
      service.verifyIdToken(
        createToken({
          // @ts-expect-error deliberate invalid claim fixture
          email_verified: 1,
        }),
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'INVALID_GOOGLE_TOKEN',
      },
    });
  });

  it('treats non-positive max-age as default cache ttl', async () => {
    fetchSpy.mockResolvedValue(
      createJwksResponse(
        { keys: [createSigningJwk()] },
        { cacheControl: 'public, max-age=0' },
      ),
    );

    await service.verifyIdToken(createToken({ sub: 'max-age-zero-a' }));
    await service.verifyIdToken(createToken({ sub: 'max-age-zero-b' }));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  function createService(
    clientId: string | undefined,
  ): GoogleTokenVerifierService {
    const configService = {
      get: (key: string) => (key === 'GOOGLE_CLIENT_ID' ? clientId : undefined),
    } as unknown as ConfigService;
    return new GoogleTokenVerifierService(configService);
  }

  function createSigningJwk(kid = KID, n = keyN, e = keyE) {
    return {
      kid,
      kty: 'RSA' as const,
      n,
      e,
      alg: 'RS256',
      use: 'sig',
    };
  }

  function defaultClaims(overrides: Partial<TokenClaims> = {}): TokenClaims {
    return {
      aud: CLIENT_ID,
      email: 'verified@irontrack.local',
      email_verified: 'true',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iss: 'https://accounts.google.com',
      name: 'Verified User',
      picture: 'https://example.com/avatar.png',
      sub: 'google-sub-123',
      ...overrides,
    };
  }

  function createToken(
    overrides: Partial<TokenClaims> = {},
    options?: { kid?: string; key?: string },
  ): string {
    return sign(defaultClaims(overrides), options?.key ?? privateKeyPem, {
      algorithm: 'RS256',
      keyid: options?.kid ?? KID,
      noTimestamp: true,
    });
  }

  function createJwksResponse(
    body: unknown,
    options?: {
      ok?: boolean;
      cacheControl?: string;
      json?: () => Promise<unknown>;
    },
  ): Response {
    return {
      ok: options?.ok ?? true,
      status: options?.ok === false ? 500 : 200,
      json: options?.json ?? (async () => body),
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'cache-control'
            ? (options?.cacheControl ?? null)
            : null,
      },
    } as unknown as Response;
  }
});
