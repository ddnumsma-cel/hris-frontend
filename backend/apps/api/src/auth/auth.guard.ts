import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@msma/shared';
import { IS_PUBLIC, ROLES_KEY } from '../common/auth.decorators';
import { AuthService } from './auth.service';

/** Global guard: every endpoint needs a valid bearer token unless marked @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Please sign in');
    const user = await this.auth.verify(header.slice(7));
    request.user = user;
    // A temporary password (made or reset by someone else) opens nothing but the sign-in endpoints until it's replaced.
    const path: string = (request.path ?? request.url ?? '').split('?')[0];
    if (user.mustChangePassword && !path.startsWith('/auth/'))
      throw new ForbiddenException({ message: 'Choose your own password first.', code: 'PASSWORD_CHANGE_REQUIRED' });
    return true;
  }
}

/** Global guard: enforces @Roles(...) where present. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const user = context.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.role))
      throw new ForbiddenException('You do not have access to this page');
    return true;
  }
}
