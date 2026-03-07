import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { validateEnv } from './config/env.schema';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ChecklistModule } from './modules/checklist/checklist.module';
import { ExercisesModule } from './modules/exercises/exercises.module';
import { HealthModule } from './modules/health/health.module';
import { MlClientModule } from './modules/ml-client/ml-client.module';
import { ProgressModule } from './modules/progress/progress.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { StreakModule } from './modules/streak/streak.module';
import { UsersModule } from './modules/users/users.module';
import { WorkoutTemplatesModule } from './modules/workout-templates/workout-templates.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ExercisesModule,
    WorkoutTemplatesModule,
    SessionsModule,
    ChecklistModule,
    CatalogModule,
    ProgressModule,
    StreakModule,
    MlClientModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
