import { MODULE_METADATA } from '@nestjs/common/constants';

import { StreakService } from '../services/streak.service';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogModule } from './catalog/catalog.module';
import { CatalogService } from './catalog/catalog.service';
import { ChecklistController } from './checklist/checklist.controller';
import { ChecklistModule } from './checklist/checklist.module';
import { ChecklistService } from './checklist/checklist.service';
import { ExercisesController } from './exercises/exercises.controller';
import { ExercisesModule } from './exercises/exercises.module';
import { ExercisesService } from './exercises/exercises.service';
import { HealthController } from './health/health.controller';
import { HealthModule } from './health/health.module';
import { MlClientModule } from './ml-client/ml-client.module';
import { MlClientService } from './ml-client/ml-client.service';
import { ProgressController } from './progress/progress.controller';
import { ProgressModule } from './progress/progress.module';
import { ProgressService } from './progress/progress.service';
import { SessionSetsController } from './sessions/session-sets.controller';
import { SessionsController } from './sessions/sessions.controller';
import { SessionsModule } from './sessions/sessions.module';
import { SessionsService } from './sessions/sessions.service';
import { StreakController } from './streak/streak.controller';
import { StreakModule } from './streak/streak.module';
import { UsersController } from './users/users.controller';
import { UsersModule } from './users/users.module';
import { UsersService } from './users/users.service';
import { WorkoutTemplatesController } from './workout-templates/workout-templates.controller';
import { WorkoutTemplatesModule } from './workout-templates/workout-templates.module';
import { WorkoutTemplatesService } from './workout-templates/workout-templates.service';

describe('Feature module metadata', () => {
  it('configures catalog module', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, CatalogModule),
    ).toEqual([CatalogController]);
    expect(
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, CatalogModule),
    ).toEqual([CatalogService]);
  });

  it('configures checklist module', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ChecklistModule),
    ).toEqual([ChecklistController]);
    expect(
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, ChecklistModule),
    ).toContain(StreakModule);
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      ChecklistModule,
    );
    expect(providers).toContain(ChecklistService);
    expect(providers).not.toContain(StreakService);
  });

  it('configures exercises module', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ExercisesModule),
    ).toEqual([ExercisesController]);
    expect(
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ExercisesModule),
    ).toEqual([ExercisesService]);
  });

  it('configures health module', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, HealthModule),
    ).toEqual([HealthController]);
  });

  it('configures ml-client module', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, MlClientModule),
    ).toEqual([MlClientService]);
  });

  it('configures progress module', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ProgressModule),
    ).toEqual([ProgressController]);
    expect(
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ProgressModule),
    ).toEqual([ProgressService]);
  });

  it('configures sessions module', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, SessionsModule),
    ).toEqual([SessionsController, SessionSetsController]);
    expect(
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, SessionsModule),
    ).toContain(StreakModule);
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      SessionsModule,
    );
    expect(providers).toContain(SessionsService);
    expect(providers).not.toContain(StreakService);
  });

  it('configures users module', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, UsersModule),
    ).toEqual([UsersController]);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, UsersModule)).toEqual(
      [UsersService],
    );
  });

  it('configures workout templates module', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, WorkoutTemplatesModule),
    ).toEqual([WorkoutTemplatesController]);
    expect(
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, WorkoutTemplatesModule),
    ).toEqual([WorkoutTemplatesService]);
  });

  it('configures streak module', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, StreakModule),
    ).toEqual([StreakController]);
    expect(
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, StreakModule),
    ).toEqual([StreakService]);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, StreakModule)).toEqual([
      StreakService,
    ]);
  });
});
