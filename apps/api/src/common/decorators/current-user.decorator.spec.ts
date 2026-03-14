import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

import { CurrentUser } from './current-user.decorator';

describe('CurrentUser decorator', () => {
  it('returns request.user from HTTP context', () => {
    class TestController {
      test(@CurrentUser() _user: unknown) {}
    }

    const metadata =
      Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'test') ?? {};
    const entry = Object.values(metadata)[0] as
      | { factory?: (data: unknown, ctx: unknown) => unknown }
      | undefined;

    const requestUser = { sub: 'user-1', email: 'user@example.com' };
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: requestUser }),
      }),
    };

    expect(entry?.factory?.(undefined, context)).toEqual(requestUser);
  });
});
