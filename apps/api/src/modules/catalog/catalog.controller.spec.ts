import { CatalogController } from './catalog.controller';
import type { CatalogService } from './catalog.service';

describe('CatalogController', () => {
  const catalogServiceMock = {
    muscleGroups: jest.fn(),
    equipment: jest.fn(),
  } as unknown as CatalogService;

  const controller = new CatalogController(catalogServiceMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates muscleGroups', async () => {
    (catalogServiceMock.muscleGroups as jest.Mock).mockResolvedValue([
      { id: 'm1' },
    ]);

    await expect(controller.muscleGroups()).resolves.toEqual([{ id: 'm1' }]);
  });

  it('delegates equipment', async () => {
    (catalogServiceMock.equipment as jest.Mock).mockResolvedValue([
      { id: 'e1' },
    ]);

    await expect(controller.equipment()).resolves.toEqual([{ id: 'e1' }]);
  });
});
