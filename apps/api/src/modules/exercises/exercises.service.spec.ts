import { Test } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { ExercisesService } from './exercises.service';

describe('ExercisesService', () => {
  it('returns paginated list', async () => {
    const prismaMock = {
      $transaction: jest.fn(async () => [
        [{ id: '1', name: 'Bench Press' }],
        1,
      ]),
      exerciseTemplate: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ExercisesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(ExercisesService);

    const response = await service.list('user-1', {
      page: 1,
      pageSize: 20,
      isGlobal: undefined,
      muscleGroup: undefined,
      equipment: undefined,
      type: undefined,
      search: undefined,
    });

    expect(response.pagination.total).toBe(1);
    expect(response.items).toHaveLength(1);
  });
});
