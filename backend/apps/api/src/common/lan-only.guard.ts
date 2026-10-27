import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';

/** Loopback and private (office network) addresses, IPv4 and IPv6, including IPv4 written as IPv6. */
const PRIVATE = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^::1$/, /^f[cd][0-9a-f]{2}:/i, /^fe80:/i];

const bare = (ip: string) => ip.trim().replace(/^::ffff:/i, '').replace(/^\[|\]$/g, '');

/** Extra allowed addresses or prefixes from ICLOCK_ALLOWED_IPS (comma-separated), e.g. a site's public IP. */
const extra = () =>
  (process.env.ICLOCK_ALLOWED_IPS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** The caller's address: the connection's, or the first forwarded one when a local proxy or tunnel relayed it. */
export function clientAddress(req: { socket?: { remoteAddress?: string }; headers: Record<string, string | string[] | undefined> }) {
  const direct = bare(req.socket?.remoteAddress ?? '');
  const forwarded = [req.headers['cf-connecting-ip'], req.headers['x-forwarded-for']].flat().find((v): v is string => !!v);
  return /^(127\.|::1$)/.test(direct) && forwarded ? bare(forwarded.split(',')[0]) : direct || 'unknown';
}

export function isOfficeAddress(ip: string) {
  const a = bare(ip);
  return PRIVATE.some((r) => r.test(a)) || extra().some((p) => a === p || a.startsWith(p));
}

/**
 * Time clocks can't send a sign-in, so their endpoints only answer callers on the office network: the connection
 * and every address a proxy or tunnel says it forwarded for (X-Forwarded-For, CF-Connecting-IP, X-Real-IP) must be
 * private. A request relayed from the internet (e.g. through `pnpm share`) is refused.
 */
@Injectable()
export class LanOnlyGuard implements CanActivate {
  private readonly logger = new Logger('LanOnly');

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ socket?: { remoteAddress?: string }; headers: Record<string, string | string[] | undefined> }>();
    const header = (name: string) => [req.headers[name]].flat().filter((v): v is string => !!v).flatMap((v) => v.split(','));
    const addresses = [req.socket?.remoteAddress ?? '', ...header('x-forwarded-for'), ...header('cf-connecting-ip'), ...header('x-real-ip')].filter((a) => a.trim());
    const outside = addresses.find((a) => !isOfficeAddress(a));
    if (!addresses.length || outside) {
      this.logger.warn(`Refused a time-clock call from outside the office network (${outside ?? 'no address'})`);
      throw new ForbiddenException('Time clocks must connect from the office network');
    }
    return true;
  }
}
