import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateWorkoutTemplateDto,
  ReorderWorkoutTemplateDto,
  UpdateWorkoutTemplateDto,
} from './dto/workout-template.schemas';

@Injectable()
export class WorkoutTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.workoutTemplate.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      include: {
        exercises: {
          where: {
            exercise: {
              deletedAt: null,
            },
          },
          orderBy: { orderIndex: 'asc' },
          include: {
            exercise: {
              include: {
                primaryMuscle: true,
                secondaryMuscles: { include: { muscleGroup: true } },
              },
            },
          },
        },
      },
    });
  }

  async getById(userId: string, id: string) {
    const template = await this.prisma.workoutTemplate.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        exercises: {
          where: {
            exercise: {
              deletedAt: null,
            },
          },
          orderBy: { orderIndex: 'asc' },
          include: {
            exercise: {
              include: {
                primaryMuscle: true,
                secondaryMuscles: { include: { muscleGroup: true } },
              },
            },
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException({
        code: 'TEMPLATE_NOT_FOUND',
        message: 'Workout template not found',
      });
    }

    const coverage = new Set<string>();
    for (const row of template.exercises) {
      coverage.add(row.exercise.primaryMuscle.name);
      for (const secondary of row.exercise.secondaryMuscles) {
        coverage.add(secondary.muscleGroup.name);
      }
    }

    return {
      ...template,
      muscleCoverage: Array.from(coverage),
    };
  }

  async create(userId: string, input: CreateWorkoutTemplateDto) {
    await this.assertExerciseTemplatesAccessible(
      userId,
      input.exercises.map((exercise) => exercise.exerciseTemplateId),
    );

    const orderIndex =
      input.orderIndex ??
      (await this.prisma.workoutTemplate.count({
        where: { userId, deletedAt: null },
      }));

    return this.prisma.workoutTemplate.create({
      data: {
        userId,
        name: input.name,
        description: input.description,
        orderIndex,
        exercises: {
          create: input.exercises.map((exercise) => ({
            exerciseTemplateId: exercise.exerciseTemplateId,
            orderIndex: exercise.orderIndex,
            defaultSets: exercise.defaultSets,
            repMin: exercise.repMin,
            repMax: exercise.repMax,
            supersetGroupKey: exercise.supersetGroupKey,
          })),
        },
      },
      include: {
        exercises: true,
      },
    });
  }

  async update(
    userId: string,
    templateId: string,
    input: UpdateWorkoutTemplateDto,
  ) {
    await this.assertOwnership(userId, templateId);
    if (input.exercises) {
      await this.assertExerciseTemplatesAccessible(
        userId,
        input.exercises.map((exercise) => exercise.exerciseTemplateId),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (input.exercises) {
        await tx.workoutTemplateExercise.deleteMany({
          where: { workoutTemplateId: templateId },
        });
        await tx.workoutTemplateExercise.createMany({
          data: input.exercises.map((exercise) => ({
            workoutTemplateId: templateId,
            exerciseTemplateId: exercise.exerciseTemplateId,
            orderIndex: exercise.orderIndex,
            defaultSets: exercise.defaultSets,
            repMin: exercise.repMin,
            repMax: exercise.repMax,
            supersetGroupKey: exercise.supersetGroupKey,
          })),
        });
      }

      return tx.workoutTemplate.update({
        where: { id: templateId },
        data: {
          name: input.name,
          description: input.description,
          orderIndex: input.orderIndex,
        },
      });
    });
  }

  async softDelete(userId: string, templateId: string) {
    await this.assertOwnership(userId, templateId);

    await this.prisma.workoutTemplate.update({
      where: { id: templateId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async reorder(userId: string, input: ReorderWorkoutTemplateDto) {
    const templateIds = input.items.map((item) => item.id);
    const accessibleCount = await this.prisma.workoutTemplate.count({
      where: {
        id: { in: templateIds },
        userId,
        deletedAt: null,
      },
    });

    if (accessibleCount !== templateIds.length) {
      throw new ForbiddenException({
        code: 'TEMPLATE_FORBIDDEN',
        message: 'Template not found or not accessible',
      });
    }

    const results = await this.prisma.$transaction(
      input.items.map((item) =>
        this.prisma.workoutTemplate.updateMany({
          where: { id: item.id, userId, deletedAt: null },
          data: { orderIndex: item.orderIndex },
        }),
      ),
    );

    if (results.some((result) => result.count === 0)) {
      throw new ForbiddenException({
        code: 'TEMPLATE_FORBIDDEN',
        message: 'Template not found or not accessible',
      });
    }

    return { success: true };
  }

  private async assertOwnership(userId: string, templateId: string) {
    const template = await this.prisma.workoutTemplate.findFirst({
      where: {
        id: templateId,
        userId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!template) {
      throw new ForbiddenException({
        code: 'TEMPLATE_FORBIDDEN',
        message: 'Template not found or not accessible',
      });
    }
  }

  private async assertExerciseTemplatesAccessible(
    userId: string,
    exerciseTemplateIds: string[],
  ) {
    const uniqueIds = Array.from(new Set(exerciseTemplateIds));

    const accessibleExercises = await this.prisma.exerciseTemplate.findMany({
      where: {
        id: { in: uniqueIds },
        deletedAt: null,
        OR: [{ isGlobal: true }, { ownerUserId: userId }],
      },
      select: { id: true },
    });

    if (accessibleExercises.length !== uniqueIds.length) {
      throw new ForbiddenException({
        code: 'EXERCISE_FORBIDDEN',
        message: 'Exercise not found or not accessible',
      });
    }
  }
}
