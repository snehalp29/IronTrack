import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { StreakService } from '../../services/streak.service';
import {
  ChecklistWeekQueryDto,
  UpsertChecklistDto,
} from './dto/checklist.schemas';

@Injectable()
export class ChecklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly streakService: StreakService,
  ) {}

  async getByDate(userId: string, date: string) {
    const requestedDate = new Date(`${date}T00:00:00.000Z`);
    const today = new Date();
    const todayUtc = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );

    if (requestedDate.getTime() > todayUtc.getTime()) {
      throw new BadRequestException({
        code: 'FUTURE_DATE_NOT_ALLOWED',
        message: 'Future dates are not allowed',
      });
    }

    return this.prisma.checklistItem.findMany({
      where: {
        userId,
        date: requestedDate,
      },
      orderBy: { type: 'asc' },
    });
  }

  async upsert(userId: string, input: UpsertChecklistDto) {
    const dateValue = new Date(`${input.date}T00:00:00.000Z`);
    const item = await this.prisma.$transaction(async (tx) => {
      const itemWhere = {
        userId_date_type: {
          userId,
          date: dateValue,
          type: input.type,
        },
      };
      const itemSelect = {
        id: true,
        userId: true,
        date: true,
        type: true,
        isCompleted: true,
        completedAt: true,
        user: {
          select: {
            timezone: true,
          },
        },
      } as const;

      if (!input.isCompleted) {
        return tx.checklistItem.upsert({
          select: itemSelect,
          where: itemWhere,
          update: {
            isCompleted: false,
            completedAt: null,
          },
          create: {
            userId,
            date: dateValue,
            type: input.type,
            isCompleted: false,
            completedAt: null,
          },
        });
      }

      const completedAt = new Date();
      await tx.checklistItem.upsert({
        select: itemSelect,
        where: itemWhere,
        update: {
          isCompleted: true,
        },
        create: {
          userId,
          date: dateValue,
          type: input.type,
          isCompleted: true,
          completedAt,
        },
      });
      await tx.checklistItem.updateMany({
        where: {
          userId,
          date: dateValue,
          type: input.type,
          completedAt: null,
        },
        data: {
          completedAt,
        },
      });

      return tx.checklistItem.findUnique({
        where: itemWhere,
        select: itemSelect,
      });
    });

    if (!item) {
      throw new Error('Checklist item upsert failed unexpectedly');
    }

    if (input.isCompleted) {
      await this.streakService.onChecklistCompleted(
        userId,
        input.date,
        item.user?.timezone ?? undefined,
      );
    }

    const { user, ...checklistItem } = item;
    void user;
    return checklistItem;
  }

  async getWeek(userId: string, query: ChecklistWeekQueryDto) {
    const start = new Date(`${query.startDate}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);

    return this.prisma.checklistItem.findMany({
      where: {
        userId,
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: [{ date: 'asc' }, { type: 'asc' }],
    });
  }
}
