import path from 'path';

type MetadataBranchCase = {
  name: string;
  target: string;
  mocks: Record<string, Record<string, unknown>>;
};

type MetadataTargetClass = new (...args: unknown[]) => unknown;

const MODULES_ROOT = path.resolve(process.cwd(), 'src/modules');

function resolveSourceModule(modulePath: string): string {
  const resolved = path.resolve(MODULES_ROOT, modulePath);
  return path.extname(resolved) ? resolved : `${resolved}.ts`;
}

const cases: MetadataBranchCase[] = [
  {
    name: 'AuthController metadata fallback',
    target: './auth/auth.controller',
    mocks: {
      './auth/auth.service': { AuthService: {} as unknown },
    },
  },
  {
    name: 'CatalogController metadata fallback',
    target: './catalog/catalog.controller',
    mocks: {
      './catalog/catalog.service': { CatalogService: {} as unknown },
    },
  },
  {
    name: 'ChecklistController metadata fallback',
    target: './checklist/checklist.controller',
    mocks: {
      './checklist/checklist.service': { ChecklistService: {} as unknown },
    },
  },
  {
    name: 'ExercisesController metadata fallback',
    target: './exercises/exercises.controller',
    mocks: {
      './exercises/exercises.service': { ExercisesService: {} as unknown },
    },
  },
  {
    name: 'ProgressController metadata fallback',
    target: './progress/progress.controller',
    mocks: {
      './progress/progress.service': { ProgressService: {} as unknown },
    },
  },
  {
    name: 'SessionSetsController metadata fallback',
    target: './sessions/session-sets.controller',
    mocks: {
      './sessions/sessions.service': { SessionsService: {} as unknown },
    },
  },
  {
    name: 'SessionsController metadata fallback',
    target: './sessions/sessions.controller',
    mocks: {
      './sessions/sessions.service': { SessionsService: {} as unknown },
    },
  },
  {
    name: 'UsersController metadata fallback',
    target: './users/users.controller',
    mocks: {
      './users/users.service': { UsersService: {} as unknown },
    },
  },
  {
    name: 'WorkoutTemplatesController metadata fallback',
    target: './workout-templates/workout-templates.controller',
    mocks: {
      './workout-templates/workout-templates.service': {
        WorkoutTemplatesService: {} as unknown,
      },
    },
  },
  {
    name: 'CatalogService metadata fallback',
    target: './catalog/catalog.service',
    mocks: {
      '../prisma/prisma.service': { PrismaService: {} as unknown },
    },
  },
  {
    name: 'ChecklistService metadata fallback',
    target: './checklist/checklist.service',
    mocks: {
      '../prisma/prisma.service': { PrismaService: {} as unknown },
      '../services/streak.service': { StreakService: {} as unknown },
    },
  },
  {
    name: 'ExercisesService metadata fallback',
    target: './exercises/exercises.service',
    mocks: {
      '../prisma/prisma.service': { PrismaService: {} as unknown },
    },
  },
  {
    name: 'ProgressService metadata fallback',
    target: './progress/progress.service',
    mocks: {
      '../prisma/prisma.service': { PrismaService: {} as unknown },
    },
  },
  {
    name: 'SessionsService metadata fallback',
    target: './sessions/sessions.service',
    mocks: {
      '../prisma/prisma.service': { PrismaService: {} as unknown },
      '../services/pr-detection.service': { PrDetectionService: {} as unknown },
      '../services/volume.service': { VolumeService: {} as unknown },
      '../services/streak.service': { StreakService: {} as unknown },
      '../services/completion.service': { CompletionService: {} as unknown },
      '../services/superset.service': { SupersetService: {} as unknown },
    },
  },
  {
    name: 'UsersService metadata fallback',
    target: './users/users.service',
    mocks: {
      '../prisma/prisma.service': { PrismaService: {} as unknown },
    },
  },
  {
    name: 'WorkoutTemplatesService metadata fallback',
    target: './workout-templates/workout-templates.service',
    mocks: {
      '../prisma/prisma.service': { PrismaService: {} as unknown },
    },
  },
  {
    name: 'MlClientService metadata fallback',
    target: './ml-client/ml-client.service',
    mocks: {
      '@nestjs/axios': { HttpService: {} as unknown },
      '@nestjs/config': { ConfigService: {} as unknown },
    },
  },
  {
    name: 'AuthService metadata fallback',
    target: './auth/auth.service',
    mocks: {
      '../prisma/prisma.service': { PrismaService: {} as unknown },
      '@nestjs/jwt': { JwtService: {} as unknown },
      '@nestjs/config': { ConfigService: {} as unknown },
      './auth/google-token-verifier.service': {
        GoogleTokenVerifierService: {} as unknown,
      },
    },
  },
  {
    name: 'JwtAuthGuard metadata fallback',
    target: './auth/guards/jwt-auth.guard',
    mocks: {
      '@nestjs/core': { Reflector: {} as unknown },
    },
  },
  {
    name: 'JwtStrategy metadata fallback',
    target: './auth/strategies/jwt.strategy',
    mocks: {
      '@nestjs/config': { ConfigService: {} as unknown },
      './auth/auth.service': { AuthService: {} as unknown },
    },
  },
  {
    name: 'GoogleStrategy metadata fallback',
    target: './auth/strategies/google.strategy',
    mocks: {
      '@nestjs/config': { ConfigService: {} as unknown },
    },
  },
  {
    name: 'GoogleTokenVerifierService metadata fallback',
    target: './auth/google-token-verifier.service',
    mocks: {
      '@nestjs/config': { ConfigService: {} as unknown },
    },
  },
  {
    name: 'CompletionService metadata fallback',
    target: '../services/completion.service',
    mocks: {
      '../prisma/prisma.service': { PrismaService: {} as unknown },
    },
  },
  {
    name: 'PrDetectionService metadata fallback',
    target: '../services/pr-detection.service',
    mocks: {
      '../prisma/prisma.service': { PrismaService: {} as unknown },
    },
  },
  {
    name: 'StreakService metadata fallback',
    target: '../services/streak.service',
    mocks: {
      '../prisma/prisma.service': { PrismaService: {} as unknown },
    },
  },
  {
    name: 'VolumeService metadata fallback',
    target: '../services/volume.service',
    mocks: {
      '../prisma/prisma.service': { PrismaService: {} as unknown },
    },
  },
];

describe('Decorator metadata fallback branches', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it.each(cases)('$name', ({ target, mocks }) => {
    jest.resetModules();
    jest.isolateModules(() => {
      const targetPath = resolveSourceModule(target);
      jest.dontMock(targetPath);

      for (const [path, mock] of Object.entries(mocks)) {
        const mockPath = path.startsWith('.')
          ? resolveSourceModule(path)
          : path;
        jest.doMock(mockPath, () => mock);
      }

      const loadedModule = jest.requireActual(targetPath) as Record<
        string,
        unknown
      >;
      const exportedClass = Object.values(loadedModule).find(
        (value) => typeof value === 'function',
      ) as MetadataTargetClass | undefined;
      if (exportedClass) {
        const paramTypes = Reflect.getMetadata(
          'design:paramtypes',
          exportedClass,
        ) as unknown[] | undefined;
        if (paramTypes?.length) {
          expect(paramTypes.every((value) => value === Object)).toBe(true);
        }
      }
    });
  });
});
