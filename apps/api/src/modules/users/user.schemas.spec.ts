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

  it('trims optional strings and treats blank values as missing', () => {
    expect(
      updateMeSchema.parse({
        name: '  User Name  ',
        timezone: '  America/New_York  ',
        avatarUrl: '   ',
      }),
    ).toEqual({
      name: 'User Name',
      timezone: 'America/New_York',
      avatarUrl: undefined,
    });
  });

  it('rejects invalid enum and url values', () => {
    expect(() => updateMeSchema.parse({ unitPreference: 'UNKNOWN' })).toThrow();
    expect(() => updateMeSchema.parse({ avatarUrl: 'not-url' })).toThrow();
  });

  it('rejects avatar urls with non-http protocols', () => {
    expect(() =>
      updateMeSchema.parse({ avatarUrl: 'javascript:alert(1)' }),
    ).toThrow();
    expect(() =>
      updateMeSchema.parse({ avatarUrl: 'data:text/html;base64,PHNjcmlwdA==' }),
    ).toThrow();
  });

  it('rejects invalid timezone values at the schema boundary', () => {
    expect(() => updateMeSchema.parse({ timezone: 'Mars/Olympus' })).toThrow(
      /Invalid timezone/,
    );
  });
});
