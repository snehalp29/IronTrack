import { registerSchema } from './auth.schemas';

describe('auth schemas', () => {
  it('normalizes optional register strings by trimming values', () => {
    expect(
      registerSchema.parse({
        email: 'athlete@example.com',
        password: 'password123',
        name: '  Athlete Name  ',
        timezone: '  America/New_York  ',
      }),
    ).toEqual({
      email: 'athlete@example.com',
      password: 'password123',
      name: 'Athlete Name',
      timezone: 'America/New_York',
    });
  });

  it('treats blank optional register strings as missing', () => {
    expect(
      registerSchema.parse({
        email: 'athlete@example.com',
        password: 'password123',
        name: '   ',
        timezone: '   ',
      }),
    ).toEqual({
      email: 'athlete@example.com',
      password: 'password123',
      name: undefined,
      timezone: undefined,
    });
  });
});
