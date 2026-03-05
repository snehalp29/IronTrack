import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, User } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { createHash, randomUUID } from 'node:crypto';

import { durationToSeconds } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GoogleAuthDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
} from './dto/auth.schemas';
import { GoogleTokenVerifierService } from './google-token-verifier.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly googleTokenVerifierService: GoogleTokenVerifierService,
  ) {}

  async register(input: RegisterDto): Promise<AuthTokens> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existingUser) {
      this.throwEmailTaken();
    }

    const passwordHash = await hash(input.password, 12);
    let user: {
      id: string;
      email: string;
    };
    try {
      user = await this.prisma.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash,
          name: input.name,
          timezone: input.timezone ?? 'UTC',
          unitPreference: input.unitPreference ?? 'METRIC',
        },
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        this.throwEmailTaken();
      }
      throw error;
    }

    return this.issueTokens(user.id, user.email);
  }

  async login(input: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findFirst({
      where: {
        email: input.email.toLowerCase(),
        deletedAt: null,
      },
    });

    if (!user || user.authProvider !== AuthProvider.LOCAL) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    const passwordMatches = await compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    return this.issueTokens(user.id, user.email);
  }

  async refresh(input: RefreshDto): Promise<AuthTokens> {
    const now = new Date();
    const refreshTokenHash = this.hashToken(input.refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash: refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired',
      });
    }

    const consumeResult = await this.prisma.refreshToken.updateMany({
      where: {
        id: stored.id,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { revokedAt: now },
    });

    if (consumeResult.count !== 1) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired',
      });
    }

    if (!stored.user || stored.user.deletedAt !== null) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired',
      });
    }

    return this.issueTokens(stored.user.id, stored.user.email);
  }

  async logout(refreshToken: string): Promise<{ success: boolean }> {
    const refreshTokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: refreshTokenHash,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  async googleLogin(input: GoogleAuthDto): Promise<AuthTokens> {
    if (!input.idToken) {
      throw new BadRequestException({
        code: 'GOOGLE_TOKEN_REQUIRED',
        message: 'idToken is required',
      });
    }

    const identity = await this.googleTokenVerifierService.verifyIdToken(
      input.idToken,
    );

    const existingUser = await this.prisma.user.findFirst({
      where: { email: identity.email },
    });
    if (existingUser?.deletedAt) {
      throw new UnauthorizedException({
        code: 'USER_DISABLED',
        message: 'User account is disabled',
      });
    }

    const user = await this.prisma.user.upsert({
      where: { email: identity.email },
      update: {
        authProvider: AuthProvider.GOOGLE,
        googleId: identity.googleId,
        name: identity.name,
        avatarUrl: identity.avatarUrl,
      },
      create: {
        email: identity.email,
        passwordHash: await hash(identity.googleId, 10),
        authProvider: AuthProvider.GOOGLE,
        timezone: 'UTC',
        googleId: identity.googleId,
        name: identity.name,
        avatarUrl: identity.avatarUrl,
      },
    });

    if (user.deletedAt !== null) {
      throw new UnauthorizedException({
        code: 'USER_DISABLED',
        message: 'User account is disabled',
      });
    }

    return this.issueTokens(user.id, user.email);
  }

  private async issueTokens(
    userId: string,
    email: string,
  ): Promise<AuthTokens> {
    const payload = { sub: userId, email };
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshExpiryMs = this.parseDurationToMs(
      this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRY'),
    );
    const refreshPayload = {
      ...payload,
      jti: randomUUID(),
    };

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiryMs / 1000,
    });

    await this.persistRefreshToken(userId, refreshToken, refreshExpiryMs);

    return { accessToken, refreshToken };
  }

  private async persistRefreshToken(
    userId: string,
    refreshToken: string,
    refreshExpiryMs: number,
  ): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + refreshExpiryMs);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private throwEmailTaken(): never {
    throw new BadRequestException({
      code: 'EMAIL_TAKEN',
      message: 'Email already in use',
    });
  }

  private parseDurationToMs(value: string): number {
    const normalized = value.trim();
    const durationSeconds = durationToSeconds(normalized);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new Error(`Invalid JWT_REFRESH_EXPIRY value: ${value}`);
    }

    return durationSeconds * 1000;
  }

  async validateUserFromPayload(payload: {
    sub: string;
    email: string;
  }): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        deletedAt: null,
      },
    });
    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User no longer exists',
      });
    }
    return user;
  }
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
