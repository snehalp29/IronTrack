import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleTokenVerifierService } from './google-token-verifier.service';
import { GoogleStrategy } from './strategies/google.strategy';
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
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    GoogleTokenVerifierService,
  ],
  exports: [AuthService],
})
export class AuthModule {}

function parseDurationToSeconds(value: string): number {
  const pattern = /^(\d+)([smhd])$/;
  const match = pattern.exec(value.trim());
  if (!match) {
    return 15 * 60;
  }

  const amount = Number(match[1]);
  const unit = match[2];

  const unitMap: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return amount * (unitMap[unit] ?? 900);
}
