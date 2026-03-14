import type { ExecutionContext } from '@nestjs/common';

import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const reflectorMock = {
    getAllAndOverride: jest.fn(),
  };

  const guard = new JwtAuthGuard(reflectorMock as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows public routes without delegating to passport guard', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(true);

    const superCanActivate = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue(false);

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
    expect(superCanActivate).not.toHaveBeenCalled();
  });

  it('delegates to passport guard for protected routes', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(false);

    const superCanActivate = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue('delegated' as never);

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe('delegated');
    expect(superCanActivate).toHaveBeenCalledWith(context);
  });
});
