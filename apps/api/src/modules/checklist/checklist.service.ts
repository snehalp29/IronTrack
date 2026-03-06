import { Injectable } from '@nestjs/common';

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
    return this.prisma.checklistItem.findMany({
      where: {
        userId,
        date: new Date(`${date}T00:00:00.000Z`),
      },
      orderBy: { type: 'asc' },
    });
  }

  async upsert(userId: string, input: UpsertChecklistDto) {
    const dateValue = new Date(`${input.date}T00:00:00.000Z`);

    const item = await this.prisma.checklistItem.upsert({
      select: {
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
      },
      where: {
        userId_date_type: {
          userId,
          date: dateValue,
          type: input.type,
        },
      },
      update: {
        isCompleted: input.isCompleted,
        completedAt: input.isCompleted ? new Date() : null,
      },
      create: {
        userId,
        date: dateValue,
        type: input.type,
        isCompleted: input.isCompleted,
        completedAt: input.isCompleted ? new Date() : null,
      },
    });

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
