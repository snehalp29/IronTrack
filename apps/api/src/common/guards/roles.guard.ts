import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

type RequestUser = {
  role?: unknown;
  roles?: unknown;
};

const ROLES_METADATA_KEY = 'roles';

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.getRequiredRoles(context);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const userRoles = this.extractUserRoles(request.user);

    if (userRoles.length === 0) {
      return false;
    }

    return requiredRoles.some((role) => userRoles.includes(role));
  }

  private extractUserRoles(user?: RequestUser): string[] {
    if (!user) {
      return [];
    }

    const roles: string[] = [];

    if (Array.isArray(user.roles)) {
      roles.push(
        ...user.roles.filter(
          (role): role is string => typeof role === 'string',
        ),
      );
    }

    if (typeof user.role === 'string') {
      roles.push(user.role);
    }

    return [...new Set(roles)];
  }

  private getRequiredRoles(context: ExecutionContext): string[] | undefined {
    const handlerRoles = Reflect.getMetadata(
      ROLES_METADATA_KEY,
      context.getHandler(),
    ) as string[] | undefined;

    if (handlerRoles !== undefined) {
      return handlerRoles;
    }

    return Reflect.getMetadata(ROLES_METADATA_KEY, context.getClass()) as
      | string[]
      | undefined;
  }
}
