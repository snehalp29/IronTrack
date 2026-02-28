import { PrismaService } from '../prisma/prisma.service';

export async function createTestUser(
  prisma: PrismaService,
  overrides?: Partial<{ email: string; passwordHash: string; name: string }>,
) {
  return prisma.user.create({
    data: {
      email: overrides?.email ?? `test-${Date.now()}@example.com`,
      passwordHash: overrides?.passwordHash ?? 'hashed-password',
      name: overrides?.name ?? 'Test User',
    },
  });
}

export async function createTestSession(
  prisma: PrismaService,
  userId: string,
  overrides?: Partial<{ notes: string }>,
) {
  return prisma.workoutSession.create({
    data: {
      userId,
      notes: overrides?.notes ?? 'test session',
    },
  });
}

export async function cleanup(prisma: PrismaService, userIds: string[]) {
  await prisma.$transaction([
    prisma.set.deleteMany({
      where: { sessionExercise: { session: { userId: { in: userIds } } } },
    }),
    prisma.sessionExercise.deleteMany({
      where: { session: { userId: { in: userIds } } },
    }),
    prisma.workoutSession.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
}
