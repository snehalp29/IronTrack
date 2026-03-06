import { Injectable, NotFoundException } from '@nestjs/common';

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
    const existingUser = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!existingUser) {
      this.throwUserNotFound();
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: input,
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
  }

  async deleteMe(userId: string) {
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.updateMany({
        where: {
          id: userId,
          deletedAt: null,
        },
        data: { deletedAt: now },
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
