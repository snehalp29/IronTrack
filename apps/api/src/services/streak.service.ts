import { Injectable, Logger } from '@nestjs/common';
import { ChecklistType, StreakType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const REQUIRED_CHECKLIST_TYPES = [
  ChecklistType.WORKOUT,
  ChecklistType.WARMUP,
  ChecklistType.MOBILITY,
  ChecklistType.NOTES,
] as const;
const MAX_STREAK_WRITE_ATTEMPTS = 3;

@Injectable()
export class StreakService {
  private readonly logger = new Logger(StreakService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getWorkoutStreak(userId: string) {
    const streak = await this.prisma.userStreak.findUnique({
      where: {
        userId_streakType: {
          userId,
          streakType: StreakType.WORKOUT,
        },
      },
    });

    return {
      currentStreakDays: streak?.currentStreakDays ?? 0,
      longestStreakDays: streak?.longestStreakDays ?? 0,
      lastCompletedDate: streak?.lastCompletedDate
        ? this.formatStoredDate(streak.lastCompletedDate)
        : null,
    };
  }

  async onSessionFinished(
    userId: string,
    completedAt?: Date,
    timezone?: string,
  ): Promise<void> {
    await this.incrementStreak(
      userId,
      StreakType.WORKOUT,
      completedAt,
      timezone,
    );
  }

  async onChecklistCompleted(
    userId: string,
    date: string,
    timezone?: string,
  ): Promise<void> {
    const completedCount = await this.prisma.checklistItem.count({
      where: {
        userId,
        date: new Date(`${date}T00:00:00.000Z`),
        isCompleted: true,
        type: { in: [...REQUIRED_CHECKLIST_TYPES] },
      },
    });

    if (completedCount >= REQUIRED_CHECKLIST_TYPES.length) {
      await this.incrementStreak(userId, StreakType.CHECKLIST, date, timezone);
    }
  }

  private async incrementStreak(
    userId: string,
    streakType: StreakType,
    forcedDate?: string | Date,
    timezone?: string,
  ): Promise<void> {
    const resolvedTimezone = await this.resolveTimezone(userId, timezone);
    if (!resolvedTimezone) {
      return;
    }

    const localDate =
      typeof forcedDate === 'string'
        ? forcedDate
        : this.formatDateInTimezone(forcedDate ?? new Date(), resolvedTimezone);
    const dateValue = new Date(`${localDate}T00:00:00.000Z`);

    for (let attempt = 0; attempt < MAX_STREAK_WRITE_ATTEMPTS; attempt += 1) {
      const streak = await this.prisma.userStreak.findUnique({
        where: {
          userId_streakType: {
            userId,
            streakType,
          },
        },
      });

      if (!streak) {
        try {
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
        } catch (error) {
          if (!isPrismaUniqueConstraintError(error)) {
            throw error;
          }
          continue;
        }
      }

      const previousDateString = streak.lastCompletedDate
        ? this.formatStoredDate(streak.lastCompletedDate)
        : null;

      if (previousDateString === localDate) {
        return;
      }

      const dayDelta = previousDateString
        ? this.daysBetween(previousDateString, localDate)
        : null;

      if (dayDelta !== null && dayDelta < 0) {
        return;
      }

      const isConsecutive = dayDelta === 1;
      const currentStreakDays = isConsecutive
        ? streak.currentStreakDays + 1
        : 1;
      const updateResult = await this.prisma.userStreak.updateMany({
        where: {
          id: streak.id,
          currentStreakDays: streak.currentStreakDays,
          longestStreakDays: streak.longestStreakDays,
          lastCompletedDate: streak.lastCompletedDate ?? null,
        },
        data: {
          currentStreakDays,
          longestStreakDays: Math.max(
            streak.longestStreakDays,
            currentStreakDays,
          ),
          lastCompletedDate: dateValue,
        },
      });

      if (updateResult.count > 0) {
        return;
      }
    }
  }

  private async resolveTimezone(
    userId: string,
    timezone?: string,
  ): Promise<string | null> {
    if (typeof timezone === 'string') {
      const trimmedTimezone = timezone.trim();
      if (trimmedTimezone.length > 0) {
        if (this.isValidTimezone(trimmedTimezone)) {
          return trimmedTimezone;
        }

        this.logger.warn(
          `Invalid timezone '${trimmedTimezone}' for user '${userId}', falling back to UTC`,
        );
        return 'UTC';
      }
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt != null) {
      return null;
    }

    const trimmedUserTimezone = user.timezone?.trim();
    if (trimmedUserTimezone && trimmedUserTimezone.length > 0) {
      if (this.isValidTimezone(trimmedUserTimezone)) {
        return trimmedUserTimezone;
      }

      this.logger.warn(
        `Invalid timezone '${trimmedUserTimezone}' for user '${userId}', falling back to UTC`,
      );
    }

    return 'UTC';
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

  private isValidTimezone(timezone: string): boolean {
    try {
      new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
      });
      return true;
    } catch {
      return false;
    }
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

function isPrismaUniqueConstraintError(error: unknown): boolean {
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
    const lowered = target
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.toLowerCase());
    return lowered.includes('userid') && lowered.includes('streaktype');
  }

  if (typeof target === 'string') {
    const normalized = target.toLowerCase();
    return normalized.includes('userid') && normalized.includes('streaktype');
  }

  return false;
}
