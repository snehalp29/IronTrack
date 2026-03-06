import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateExerciseDto,
  ListExercisesQuery,
  UpdateExerciseDto,
  UpsertExerciseNoteDto,
} from './dto/exercise.schemas';

@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: ListExercisesQuery) {
    const skip = (query.page - 1) * query.pageSize;
    const search = normalizeQueryFilter(query.search);
    const muscleGroup = normalizeQueryFilter(query.muscleGroup);
    const equipment = normalizeQueryFilter(query.equipment);

    const where = {
      deletedAt: null,
      exerciseType: query.type,
      isGlobal: query.isGlobal,
      OR: [{ isGlobal: true }, { ownerUserId: userId }],
      name: search
        ? {
            contains: search,
            mode: 'insensitive' as const,
          }
        : undefined,
      primaryMuscle: muscleGroup
        ? {
            name: {
              equals: muscleGroup,
              mode: 'insensitive' as const,
            },
          }
        : undefined,
      equipment: equipment
        ? {
            some: {
              equipment: {
                name: {
                  equals: equipment,
                  mode: 'insensitive' as const,
                },
              },
            },
          }
        : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.exerciseTemplate.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ isGlobal: 'desc' }, { name: 'asc' }],
        include: {
          primaryMuscle: true,
          equipment: { include: { equipment: true } },
        },
      }),
      this.prisma.exerciseTemplate.count({ where }),
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

  async getById(userId: string, exerciseId: string) {
    const exercise = await this.prisma.exerciseTemplate.findFirst({
      where: {
        id: exerciseId,
        deletedAt: null,
        OR: [{ isGlobal: true }, { ownerUserId: userId }],
      },
      include: {
        primaryMuscle: true,
        secondaryMuscles: { include: { muscleGroup: true } },
        equipment: { include: { equipment: true } },
        videos: true,
        notes: {
          where: { userId },
          take: 1,
        },
      },
    });

    if (!exercise) {
      throw new NotFoundException({
        code: 'EXERCISE_NOT_FOUND',
        message: 'Exercise not found',
      });
    }

    return exercise;
  }

  async create(userId: string, input: CreateExerciseDto) {
    const name = normalizeExerciseNameOrThrow(input.name);
    await this.ensureUniqueNameForOwner(userId, name);
    const secondaryMuscleGroupIds = uniqueStrings(
      input.secondaryMuscleGroupIds,
    );
    const equipmentIds = uniqueStrings(input.equipmentIds);

    try {
      return await this.prisma.exerciseTemplate.create({
        data: {
          name,
          description: input.description,
          exerciseType: input.exerciseType,
          isGlobal: false,
          ownerUserId: userId,
          primaryMuscleGroupId: input.primaryMuscleGroupId,
          defaultSets: input.defaultSets,
          repMin: input.repMin,
          repMax: input.repMax,
          defaultCues: input.defaultCues,
          secondaryMuscles: {
            create: secondaryMuscleGroupIds.map((muscleGroupId) => ({
              muscleGroupId,
            })),
          },
          equipment: {
            create: equipmentIds.map((equipmentId) => ({ equipmentId })),
          },
        },
        include: {
          secondaryMuscles: true,
          equipment: true,
        },
      });
    } catch (error) {
      if (isExerciseNameUniqueConstraintError(error)) {
        this.throwExerciseNameExists();
      }

      throw error;
    }
  }

  async update(userId: string, exerciseId: string, input: UpdateExerciseDto) {
    const exercise = await this.prisma.exerciseTemplate.findFirst({
      where: {
        id: exerciseId,
        ownerUserId: userId,
        isGlobal: false,
        deletedAt: null,
      },
    });

    if (!exercise) {
      throw new ForbiddenException({
        code: 'EXERCISE_NOT_EDITABLE',
        message: 'Only your custom exercises can be edited',
      });
    }

    const normalizedName = input.name
      ? normalizeExerciseNameOrThrow(input.name)
      : undefined;

    if (
      normalizedName &&
      normalizedName.toLowerCase() !== exercise.name.toLowerCase()
    ) {
      await this.ensureUniqueNameForOwner(userId, normalizedName, exerciseId);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.exerciseTemplate
        .updateMany({
          where: {
            id: exerciseId,
            ownerUserId: userId,
            isGlobal: false,
            deletedAt: null,
          },
          data: {
            name: normalizedName,
            description: input.description,
            exerciseType: input.exerciseType,
            primaryMuscleGroupId: input.primaryMuscleGroupId,
            defaultSets: input.defaultSets,
            repMin: input.repMin,
            repMax: input.repMax,
            defaultCues: input.defaultCues,
            updatedAt: new Date(),
          },
        })
        .catch((error: unknown) => {
          if (isExerciseNameUniqueConstraintError(error)) {
            this.throwExerciseNameExists();
          }

          throw error;
        });

      if (!updated.count) {
        throw new ForbiddenException({
          code: 'EXERCISE_NOT_EDITABLE',
          message: 'Only your custom exercises can be edited',
        });
      }

      if (input.secondaryMuscleGroupIds) {
        const secondaryMuscleGroupIds = uniqueStrings(
          input.secondaryMuscleGroupIds,
        );
        await tx.exerciseTemplateSecondaryMuscle.deleteMany({
          where: { exerciseTemplateId: exerciseId },
        });

        if (secondaryMuscleGroupIds.length) {
          await tx.exerciseTemplateSecondaryMuscle.createMany({
            data: secondaryMuscleGroupIds.map((muscleGroupId) => ({
              exerciseTemplateId: exerciseId,
              muscleGroupId,
            })),
          });
        }
      }

      if (input.equipmentIds) {
        const equipmentIds = uniqueStrings(input.equipmentIds);
        await tx.exerciseTemplateEquipment.deleteMany({
          where: { exerciseTemplateId: exerciseId },
        });

        if (equipmentIds.length) {
          await tx.exerciseTemplateEquipment.createMany({
            data: equipmentIds.map((equipmentId) => ({
              exerciseTemplateId: exerciseId,
              equipmentId,
            })),
          });
        }
      }

      const updatedExercise = await tx.exerciseTemplate.findFirst({
        where: {
          id: exerciseId,
          ownerUserId: userId,
          isGlobal: false,
          deletedAt: null,
        },
      });

      if (!updatedExercise) {
        throw new ForbiddenException({
          code: 'EXERCISE_NOT_EDITABLE',
          message: 'Only your custom exercises can be edited',
        });
      }

      return updatedExercise;
    });
  }

  async softDelete(userId: string, exerciseId: string) {
    const result = await this.prisma.exerciseTemplate.updateMany({
      where: {
        id: exerciseId,
        ownerUserId: userId,
        isGlobal: false,
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });

    if (!result.count) {
      throw new ForbiddenException({
        code: 'EXERCISE_NOT_DELETABLE',
        message: 'Only your custom exercises can be deleted',
      });
    }

    return { success: true };
  }

  async history(userId: string, exerciseId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.set.findMany({
        where: {
          deletedAt: null,
          sessionExercise: {
            exerciseTemplateId: exerciseId,
            deletedAt: null,
            session: {
              userId,
              deletedAt: null,
            },
          },
        },
        include: {
          sessionExercise: {
            include: {
              session: {
                select: {
                  id: true,
                  startedAt: true,
                  finishedAt: true,
                },
              },
            },
          },
        },
        orderBy: [
          {
            completedAt: {
              sort: 'desc',
              nulls: 'last',
            },
          },
          { createdAt: 'desc' },
        ],
        skip,
        take: pageSize,
      }),
      this.prisma.set.count({
        where: {
          deletedAt: null,
          sessionExercise: {
            exerciseTemplateId: exerciseId,
            deletedAt: null,
            session: {
              userId,
              deletedAt: null,
            },
          },
        },
      }),
    ]);

    return {
      items,
      pagination: { page, pageSize, total },
    };
  }

  async upsertNote(
    userId: string,
    exerciseId: string,
    input: UpsertExerciseNoteDto,
  ) {
    await this.getById(userId, exerciseId);
    const note = normalizeExerciseNote(input.note);

    return this.prisma.exerciseNote.upsert({
      where: {
        userId_exerciseTemplateId: {
          userId,
          exerciseTemplateId: exerciseId,
        },
      },
      update: {
        note,
      },
      create: {
        userId,
        exerciseTemplateId: exerciseId,
        note,
      },
    });
  }

  private async ensureUniqueNameForOwner(
    userId: string,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.exerciseTemplate.findFirst({
      where: {
        ownerUserId: userId,
        deletedAt: null,
        id: excludeId ? { not: excludeId } : undefined,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      this.throwExerciseNameExists();
    }
  }

  private throwExerciseNameExists(): never {
    throw new BadRequestException({
      code: 'EXERCISE_NAME_EXISTS',
      message: 'Exercise name already exists for this user',
    });
  }
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeExerciseNameOrThrow(name: string): string {
  const normalized = name.trim();
  if (normalized.length < 2) {
    throw new BadRequestException({
      code: 'EXERCISE_NAME_INVALID',
      message: 'Exercise name must be at least 2 characters',
    });
  }

  return normalized;
}

function normalizeExerciseNote(note: string): string {
  const normalized = note.trim();
  if (normalized.length === 0) {
    throw new BadRequestException({
      code: 'EXERCISE_NOTE_REQUIRED',
      message: 'Exercise note cannot be empty',
    });
  }

  return normalized;
}

function normalizeQueryFilter(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function isExerciseNameUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const maybeError = error as {
    code?: unknown;
    meta?: {
      target?: unknown;
    };
  };
  if (maybeError.code !== 'P2002') {
    return false;
  }

  const target = maybeError.meta?.target;
  if (Array.isArray(target)) {
    return target.some(
      (entry) =>
        typeof entry === 'string' && entry.toLowerCase().includes('name'),
    );
  }

  return typeof target === 'string' && target.toLowerCase().includes('name');
}
