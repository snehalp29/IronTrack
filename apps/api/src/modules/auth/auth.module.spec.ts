import { MODULE_METADATA } from '@nestjs/common/constants';

import { AuthModule } from './auth.module';
import { GoogleStrategy } from './strategies/google.strategy';

describe('AuthModule', () => {
  it('does not register unused Google passport strategy provider', () => {
    const providers =
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AuthModule) ?? [];

    expect(providers).not.toContain(GoogleStrategy);
  });
});
