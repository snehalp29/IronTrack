import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, User } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { createHash } from 'node:crypto';

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
      throw new BadRequestException({
        code: 'EMAIL_TAKEN',
        message: 'Email already in use',
      });
    }

    const passwordHash = await hash(input.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name,
        timezone: input.timezone ?? 'UTC',
        unitPreference: input.unitPreference ?? 'METRIC',
      },
    });

    return this.issueTokens(user.id, user.email);
  }

  async login(input: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
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
    const refreshTokenHash = this.hashToken(input.refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash: refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired',
      });
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

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
        googleId: identity.googleId,
        name: identity.name,
        avatarUrl: identity.avatarUrl,
      },
    });

    return this.issueTokens(user.id, user.email);
  }

  private async issueTokens(
    userId: string,
    email: string,
  ): Promise<AuthTokens> {
    const payload = { sub: userId, email };
    const accessToken = await this.jwtService.signAsync(payload);

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn:
        this.parseDurationToMs(
          this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRY'),
        ) / 1000,
    });

    await this.persistRefreshToken(userId, refreshToken);

    return { accessToken, refreshToken };
  }

  private async persistRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = this.getRefreshTokenExpiry();

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

  private getRefreshTokenExpiry(): Date {
    const expiry = this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRY');
    return new Date(Date.now() + this.parseDurationToMs(expiry));
  }

  private parseDurationToMs(value: string): number {
    const pattern = /^(\d+)([smhd])$/;
    const match = pattern.exec(value.trim());
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    const amount = Number(match[1]);
    const unit = match[2];

    const unitMap: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };

    return amount * unitMap[unit];
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
