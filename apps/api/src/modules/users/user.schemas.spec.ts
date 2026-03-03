import { updateMeSchema } from './user.schemas';

describe('user schemas', () => {
  it('validates update profile payload', () => {
    expect(
      updateMeSchema.parse({
        name: 'User Name',
        timezone: 'America/New_York',
        unitPreference: 'IMPERIAL',
        avatarUrl: 'https://example.com/avatar.png',
      }),
    ).toEqual({
      name: 'User Name',
      timezone: 'America/New_York',
      unitPreference: 'IMPERIAL',
      avatarUrl: 'https://example.com/avatar.png',
    });
  });

  it('rejects invalid enum and url values', () => {
    expect(() => updateMeSchema.parse({ unitPreference: 'UNKNOWN' })).toThrow();
    expect(() => updateMeSchema.parse({ avatarUrl: 'not-url' })).toThrow();
  });
});
