import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { durationToSeconds } from '../../config/env.schema';
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
  RefreshRequestDto,
  RegisterDto,
} from './dto/auth.schemas';

const REFRESH_TOKEN_COOKIE_NAME = 'irontrack_refresh_token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.writeAuthResponse(
      response,
      await this.authService.register(body),
    );
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.writeAuthResponse(response, await this.authService.login(body));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = this.resolveRefreshToken(body, request);
    if (!refreshToken) {
      throw this.createInvalidRefreshTokenException();
    }

    return this.writeAuthResponse(
      response,
      await this.authService.refresh({ refreshToken }),
    );
  }

  @Public()
  @Post('google')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async google(
    @Body(new ZodValidationPipe(googleAuthSchema)) body: GoogleAuthDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.writeAuthResponse(
      response,
      await this.authService.googleLogin(body),
    );
  }

  @Post('logout')
  @HttpCode(200)
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async logout(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = this.resolveRefreshToken(body, request);
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    response.clearCookie(
      REFRESH_TOKEN_COOKIE_NAME,
      this.getRefreshCookieOptions(),
    );
    return { success: true };
  }

  private writeAuthResponse(
    response: Response,
    tokens: { accessToken: string; refreshToken: string },
  ) {
    response.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      tokens.refreshToken,
      this.getRefreshCookieOptions(),
    );

    return {
      accessToken: tokens.accessToken,
    };
  }

  private resolveRefreshToken(
    body: RefreshRequestDto,
    request: Request,
  ): string | undefined {
    return body.refreshToken ?? request.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
  }

  private getRefreshCookieOptions(): CookieOptions {
    const apiPrefix = this.configService.getOrThrow<string>('API_PREFIX');
    const refreshExpiry =
      this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRY');
    const nodeEnv = this.configService.getOrThrow<
      'development' | 'test' | 'production'
    >('NODE_ENV');

    return {
      httpOnly: true,
      maxAge: durationToSeconds(refreshExpiry) * 1000,
      path: buildAuthCookiePath(apiPrefix),
      sameSite: 'lax',
      secure: nodeEnv === 'production',
    };
  }

  private createInvalidRefreshTokenException() {
    return new UnauthorizedException({
      code: 'INVALID_REFRESH_TOKEN',
      message: 'Refresh token is invalid or expired',
    });
  }
}

function buildAuthCookiePath(apiPrefix: string): string {
  const normalizedPrefix = apiPrefix.trim().replace(/^\/+|\/+$/g, '');
  return normalizedPrefix.length > 0 ? `/${normalizedPrefix}/auth` : '/auth';
}
