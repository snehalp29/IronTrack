import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';

export async function createTestUser(
  prisma: PrismaService,
  overrides?: Partial<{ email: string; passwordHash: string; name: string }>,
) {
  return prisma.user.create({
    data: {
      email:
        overrides?.email ?? `test-${Date.now()}-${randomUUID()}@example.com`,
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
    prisma.workoutTemplateExercise.deleteMany({
      where: { template: { userId: { in: userIds } } },
    }),
    prisma.workoutTemplate.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.exerciseVideo.deleteMany({
      where: { exercise: { ownerUserId: { in: userIds } } },
    }),
    prisma.exerciseTemplateEquipment.deleteMany({
      where: { exercise: { ownerUserId: { in: userIds } } },
    }),
    prisma.exerciseTemplateSecondaryMuscle.deleteMany({
      where: { exercise: { ownerUserId: { in: userIds } } },
    }),
    prisma.exerciseTemplate.deleteMany({
      where: { ownerUserId: { in: userIds } },
    }),
    prisma.set.deleteMany({
      where: { sessionExercise: { session: { userId: { in: userIds } } } },
    }),
    prisma.sessionExercise.deleteMany({
      where: { session: { userId: { in: userIds } } },
    }),
    prisma.workoutSession.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.exerciseNote.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.sessionNote.deleteMany({
      where: { session: { userId: { in: userIds } } },
    }),
    prisma.pRRecord.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.userStreak.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.checklistItem.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
}
