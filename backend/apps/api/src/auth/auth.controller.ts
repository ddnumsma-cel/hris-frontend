import { Body, Controller, Get, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  LoginRequest,
  LoginRequestSchema,
  LoginResponseSchema,
  SessionUserSchema,
} from '@msma/shared';
import { AuthUser, CurrentUser, Public } from '../common/auth.decorators';
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/zod';
import { AuthService } from './auth.service';
import { LoginThrottle } from './login-throttle';
import { clientAddress } from '../common/lan-only.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly throttle: LoginThrottle,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'login',
    summary: 'Sign in with email and password; returns a JWT access token',
  })
  @ApiZodBody(LoginRequestSchema)
  @ApiZodResponse(LoginResponseSchema)
  @ApiResponse({ status: 429, description: 'Too many wrong passwords for this account' })
  async login(@Body(new ZodPipe(LoginRequestSchema)) body: LoginRequest, @Req() req: Request) {
    const ip = clientAddress(req);
    this.throttle.checkAddress(ip);
    this.throttle.begin(body.email); // counted before the password check (parallel guesses count too)
    let result;
    try {
      result = await this.auth.login(body.email, body.password);
    } catch (e) {
      if (e instanceof UnauthorizedException) this.throttle.failedFrom(ip);
      throw e;
    }
    this.throttle.succeeded(body.email);
    return result;
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'getSession', summary: 'The signed-in user' })
  @ApiZodResponse(SessionUserSchema)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.sessionUser(user.userId);
  }
}
