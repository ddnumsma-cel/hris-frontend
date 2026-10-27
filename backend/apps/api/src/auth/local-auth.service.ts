import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { dateKeyToUtcDate, manilaToday, type LoginResponse, type Role, type SessionUser, type UpdatePreferences } from '@msma/shared';
import bcrypt from 'bcryptjs';
import type { AuthUser } from '../common/auth.decorators';
import { config } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  employeeId: string | null;
  name: string;
  /** Issued at (seconds), set by the signer. */
  iat?: number;
}

// Unknown emails still pay the bcrypt cost, so response time doesn't reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);
const LEFT = 'This account is closed because the employee has left the company. Ask HR if this is a mistake.';

/** Someone whose last day has passed (or whose record is inactive) can no longer sign in. */
function hasLeft(e: { active: boolean; separationDate: Date | null } | null) {
  if (!e) return false;
  return !e.active || (!!e.separationDate && e.separationDate < dateKeyToUtcDate(manilaToday()));
}

@Injectable()
export class LocalAuthService extends AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {
    super();
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({ where: { email }, include: { employee: { select: { active: true, separationDate: true } } } });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException('Incorrect email or password');
    if (user.status !== 'active') throw new UnauthorizedException('This account is turned off. Ask your administrator to turn it back on.');
    if (hasLeft(user.employee)) throw new UnauthorizedException(LEFT);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return {
      accessToken: await this.tokenFor(user.id),
      tokenType: 'Bearer',
      expiresIn: config.jwtExpiresIn,
      user: await this.sessionUser(user.id),
    };
  }

  async tokenFor(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role, employeeId: user.employeeId, name: user.displayName };
    return this.jwt.signAsync(payload);
  }

  async verify(token: string): Promise<AuthUser> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }
    // Re-read the account so removed users lose access and role changes apply immediately.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        employeeId: true,
        displayName: true,
        status: true,
        mustChangePassword: true,
        passwordChangedAt: true,
        employee: { select: { active: true, separationDate: true } },
      },
    });
    // A turned-off account loses access at its next request, not when its token runs out.
    if (!user || user.status !== 'active') throw new UnauthorizedException('Session expired. Please sign in again.');
    // A password change or reset ends every session started before it.
    if (user.passwordChangedAt && (payload.iat ?? 0) < Math.floor(user.passwordChangedAt.getTime() / 1000))
      throw new UnauthorizedException('Your password was changed. Please sign in again.');
    if (hasLeft(user.employee)) throw new UnauthorizedException(LEFT);
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      displayName: user.displayName,
      mustChangePassword: user.mustChangePassword,
    };
  }

  async sessionUser(userId: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employee: { include: { site: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      employeeId: user.employeeId,
      employeeNo: user.employee?.employeeNo ?? null,
      site: user.employee ? { id: user.employee.site.id, name: user.employee.site.name } : null,
      preferences: { theme: user.theme, textSize: user.textSize, tableDensity: user.tableDensity },
      mustChangePassword: user.mustChangePassword,
    };
  }

  async updatePreferences(userId: string, prefs: UpdatePreferences): Promise<SessionUser> {
    await this.prisma.user.update({ where: { id: userId }, data: prefs });
    return this.sessionUser(userId);
  }
}
