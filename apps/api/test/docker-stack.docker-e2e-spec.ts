import { randomUUID } from 'node:crypto';
import request from 'supertest';

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:3000';

describe('Docker API stack (black-box e2e)', () => {
  const api = request(API_BASE_URL);

  it('serves the health endpoint from the running docker api', async () => {
    const response = await api.get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'ok',
      }),
    );
  });

  it('supports register, authorized me, and delete flows against the running docker api', async () => {
    const email = `docker-smoke-${randomUUID()}@irontrack.local`;
    const password = 'Str0ngPassword!';

    const registerResponse = await api.post('/api/v1/auth/register').send({
      email,
      password,
      name: 'Docker Smoke',
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.accessToken).toEqual(expect.any(String));

    const setCookieHeader = registerResponse.headers['set-cookie'];
    const refreshCookie = Array.isArray(setCookieHeader)
      ? setCookieHeader.find((value: string) =>
          value.startsWith('irontrack_refresh_token='),
        )
      : undefined;

    expect(refreshCookie).toBeTruthy();

    const meResponse = await api
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${registerResponse.body.accessToken}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body).toEqual(
      expect.objectContaining({
        email,
      }),
    );

    const deleteResponse = await api
      .delete('/api/v1/users/me')
      .set('Authorization', `Bearer ${registerResponse.body.accessToken}`);

    expect(deleteResponse.status).toBe(204);

    const refreshResponse = await api
      .post('/api/v1/auth/refresh')
      .set('Cookie', [refreshCookie ?? ''])
      .send({});

    expect(refreshResponse.status).toBe(401);
  });
});
