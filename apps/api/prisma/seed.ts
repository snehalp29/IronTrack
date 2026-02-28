// ─────────────────────────────────────────────────────────────
// IronTrack — Prisma Seed Script
// Seeds: 14 muscle groups, 13 equipment, 50+ global exercises
// ─────────────────────────────────────────────────────────────
import { ExerciseType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Muscle Groups ──────────────────────────────────────────

const muscleGroups = [
  { name: 'Chest', sortOrder: 1 },
  { name: 'Upper Back', sortOrder: 2 },
  { name: 'Lats', sortOrder: 3 },
  { name: 'Shoulders', sortOrder: 4 },
  { name: 'Biceps', sortOrder: 5 },
  { name: 'Triceps', sortOrder: 6 },
  { name: 'Forearms', sortOrder: 7 },
  { name: 'Quadriceps', sortOrder: 8 },
  { name: 'Hamstrings', sortOrder: 9 },
  { name: 'Glutes', sortOrder: 10 },
  { name: 'Calves', sortOrder: 11 },
  { name: 'Core', sortOrder: 12 },
  { name: 'Lower Back', sortOrder: 13 },
  { name: 'Traps', sortOrder: 14 },
];

// ─── Equipment ──────────────────────────────────────────────

const equipment = [
  { name: 'Barbell', sortOrder: 1 },
  { name: 'Dumbbell', sortOrder: 2 },
  { name: 'Bodyweight', sortOrder: 3 },
  { name: 'Cable', sortOrder: 4 },
  { name: 'Machine', sortOrder: 5 },
  { name: 'Kettlebell', sortOrder: 6 },
  { name: 'Resistance Band', sortOrder: 7 },
  { name: 'Smith Machine', sortOrder: 8 },
  { name: 'EZ Bar', sortOrder: 9 },
  { name: 'Trap Bar', sortOrder: 10 },
  { name: 'Pull-Up Bar', sortOrder: 11 },
  { name: 'Bench', sortOrder: 12 },
  { name: 'Foam Roller', sortOrder: 13 },
];

// ─── Exercise definitions ───────────────────────────────────

interface ExerciseSeed {
  name: string;
  exerciseType: ExerciseType;
  primaryMuscle: string;
  secondaryMuscles?: string[];
  equipment: string[];
  defaultSets?: number;
  repMin?: number;
  repMax?: number;
  description?: string;
}

const exercises: ExerciseSeed[] = [
  // ── Chest ──
  {
    name: 'Barbell Bench Press',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Chest',
    secondaryMuscles: ['Triceps', 'Shoulders'],
    equipment: ['Barbell', 'Bench'],
    defaultSets: 4,
    repMin: 6,
    repMax: 12,
  },
  {
    name: 'Incline Dumbbell Press',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Chest',
    secondaryMuscles: ['Shoulders', 'Triceps'],
    equipment: ['Dumbbell', 'Bench'],
    defaultSets: 3,
    repMin: 8,
    repMax: 12,
  },
  {
    name: 'Dumbbell Flyes',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Chest',
    secondaryMuscles: ['Shoulders'],
    equipment: ['Dumbbell', 'Bench'],
    defaultSets: 3,
    repMin: 10,
    repMax: 15,
  },
  {
    name: 'Cable Crossover',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Chest',
    equipment: ['Cable'],
    defaultSets: 3,
    repMin: 10,
    repMax: 15,
  },
  {
    name: 'Push-Up',
    exerciseType: 'BODYWEIGHT',
    primaryMuscle: 'Chest',
    secondaryMuscles: ['Triceps', 'Shoulders', 'Core'],
    equipment: ['Bodyweight'],
    defaultSets: 3,
    repMin: 10,
    repMax: 25,
  },
  {
    name: 'Dips (Chest)',
    exerciseType: 'BODYWEIGHT_PLUS_WEIGHT',
    primaryMuscle: 'Chest',
    secondaryMuscles: ['Triceps', 'Shoulders'],
    equipment: ['Bodyweight'],
    defaultSets: 3,
    repMin: 8,
    repMax: 15,
  },

  // ── Back ──
  {
    name: 'Barbell Deadlift',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Lower Back',
    secondaryMuscles: [
      'Hamstrings',
      'Glutes',
      'Upper Back',
      'Traps',
      'Forearms',
    ],
    equipment: ['Barbell'],
    defaultSets: 4,
    repMin: 3,
    repMax: 8,
  },
  {
    name: 'Barbell Row',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Upper Back',
    secondaryMuscles: ['Lats', 'Biceps', 'Lower Back'],
    equipment: ['Barbell'],
    defaultSets: 4,
    repMin: 6,
    repMax: 12,
  },
  {
    name: 'Pull-Up',
    exerciseType: 'BODYWEIGHT_PLUS_WEIGHT',
    primaryMuscle: 'Lats',
    secondaryMuscles: ['Biceps', 'Upper Back', 'Forearms'],
    equipment: ['Pull-Up Bar'],
    defaultSets: 4,
    repMin: 5,
    repMax: 12,
  },
  {
    name: 'Lat Pulldown',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Lats',
    secondaryMuscles: ['Biceps', 'Upper Back'],
    equipment: ['Cable'],
    defaultSets: 3,
    repMin: 8,
    repMax: 12,
  },
  {
    name: 'Seated Cable Row',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Upper Back',
    secondaryMuscles: ['Lats', 'Biceps'],
    equipment: ['Cable'],
    defaultSets: 3,
    repMin: 8,
    repMax: 12,
  },
  {
    name: 'Dumbbell Row',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Upper Back',
    secondaryMuscles: ['Lats', 'Biceps'],
    equipment: ['Dumbbell'],
    defaultSets: 3,
    repMin: 8,
    repMax: 12,
  },
  {
    name: 'T-Bar Row',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Upper Back',
    secondaryMuscles: ['Lats', 'Biceps', 'Lower Back'],
    equipment: ['Barbell'],
    defaultSets: 3,
    repMin: 8,
    repMax: 12,
  },

  // ── Shoulders ──
  {
    name: 'Overhead Press',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Shoulders',
    secondaryMuscles: ['Triceps', 'Upper Back'],
    equipment: ['Barbell'],
    defaultSets: 4,
    repMin: 6,
    repMax: 10,
  },
  {
    name: 'Dumbbell Lateral Raise',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Shoulders',
    equipment: ['Dumbbell'],
    defaultSets: 3,
    repMin: 12,
    repMax: 20,
  },
  {
    name: 'Face Pull',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Shoulders',
    secondaryMuscles: ['Upper Back', 'Traps'],
    equipment: ['Cable'],
    defaultSets: 3,
    repMin: 12,
    repMax: 20,
  },
  {
    name: 'Arnold Press',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Shoulders',
    secondaryMuscles: ['Triceps'],
    equipment: ['Dumbbell'],
    defaultSets: 3,
    repMin: 8,
    repMax: 12,
  },
  {
    name: 'Dumbbell Front Raise',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Shoulders',
    equipment: ['Dumbbell'],
    defaultSets: 3,
    repMin: 10,
    repMax: 15,
  },
  {
    name: 'Reverse Pec Deck',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Shoulders',
    secondaryMuscles: ['Upper Back'],
    equipment: ['Machine'],
    defaultSets: 3,
    repMin: 12,
    repMax: 15,
  },

  // ── Biceps ──
  {
    name: 'Barbell Curl',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Biceps',
    secondaryMuscles: ['Forearms'],
    equipment: ['Barbell'],
    defaultSets: 3,
    repMin: 8,
    repMax: 12,
  },
  {
    name: 'Dumbbell Curl',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Biceps',
    secondaryMuscles: ['Forearms'],
    equipment: ['Dumbbell'],
    defaultSets: 3,
    repMin: 8,
    repMax: 12,
  },
  {
    name: 'Hammer Curl',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Biceps',
    secondaryMuscles: ['Forearms'],
    equipment: ['Dumbbell'],
    defaultSets: 3,
    repMin: 8,
    repMax: 12,
  },
  {
    name: 'Preacher Curl',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Biceps',
    equipment: ['EZ Bar', 'Bench'],
    defaultSets: 3,
    repMin: 8,
    repMax: 12,
  },
  {
    name: 'Cable Curl',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Biceps',
    equipment: ['Cable'],
    defaultSets: 3,
    repMin: 10,
    repMax: 15,
  },

  // ── Triceps ──
  {
    name: 'Close-Grip Bench Press',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Triceps',
    secondaryMuscles: ['Chest', 'Shoulders'],
    equipment: ['Barbell', 'Bench'],
    defaultSets: 3,
    repMin: 8,
    repMax: 12,
  },
  {
    name: 'Tricep Pushdown',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Triceps',
    equipment: ['Cable'],
    defaultSets: 3,
    repMin: 10,
    repMax: 15,
  },
  {
    name: 'Overhead Tricep Extension',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Triceps',
    equipment: ['Dumbbell'],
    defaultSets: 3,
    repMin: 10,
    repMax: 15,
  },
  {
    name: 'Skull Crushers',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Triceps',
    equipment: ['EZ Bar', 'Bench'],
    defaultSets: 3,
    repMin: 8,
    repMax: 12,
  },

  // ── Legs ──
  {
    name: 'Barbell Back Squat',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Quadriceps',
    secondaryMuscles: ['Glutes', 'Hamstrings', 'Core', 'Lower Back'],
    equipment: ['Barbell'],
    defaultSets: 4,
    repMin: 5,
    repMax: 10,
  },
  {
    name: 'Front Squat',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Quadriceps',
    secondaryMuscles: ['Glutes', 'Core'],
    equipment: ['Barbell'],
    defaultSets: 4,
    repMin: 6,
    repMax: 10,
  },
  {
    name: 'Leg Press',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Quadriceps',
    secondaryMuscles: ['Glutes', 'Hamstrings'],
    equipment: ['Machine'],
    defaultSets: 4,
    repMin: 8,
    repMax: 15,
  },
  {
    name: 'Romanian Deadlift',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Hamstrings',
    secondaryMuscles: ['Glutes', 'Lower Back'],
    equipment: ['Barbell'],
    defaultSets: 3,
    repMin: 8,
    repMax: 12,
  },
  {
    name: 'Leg Curl',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Hamstrings',
    equipment: ['Machine'],
    defaultSets: 3,
    repMin: 10,
    repMax: 15,
  },
  {
    name: 'Leg Extension',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Quadriceps',
    equipment: ['Machine'],
    defaultSets: 3,
    repMin: 10,
    repMax: 15,
  },
  {
    name: 'Bulgarian Split Squat',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Quadriceps',
    secondaryMuscles: ['Glutes', 'Hamstrings'],
    equipment: ['Dumbbell', 'Bench'],
    defaultSets: 3,
    repMin: 8,
    repMax: 12,
  },
  {
    name: 'Hip Thrust',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Glutes',
    secondaryMuscles: ['Hamstrings'],
    equipment: ['Barbell', 'Bench'],
    defaultSets: 3,
    repMin: 8,
    repMax: 15,
  },
  {
    name: 'Walking Lunge',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Quadriceps',
    secondaryMuscles: ['Glutes', 'Hamstrings'],
    equipment: ['Dumbbell'],
    defaultSets: 3,
    repMin: 10,
    repMax: 15,
  },
  {
    name: 'Calf Raise',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Calves',
    equipment: ['Machine'],
    defaultSets: 4,
    repMin: 12,
    repMax: 20,
  },
  {
    name: 'Seated Calf Raise',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Calves',
    equipment: ['Machine'],
    defaultSets: 3,
    repMin: 12,
    repMax: 20,
  },

  // ── Core ──
  {
    name: 'Plank',
    exerciseType: 'DURATION',
    primaryMuscle: 'Core',
    secondaryMuscles: ['Shoulders'],
    equipment: ['Bodyweight'],
    defaultSets: 3,
  },
  {
    name: 'Hanging Leg Raise',
    exerciseType: 'REPS_ONLY',
    primaryMuscle: 'Core',
    equipment: ['Pull-Up Bar'],
    defaultSets: 3,
    repMin: 10,
    repMax: 15,
  },
  {
    name: 'Cable Crunch',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Core',
    equipment: ['Cable'],
    defaultSets: 3,
    repMin: 12,
    repMax: 20,
  },
  {
    name: 'Ab Wheel Rollout',
    exerciseType: 'REPS_ONLY',
    primaryMuscle: 'Core',
    secondaryMuscles: ['Shoulders'],
    equipment: ['Bodyweight'],
    defaultSets: 3,
    repMin: 8,
    repMax: 15,
  },
  {
    name: 'Russian Twist',
    exerciseType: 'REPS_ONLY',
    primaryMuscle: 'Core',
    equipment: ['Bodyweight'],
    defaultSets: 3,
    repMin: 15,
    repMax: 25,
  },

  // ── Traps ──
  {
    name: 'Barbell Shrug',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Traps',
    equipment: ['Barbell'],
    defaultSets: 3,
    repMin: 10,
    repMax: 15,
  },
  {
    name: 'Dumbbell Shrug',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Traps',
    equipment: ['Dumbbell'],
    defaultSets: 3,
    repMin: 10,
    repMax: 15,
  },

  // ── Forearms ──
  {
    name: 'Wrist Curl',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Forearms',
    equipment: ['Dumbbell'],
    defaultSets: 3,
    repMin: 12,
    repMax: 20,
  },
  {
    name: 'Reverse Wrist Curl',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Forearms',
    equipment: ['Dumbbell'],
    defaultSets: 3,
    repMin: 12,
    repMax: 20,
  },
  {
    name: "Farmer's Walk",
    exerciseType: 'DURATION',
    primaryMuscle: 'Forearms',
    secondaryMuscles: ['Traps', 'Core'],
    equipment: ['Dumbbell'],
    defaultSets: 3,
  },

  // ── Lower Back ──
  {
    name: 'Back Extension',
    exerciseType: 'BODYWEIGHT_PLUS_WEIGHT',
    primaryMuscle: 'Lower Back',
    secondaryMuscles: ['Glutes', 'Hamstrings'],
    equipment: ['Bodyweight'],
    defaultSets: 3,
    repMin: 10,
    repMax: 15,
  },
  {
    name: 'Good Morning',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Lower Back',
    secondaryMuscles: ['Hamstrings', 'Glutes'],
    equipment: ['Barbell'],
    defaultSets: 3,
    repMin: 8,
    repMax: 12,
  },

  // ── Compound / Full Body ──
  {
    name: 'Clean and Press',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Shoulders',
    secondaryMuscles: ['Quadriceps', 'Glutes', 'Upper Back', 'Traps', 'Core'],
    equipment: ['Barbell'],
    defaultSets: 4,
    repMin: 3,
    repMax: 6,
  },
  {
    name: 'Kettlebell Swing',
    exerciseType: 'WEIGHT_REPS',
    primaryMuscle: 'Glutes',
    secondaryMuscles: ['Hamstrings', 'Core', 'Shoulders'],
    equipment: ['Kettlebell'],
    defaultSets: 3,
    repMin: 12,
    repMax: 20,
  },
  {
    name: 'Burpee',
    exerciseType: 'REPS_ONLY',
    primaryMuscle: 'Core',
    secondaryMuscles: ['Chest', 'Quadriceps', 'Shoulders'],
    equipment: ['Bodyweight'],
    defaultSets: 3,
    repMin: 8,
    repMax: 15,
  },
];

// ─── Seed function ──────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding IronTrack database...\n');

  // 1. Seed muscle groups
  console.log('  → Seeding muscle groups...');
  const muscleGroupMap = new Map<string, string>();
  for (const mg of muscleGroups) {
    const record = await prisma.muscleGroup.upsert({
      where: { name: mg.name },
      update: { sortOrder: mg.sortOrder },
      create: mg,
    });
    muscleGroupMap.set(mg.name, record.id);
  }
  console.log(`    ✅ ${muscleGroups.length} muscle groups\n`);

  // 2. Seed equipment
  console.log('  → Seeding equipment...');
  const equipmentMap = new Map<string, string>();
  for (const eq of equipment) {
    const record = await prisma.equipment.upsert({
      where: { name: eq.name },
      update: { sortOrder: eq.sortOrder },
      create: eq,
    });
    equipmentMap.set(eq.name, record.id);
  }
  console.log(`    ✅ ${equipment.length} equipment items\n`);

  // 3. Seed global exercises
  console.log('  → Seeding exercises...');
  let exerciseCount = 0;
  for (const ex of exercises) {
    const primaryMuscleGroupId = muscleGroupMap.get(ex.primaryMuscle);
    if (!primaryMuscleGroupId) {
      console.warn(
        `    ⚠️  Skipping "${ex.name}" — unknown primary muscle: ${ex.primaryMuscle}`,
      );
      continue;
    }

    // Check if exercise already exists (by name + isGlobal)
    const existing = await prisma.exerciseTemplate.findFirst({
      where: { name: ex.name, isGlobal: true },
    });

    if (existing) {
      exerciseCount++;
      continue; // Skip if already seeded
    }

    const exercise = await prisma.exerciseTemplate.create({
      data: {
        name: ex.name,
        description: ex.description,
        exerciseType: ex.exerciseType,
        isGlobal: true,
        ownerUserId: null,
        primaryMuscleGroupId,
        defaultSets: ex.defaultSets,
        repMin: ex.repMin,
        repMax: ex.repMax,
      },
    });

    // Add secondary muscles
    if (ex.secondaryMuscles) {
      for (const sm of ex.secondaryMuscles) {
        const smId = muscleGroupMap.get(sm);
        if (smId) {
          await prisma.exerciseTemplateSecondaryMuscle.create({
            data: {
              exerciseTemplateId: exercise.id,
              muscleGroupId: smId,
            },
          });
        }
      }
    }

    // Add equipment
    for (const eq of ex.equipment) {
      const eqId = equipmentMap.get(eq);
      if (eqId) {
        await prisma.exerciseTemplateEquipment.create({
          data: {
            exerciseTemplateId: exercise.id,
            equipmentId: eqId,
          },
        });
      }
    }

    exerciseCount++;
  }
  console.log(`    ✅ ${exerciseCount} exercises\n`);

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
