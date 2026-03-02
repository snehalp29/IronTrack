import { Injectable } from '@nestjs/common';
import { StreakType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StreakService {
  constructor(private readonly prisma: PrismaService) {}

  async onSessionFinished(userId: string): Promise<void> {
    await this.incrementStreak(userId, StreakType.WORKOUT);
  }

  async onChecklistCompleted(userId: string, date: string): Promise<void> {
    const checklist = await this.prisma.checklistItem.findMany({
      where: {
        userId,
        date: new Date(date),
        isCompleted: true,
      },
    });

    if (checklist.length >= 4) {
      await this.incrementStreak(userId, StreakType.CHECKLIST, date);
    }
  }

  private async incrementStreak(
    userId: string,
    streakType: StreakType,
    forcedDate?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return;
    }

    const timezone = user.timezone ?? 'UTC';
    const localDate =
      forcedDate ?? this.formatDateInTimezone(new Date(), timezone);
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
