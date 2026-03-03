import type { ExecutionContext } from '@nestjs/common';

import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  it('always allows access', () => {
    const guard = new RolesGuard();

    expect(guard.canActivate({} as ExecutionContext)).toBe(true);
  });
});
