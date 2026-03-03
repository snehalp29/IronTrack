import type { PrismaService } from '../../prisma/prisma.service';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  const prismaMock = {
    muscleGroup: { findMany: jest.fn() },
    equipment: { findMany: jest.fn() },
  } as unknown as PrismaService;

  const service = new CatalogService(prismaMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists muscle groups sorted by sortOrder then name', async () => {
    (prismaMock.muscleGroup.findMany as jest.Mock).mockResolvedValue([
      { id: 'm1' },
    ]);

    await expect(service.muscleGroups()).resolves.toEqual([{ id: 'm1' }]);
    expect(prismaMock.muscleGroup.findMany).toHaveBeenCalledWith({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  });

  it('lists equipment sorted by sortOrder then name', async () => {
    (prismaMock.equipment.findMany as jest.Mock).mockResolvedValue([
      { id: 'e1' },
    ]);

    await expect(service.equipment()).resolves.toEqual([{ id: 'e1' }]);
    expect(prismaMock.equipment.findMany).toHaveBeenCalledWith({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  });
});
