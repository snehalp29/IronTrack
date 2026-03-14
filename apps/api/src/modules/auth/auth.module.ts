import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleTokenVerifierService } from './google-token-verifier.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: parseDurationToSeconds(
            configService.getOrThrow<string>('JWT_ACCESS_EXPIRY'),
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleTokenVerifierService],
  exports: [AuthService],
})
export class AuthModule {}

function parseDurationToSeconds(value: string): number {
  const pattern = /^(\d+)([smhd])$/;
  const normalized = value.trim();
  const match = pattern.exec(normalized);
  if (!match) {
    throw new Error(`Invalid JWT_ACCESS_EXPIRY value: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2];

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid JWT_ACCESS_EXPIRY value: ${value}`);
  }

  const unitMap: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return amount * unitMap[unit];
}
