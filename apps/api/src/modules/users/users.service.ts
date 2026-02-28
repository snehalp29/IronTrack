import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { UpdateMeDto } from './user.schemas';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { deletedAt: now },
      }),
      this.prisma.exerciseTemplate.updateMany({
        where: { ownerUserId: userId, deletedAt: null },
        data: { deletedAt: now },
      }),
      this.prisma.workoutTemplate.updateMany({
        where: { userId, deletedAt: null },
        data: { deletedAt: now },
      }),
      this.prisma.workoutSession.updateMany({
        where: { userId, deletedAt: null },
        data: { deletedAt: now },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);

    return { success: true };
  }
}
