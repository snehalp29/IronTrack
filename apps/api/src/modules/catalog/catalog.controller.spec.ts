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
    const response = {
      setHeader: jest.fn(),
    };
    (catalogServiceMock.muscleGroups as jest.Mock).mockResolvedValue([
      { id: 'm1' },
    ]);

    await expect(controller.muscleGroups(response as never)).resolves.toEqual([
      { id: 'm1' },
    ]);
  });

  it('adds cache headers for muscleGroups', async () => {
    const response = {
      setHeader: jest.fn(),
    };
    (catalogServiceMock.muscleGroups as jest.Mock).mockResolvedValue([
      { id: 'm1' },
    ]);

    await controller.muscleGroups(response as never);
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=86400, stale-while-revalidate=3600',
    );
  });

  it('delegates equipment', async () => {
    const response = {
      setHeader: jest.fn(),
    };
    (catalogServiceMock.equipment as jest.Mock).mockResolvedValue([
      { id: 'e1' },
    ]);

    await expect(controller.equipment(response as never)).resolves.toEqual([
      { id: 'e1' },
    ]);
  });

  it('adds cache headers for equipment', async () => {
    const response = {
      setHeader: jest.fn(),
    };
    (catalogServiceMock.equipment as jest.Mock).mockResolvedValue([
      { id: 'e1' },
    ]);

    await controller.equipment(response as never);
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=86400, stale-while-revalidate=3600',
    );
  });
});
