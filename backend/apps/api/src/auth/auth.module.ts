import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AdministrationModule } from '../administration/administration.module';
import { config } from '../config';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AuthController } from './auth.controller';
import { AuthGuard, RolesGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { LocalAuthService } from './local-auth.service';
import { LoginThrottle } from './login-throttle';

@Module({
  imports: [
    AdministrationModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: config.jwtSecret,
        signOptions: { expiresIn: config.jwtExpiresIn as never },
      }),
    }),
  ],
  controllers: [AuthController, AccountsController],
  providers: [
    // Swap this line to plug in another AuthService implementation (e.g. Better Auth).
    { provide: AuthService, useClass: LocalAuthService },
    LoginThrottle,
    AccountsService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
