import { Injectable, NotFoundException } from '@nestjs/common';

import { buildDeletedUserEmail } from '../../common/utils/deleted-user-email';
import { normalizeTimezoneOrThrow } from '../../common/validation/timezone';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateMeDto } from './user.schemas';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        timezone: true,
        unitPreference: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    return user;
  }

  async updateMe(userId: string, input: UpdateMeDto) {
    const data = {
      ...input,
      timezone:
        input.timezone === undefined
          ? undefined
          : normalizeTimezoneOrThrow(input.timezone),
    };
    const updated = await this.prisma.user.updateMany({
      where: {
        id: userId,
        deletedAt: null,
      },
      data,
    });

    if (!updated.count) {
      this.throwUserNotFound();
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        timezone: true,
        unitPreference: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });

    if (!user) {
      this.throwUserNotFound();
    }

    return user;
  }

  async deleteMe(userId: string) {
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.updateMany({
        where: {
          id: userId,
          deletedAt: null,
        },
        data: {
          deletedAt: now,
          email: buildDeletedUserEmail(userId, now),
          googleId: null,
        },
      });

      if (!updatedUser.count) {
        this.throwUserNotFound();
      }

      await Promise.all([
        tx.exerciseTemplate.updateMany({
          where: { ownerUserId: userId, deletedAt: null },
          data: { deletedAt: now },
        }),
        tx.workoutTemplate.updateMany({
          where: { userId, deletedAt: null },
          data: { deletedAt: now },
        }),
        tx.workoutSession.updateMany({
          where: { userId, deletedAt: null },
          data: { deletedAt: now },
        }),
        tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: now },
        }),
        tx.exerciseNote.deleteMany({
          where: { userId },
        }),
        tx.pRRecord.deleteMany({
          where: { userId },
        }),
        tx.userStreak.deleteMany({
          where: { userId },
        }),
        tx.checklistItem.deleteMany({
          where: { userId },
        }),
        tx.sessionNote.deleteMany({
          where: {
            session: {
              userId,
            },
          },
        }),
      ]);
    });

    return { success: true };
  }

  private throwUserNotFound(): never {
    throw new NotFoundException({
      code: 'USER_NOT_FOUND',
      message: 'User not found',
    });
  }
}
