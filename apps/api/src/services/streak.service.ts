import { Injectable } from '@nestjs/common';
import { ChecklistType, StreakType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const REQUIRED_CHECKLIST_TYPES = [
  ChecklistType.WORKOUT,
  ChecklistType.WARMUP,
  ChecklistType.MOBILITY,
  ChecklistType.NOTES,
] as const;

@Injectable()
export class StreakService {
  constructor(private readonly prisma: PrismaService) {}

  async onSessionFinished(userId: string, completedAt?: Date): Promise<void> {
    await this.incrementStreak(userId, StreakType.WORKOUT, completedAt);
  }

  async onChecklistCompleted(userId: string, date: string): Promise<void> {
    const completedCount = await this.prisma.checklistItem.count({
      where: {
        userId,
        date: new Date(`${date}T00:00:00.000Z`),
        isCompleted: true,
        type: { in: [...REQUIRED_CHECKLIST_TYPES] },
      },
    });

    if (completedCount === REQUIRED_CHECKLIST_TYPES.length) {
      await this.incrementStreak(userId, StreakType.CHECKLIST, date);
    }
  }

  private async incrementStreak(
    userId: string,
    streakType: StreakType,
    forcedDate?: string | Date,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return;
    }

    const timezone = user.timezone ?? 'UTC';
    const localDate =
      typeof forcedDate === 'string'
        ? forcedDate
        : this.formatDateInTimezone(forcedDate ?? new Date(), timezone);
    const dateValue = new Date(`${localDate}T00:00:00.000Z`);

    const streak = await this.prisma.userStreak.findUnique({
      where: {
        userId_streakType: {
          userId,
          streakType,
        },
      },
    });

    if (!streak) {
      await this.prisma.userStreak.create({
        data: {
          userId,
          streakType,
          currentStreakDays: 1,
          longestStreakDays: 1,
          lastCompletedDate: dateValue,
        },
      });
      return;
    }

    const previousDateString = streak.lastCompletedDate
      ? this.formatStoredDate(streak.lastCompletedDate)
      : null;

    if (previousDateString === localDate) {
      return;
    }

    const isConsecutive = previousDateString
      ? this.daysBetween(previousDateString, localDate) === 1
      : false;

    const currentStreakDays = isConsecutive ? streak.currentStreakDays + 1 : 1;

    await this.prisma.userStreak.update({
      where: { id: streak.id },
      data: {
        currentStreakDays,
        longestStreakDays: Math.max(
          streak.longestStreakDays,
          currentStreakDays,
        ),
        lastCompletedDate: dateValue,
      },
    });
  }

  private formatDateInTimezone(date: Date, timezone: string): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    return formatter.format(date);
  }

  private formatStoredDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private daysBetween(prev: string, next: string): number {
    const prevDate = new Date(`${prev}T00:00:00.000Z`);
    const nextDate = new Date(`${next}T00:00:00.000Z`);
    return Math.round((nextDate.getTime() - prevDate.getTime()) / 86_400_000);
  }
}
