import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { LoginResponse, Role, SessionUser, UpdatePreferences } from '@msma/shared';
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
}

// Unknown emails still pay the bcrypt cost, so response time doesn't reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

@Injectable()
export class LocalAuthService extends AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {
    super();
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException('Incorrect email or password');
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      name: user.displayName,
    };
    return {
      accessToken: await this.jwt.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: config.jwtExpiresIn,
      user: await this.sessionUser(user.id),
    };
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
      select: { id: true, email: true, role: true, employeeId: true, displayName: true },
    });
    if (!user) throw new UnauthorizedException('Session expired. Please sign in again.');
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      displayName: user.displayName,
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
    };
  }

  async updatePreferences(userId: string, prefs: UpdatePreferences): Promise<SessionUser> {
    await this.prisma.user.update({ where: { id: userId }, data: prefs });
    return this.sessionUser(userId);
  }
}
