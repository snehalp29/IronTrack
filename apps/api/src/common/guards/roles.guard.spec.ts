import type { ExecutionContext } from '@nestjs/common';

import { RolesGuard } from './roles.guard';

type RequestWithUser = {
  user?: {
    role?: unknown;
    roles?: unknown;
  };
};

type RolesMetadata = {
  controllerRoles?: string[];
  handlerRoles?: string[];
};

function createContext(
  request: RequestWithUser,
  metadata: RolesMetadata = {},
): ExecutionContext {
  class TestController {}
  function testHandler() {
    return;
  }

  if (metadata.controllerRoles !== undefined) {
    Reflect.defineMetadata('roles', metadata.controllerRoles, TestController);
  }

  if (metadata.handlerRoles !== undefined) {
    Reflect.defineMetadata('roles', metadata.handlerRoles, testHandler);
  }

  return {
    getClass: () => TestController,
    getHandler: () => testHandler,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows access when no roles are required', () => {
    const guard = new RolesGuard();

    expect(guard.canActivate(createContext({}))).toBe(true);
  });

  it('allows access when roles metadata is an empty list', () => {
    const guard = new RolesGuard();

    expect(guard.canActivate(createContext({}, { handlerRoles: [] }))).toBe(
      true,
    );
  });

  it('allows access when user has at least one required role', () => {
    const guard = new RolesGuard();

    expect(
      guard.canActivate(
        createContext(
          { user: { roles: ['member', 'admin'] } },
          { handlerRoles: ['admin'] },
        ),
      ),
    ).toBe(true);
  });

  it('denies access when required roles are missing', () => {
    const guard = new RolesGuard();

    expect(
      guard.canActivate(
        createContext(
          { user: { roles: ['member'] } },
          { handlerRoles: ['admin'] },
        ),
      ),
    ).toBe(false);
  });

  it('supports single role in request.user.role', () => {
    const guard = new RolesGuard();

    expect(
      guard.canActivate(
        createContext({ user: { role: 'coach' } }, { handlerRoles: ['coach'] }),
      ),
    ).toBe(true);
  });

  it('falls back to request.user.role when roles array is empty', () => {
    const guard = new RolesGuard();

    expect(
      guard.canActivate(
        createContext(
          { user: { role: 'coach', roles: [] } },
          { handlerRoles: ['coach'] },
        ),
      ),
    ).toBe(true);
  });

  it('denies access when user is not present', () => {
    const guard = new RolesGuard();

    expect(
      guard.canActivate(createContext({}, { handlerRoles: ['admin'] })),
    ).toBe(false);
  });

  it('denies access when user role shape is invalid', () => {
    const guard = new RolesGuard();

    expect(
      guard.canActivate(
        createContext(
          { user: { role: 42, roles: 'admin' } },
          { handlerRoles: ['admin'] },
        ),
      ),
    ).toBe(false);
  });

  it('falls back to class metadata when handler metadata is absent', () => {
    const guard = new RolesGuard();

    expect(
      guard.canActivate(
        createContext(
          { user: { roles: ['coach'] } },
          { controllerRoles: ['coach'] },
        ),
      ),
    ).toBe(true);
  });

  it('prioritizes handler metadata over class metadata', () => {
    const guard = new RolesGuard();

    expect(
      guard.canActivate(
        createContext(
          { user: { roles: ['coach'] } },
          { controllerRoles: ['admin'], handlerRoles: ['coach'] },
        ),
      ),
    ).toBe(true);
  });
});
