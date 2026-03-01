import { PrismaPg } from '@prisma/adapter-pg';
import { ChecklistType, PrismaClient, UnitPreference } from '@prisma/client';
import { hash } from 'bcryptjs';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function resolveDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const envCandidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
  ];

  for (const envPath of envCandidates) {
    if (!existsSync(envPath)) {
      continue;
    }

    const contents = readFileSync(envPath, 'utf8');
    const line = contents
      .split(/\r?\n/)
      .find((entry) => entry.startsWith('DATABASE_URL='));

    if (!line) {
      continue;
    }

    const value = line.slice('DATABASE_URL='.length).trim();
    if (!value) {
      continue;
    }

    return value.replace(/^['"]|['"]$/g, '');
  }

  return undefined;
}

const connectionString = resolveDatabaseUrl();
if (!connectionString) {
  throw new Error('DATABASE_URL is required to run demo seed script.');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const DEMO_EMAIL = 'demo@irontrack.local';
const DEMO_PASSWORD = 'DemoPass123!';
const DEMO_NAME = 'IronTrack Demo User';
const DEMO_TAG = '[IRONTRACK_DEMO]';
const DEMO_TEMPLATE_NAME = 'Demo Full Body Workout';

const preferredExerciseNames = [
  'Barbell Bench Press',
  'Barbell Row',
  'Barbell Back Squat',
];

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

async function main() {
  console.log('🌱 Seeding demo test data...\n');

  const availableExercises = await prisma.exerciseTemplate.findMany({
    where: {
      isGlobal: true,
      deletedAt: null,
      name: { in: preferredExerciseNames },
    },
    select: { id: true, name: true },
  });

  const selectedExercises =
    availableExercises.length >= 3
      ? availableExercises
      : await prisma.exerciseTemplate.findMany({
          where: { isGlobal: true, deletedAt: null },
          orderBy: { name: 'asc' },
          take: 3,
          select: { id: true, name: true },
        });

  if (selectedExercises.length < 3) {
    throw new Error(
      'Not enough global exercises found. Run `pnpm db:seed` before `pnpm db:seed:demo`.',
    );
  }

  const passwordHash = await hash(DEMO_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {
      name: DEMO_NAME,
      passwordHash,
      timezone: 'America/New_York',
      unitPreference: UnitPreference.IMPERIAL,
    },
    create: {
      email: DEMO_EMAIL,
      passwordHash,
      name: DEMO_NAME,
      timezone: 'America/New_York',
      unitPreference: UnitPreference.IMPERIAL,
    },
  });
  console.log(`  ✅ Demo user ready: ${DEMO_EMAIL}`);

  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

  const existingTemplate = await prisma.workoutTemplate.findFirst({
    where: {
      userId: user.id,
      name: DEMO_TEMPLATE_NAME,
      deletedAt: null,
    },
    select: { id: true },
  });

  const template = existingTemplate
    ? await prisma.workoutTemplate.update({
        where: { id: existingTemplate.id },
        data: { description: `${DEMO_TAG} Seeded demo workout template` },
      })
    : await prisma.workoutTemplate.create({
        data: {
          userId: user.id,
          name: DEMO_TEMPLATE_NAME,
          description: `${DEMO_TAG} Seeded demo workout template`,
          orderIndex: 0,
        },
      });

  await prisma.workoutTemplateExercise.deleteMany({
    where: { workoutTemplateId: template.id },
  });

  for (const [index, exercise] of selectedExercises.entries()) {
    await prisma.workoutTemplateExercise.create({
      data: {
        workoutTemplateId: template.id,
        exerciseTemplateId: exercise.id,
        orderIndex: index,
        defaultSets: 3,
        repMin: 6,
        repMax: 10,
      },
    });
  }
  console.log(`  ✅ Template ready with ${selectedExercises.length} exercises`);

  await prisma.workoutSession.deleteMany({
    where: { userId: user.id, notes: { contains: DEMO_TAG } },
  });

  const startedAt = new Date(Date.now() - 45 * 60 * 1000);
  const finishedAt = new Date(Date.now() - 5 * 60 * 1000);
  const session = await prisma.workoutSession.create({
    data: {
      userId: user.id,
      workoutTemplateId: template.id,
      notes: `${DEMO_TAG} Seeded finished workout session`,
      status: 'FINISHED',
      endedReason: 'USER_ENDED',
      startedAt,
      finishedAt,
      durationSeconds: Math.max(
        1,
        Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000),
      ),
      sessionExercises: {
        create: selectedExercises.map((exercise, index) => ({
          exerciseTemplateId: exercise.id,
          orderIndex: index,
          notes: `${DEMO_TAG} ${exercise.name}`,
          sets: {
            create: [0, 1, 2].map((setIndex) => ({
              orderIndex: setIndex,
              type: 'WEIGHT_REPS',
              payload: {
                weight: 95 + index * 20 + setIndex * 5,
                reps: 10 - setIndex,
              },
              isCompleted: true,
              completedAt: new Date(Date.now() - (10 - setIndex) * 60_000),
              weight: 95 + index * 20 + setIndex * 5,
              reps: 10 - setIndex,
              rpe: 7 + setIndex * 0.5,
              idempotencyKey: `${DEMO_TAG}-set-${index}-${setIndex}`,
            })),
          },
        })),
      },
    },
  });

  const today = startOfUtcDay(new Date());
  await prisma.checklistItem.deleteMany({
    where: { userId: user.id, date: today },
  });

  await prisma.checklistItem.createMany({
    data: [
      {
        userId: user.id,
        date: today,
        type: ChecklistType.WORKOUT,
        isCompleted: true,
        completedAt: new Date(),
      },
      {
        userId: user.id,
        date: today,
        type: ChecklistType.WARMUP,
        isCompleted: true,
        completedAt: new Date(),
      },
      {
        userId: user.id,
        date: today,
        type: ChecklistType.MOBILITY,
        isCompleted: false,
      },
      {
        userId: user.id,
        date: today,
        type: ChecklistType.NOTES,
        isCompleted: true,
        completedAt: new Date(),
      },
    ],
  });
  console.log('  ✅ Checklist items seeded for today');

  console.log('\n🎉 Demo seed complete');
  console.log(`   user email: ${DEMO_EMAIL}`);
  console.log(`   password:   ${DEMO_PASSWORD}`);
  console.log(`   templateId: ${template.id}`);
  console.log(`   sessionId:  ${session.id}`);
}

main()
  .catch((error) => {
    console.error('❌ Demo seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
