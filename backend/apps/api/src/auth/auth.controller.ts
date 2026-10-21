import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
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
  async login(@Body(new ZodPipe(LoginRequestSchema)) body: LoginRequest) {
    this.throttle.begin(body.email); // counted before the password check (parallel guesses count too)
    const result = await this.auth.login(body.email, body.password);
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
