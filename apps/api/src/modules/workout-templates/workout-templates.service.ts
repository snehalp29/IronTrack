import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateWorkoutTemplateDto,
  ListWorkoutTemplatesQuery,
  ReorderWorkoutTemplateDto,
  UpdateWorkoutTemplateDto,
} from './dto/workout-template.schemas';

@Injectable()
export class WorkoutTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    query: ListWorkoutTemplatesQuery = { page: 1, pageSize: 100 },
  ) {
    const skip = (query.page - 1) * query.pageSize;
    const where = { userId, deletedAt: null as Date | null };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.workoutTemplate.findMany({
        where,
        skip,
        take: query.pageSize,
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
      }),
      this.prisma.workoutTemplate.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
      },
    };
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
    const name = normalizeTemplateNameOrThrow(input.name);
    assertUniqueTemplateExerciseOrderIndexes(input.exercises);
    let lastSerializableConflict: unknown;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await this.assertExerciseTemplatesAccessible(
              tx,
              userId,
              input.exercises.map((exercise) => exercise.exerciseTemplateId),
            );
            const orderIndex =
              input.orderIndex ?? (await this.getNextOrderIndex(tx, userId));

            return tx.workoutTemplate.create({
              data: {
                userId,
                name,
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
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
      } catch (error) {
        if (
          !isSerializableTransactionConflict(error) ||
          input.orderIndex !== undefined
        ) {
          throw error;
        }

        lastSerializableConflict = error;
      }
    }

    throw lastSerializableConflict instanceof Error
      ? lastSerializableConflict
      : new Error('Failed to create template');
  }

  async update(
    userId: string,
    templateId: string,
    input: UpdateWorkoutTemplateDto,
  ) {
    await this.assertOwnership(userId, templateId);
    const normalizedName =
      input.name === undefined
        ? undefined
        : normalizeTemplateNameOrThrow(input.name);
    if (input.exercises !== undefined) {
      if (input.exercises.length === 0) {
        throw new BadRequestException({
          code: 'TEMPLATE_EXERCISES_REQUIRED',
          message: 'Template exercises cannot be empty',
        });
      }
      assertUniqueTemplateExerciseOrderIndexes(input.exercises);
    }

    return this.prisma.$transaction(async (tx) => {
      if (input.exercises) {
        await this.assertExerciseTemplatesAccessible(
          tx,
          userId,
          input.exercises.map((exercise) => exercise.exerciseTemplateId),
        );
      }

      const updated = await tx.workoutTemplate.updateMany({
        where: {
          id: templateId,
          userId,
          deletedAt: null,
        },
        data: {
          name: normalizedName,
          description: input.description,
          orderIndex: input.orderIndex,
          updatedAt: new Date(),
        },
      });

      if (!updated.count) {
        throw new ForbiddenException({
          code: 'TEMPLATE_FORBIDDEN',
          message: 'Template not found or not accessible',
        });
      }

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

      const template = await tx.workoutTemplate.findFirst({
        where: {
          id: templateId,
          userId,
          deletedAt: null,
        },
        include: {
          exercises: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      });

      if (!template) {
        throw new ForbiddenException({
          code: 'TEMPLATE_FORBIDDEN',
          message: 'Template not found or not accessible',
        });
      }

      return template;
    });
  }

  async softDelete(userId: string, templateId: string) {
    await this.assertOwnership(userId, templateId);

    const updated = await this.prisma.workoutTemplate.updateMany({
      where: {
        id: templateId,
        userId,
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });

    if (!updated.count) {
      const deletedTemplate = await this.prisma.workoutTemplate.findFirst({
        where: {
          id: templateId,
          userId,
        },
        select: {
          id: true,
          deletedAt: true,
        },
      });

      if (deletedTemplate?.deletedAt) {
        return { success: true };
      }

      throw new ForbiddenException({
        code: 'TEMPLATE_FORBIDDEN',
        message: 'Template not found or not accessible',
      });
    }

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

  private async getNextOrderIndex(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    const lastTemplate = await tx.workoutTemplate.findFirst({
      where: { userId, deletedAt: null },
      orderBy: [{ orderIndex: 'desc' }, { createdAt: 'desc' }],
      select: { orderIndex: true },
    });

    return (lastTemplate?.orderIndex ?? -1) + 1;
  }

  private async assertExerciseTemplatesAccessible(
    client: PrismaService | Prisma.TransactionClient,
    userId: string,
    exerciseTemplateIds: string[],
  ) {
    const uniqueIds = Array.from(new Set(exerciseTemplateIds));

    const accessibleExercises = await client.exerciseTemplate.findMany({
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

function assertUniqueTemplateExerciseOrderIndexes(
  exercises: Array<{ orderIndex: number }>,
) {
  const seenOrderIndexes = new Set<number>();
  for (const exercise of exercises) {
    if (seenOrderIndexes.has(exercise.orderIndex)) {
      throw new BadRequestException({
        code: 'DUPLICATE_TEMPLATE_EXERCISE_ORDER_INDEX',
        message: 'Duplicate orderIndex in template exercises payload',
      });
    }

    seenOrderIndexes.add(exercise.orderIndex);
  }
}

function normalizeTemplateNameOrThrow(name: string): string {
  const normalized = name.trim();
  if (normalized.length < 2) {
    throw new BadRequestException({
      code: 'TEMPLATE_NAME_INVALID',
      message: 'Template name must be at least 2 characters',
    });
  }

  return normalized;
}

function isSerializableTransactionConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  return (error as { code?: unknown }).code === 'P2034';
}
