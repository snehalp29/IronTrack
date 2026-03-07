import { MODULE_METADATA } from '@nestjs/common/constants';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

import { AppModule } from './app.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ChecklistModule } from './modules/checklist/checklist.module';
import { ExercisesModule } from './modules/exercises/exercises.module';
import { HealthModule } from './modules/health/health.module';
import { MlClientModule } from './modules/ml-client/ml-client.module';
import { ProgressModule } from './modules/progress/progress.module';
import { StreakModule } from './modules/streak/streak.module';

describe('AppModule', () => {
  it('registers feature modules and global guards', () => {
    const imports =
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) ?? [];
    const providers =
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AppModule) ?? [];

    expect(imports).toContain(AuthModule);
    expect(imports).toContain(CatalogModule);
    expect(imports).toContain(ChecklistModule);
    expect(imports).toContain(ExercisesModule);
    expect(imports).toContain(ProgressModule);
    expect(imports).toContain(MlClientModule);
    expect(imports).toContain(HealthModule);
    expect(imports).toContain(StreakModule);

    expect(providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        }),
        expect.objectContaining({ provide: APP_GUARD, useClass: JwtAuthGuard }),
      ]),
    );
  });
});
