import type { LoginResponse, SessionUser, UpdatePreferences } from '@msma/shared';
import type { AuthUser } from '../common/auth.decorators';

/**
 * Authentication boundary. The sample uses email + password (bcrypt) with a JWT access token
 * (LocalAuthService). A Better Auth implementation can replace it by providing this class token.
 */
export abstract class AuthService {
  /** Verify credentials and issue an access token. Throws UnauthorizedException on failure. */
  abstract login(email: string, password: string): Promise<LoginResponse>;
  /** Resolve a bearer token to the caller. Throws UnauthorizedException if invalid/expired. */
  abstract verify(token: string): Promise<AuthUser>;
  /** A fresh access token for this account (after it changes its own password). */
  abstract tokenFor(userId: string): Promise<string>;
  /** Profile + preferences for the signed-in user. */
  abstract sessionUser(userId: string): Promise<SessionUser>;
  abstract updatePreferences(userId: string, prefs: UpdatePreferences): Promise<SessionUser>;
}
