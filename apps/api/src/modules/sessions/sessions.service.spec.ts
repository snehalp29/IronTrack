import { Test } from '@nestjs/testing';
import { PrType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CompletionService } from '../../services/completion.service';
import { PrDetectionService } from '../../services/pr-detection.service';
import { StreakService } from '../../services/streak.service';
import { SupersetService } from '../../services/superset.service';
import { VolumeService } from '../../services/volume.service';
import { SessionsService } from './sessions.service';

type DetectedPr = Awaited<
  ReturnType<PrDetectionService['detectForSession']>
>[number];

describe('SessionsService', () => {
  it('finishes a session and returns summary', async () => {
    const detectedPrs: DetectedPr[] = [
      {
        exerciseTemplateId: 'exercise-1',
        prType: PrType.MAX_WEIGHT,
        value: 100,
      },
    ];

    const prismaMock = {
      workoutSession: {
        findFirst: jest.fn(async () => ({
          id: 'session-1',
          userId: 'user-1',
          startedAt: new Date(Date.now() - 1_000),
          endedReason: null,
        })),
        update: jest.fn(async () => ({ id: 'session-1', status: 'FINISHED' })),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: PrDetectionService,
          useValue: {
            detectForSession: jest.fn(async () => detectedPrs),
          },
        },
        {
          provide: VolumeService,
          useValue: { cacheSessionVolume: jest.fn(async () => 1000) },
        },
        {
          provide: StreakService,
          useValue: { onSessionFinished: jest.fn(async () => undefined) },
        },
        {
          provide: CompletionService,
          useValue: {
            calculate: jest.fn(async () => ({
              totalSets: 3,
              completedSets: 3,
              isIncomplete: false,
            })),
          },
        },
        {
          provide: SupersetService,
          useValue: { interleave: jest.fn((items) => items) },
        },
      ],
    }).compile();

    const service = moduleRef.get(SessionsService);
    const result = await service.finishSession('user-1', 'session-1');

    expect(result.totalVolume).toBe(1000);
    expect(result.newPrs).toHaveLength(1);
  });
});
