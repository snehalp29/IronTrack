import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import {
  googleAuthSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
} from './dto/auth.schemas';
import type {
  GoogleAuthDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
} from './dto/auth.schemas';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterDto,
  ) {
    return this.authService.register(body);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async login(@Body(new ZodValidationPipe(loginSchema)) body: LoginDto) {
    return this.authService.login(body);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async refresh(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshDto) {
    return this.authService.refresh(body);
  }

  @Public()
  @Post('google')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async google(
    @Body(new ZodValidationPipe(googleAuthSchema)) body: GoogleAuthDto,
  ) {
    return this.authService.googleLogin(body);
  }

  @Post('logout')
  @HttpCode(200)
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async logout(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshDto) {
    return this.authService.logout(body.refreshToken);
  }
}
