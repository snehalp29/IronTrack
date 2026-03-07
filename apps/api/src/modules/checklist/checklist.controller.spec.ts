import { ChecklistController } from './checklist.controller';
import type { ChecklistService } from './checklist.service';

describe('ChecklistController', () => {
  const checklistServiceMock = {
    getByDate: jest.fn(),
    upsert: jest.fn(),
    getWeek: jest.fn(),
  } as unknown as ChecklistService;

  const controller = new ChecklistController(checklistServiceMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates getByDate with current user sub', async () => {
    (checklistServiceMock.getByDate as jest.Mock).mockResolvedValue([
      { id: 'a' },
    ]);

    await expect(
      controller.getByDate({ sub: 'user-1' }, { date: '2024-01-01' }),
    ).resolves.toEqual([{ id: 'a' }]);

    expect(checklistServiceMock.getByDate).toHaveBeenCalledWith(
      'user-1',
      '2024-01-01',
    );
  });

  it('delegates upsert', async () => {
    const body = {
      date: '2024-01-01',
      type: 'WORKOUT' as const,
      isCompleted: true,
    };
    (checklistServiceMock.upsert as jest.Mock).mockResolvedValue({
      id: 'upserted',
    });

    await expect(controller.upsert({ sub: 'user-1' }, body)).resolves.toEqual({
      id: 'upserted',
    });
    expect(checklistServiceMock.upsert).toHaveBeenCalledWith('user-1', body);
  });

  it('sets 201 Created when checklist upsert creates a new item', async () => {
    const body = {
      date: '2024-01-01',
      type: 'WORKOUT' as const,
      isCompleted: true,
    };
    const createdItem = { id: 'created-item' };
    Object.defineProperty(createdItem, 'created', {
      value: true,
      enumerable: false,
    });
    (checklistServiceMock.upsert as jest.Mock).mockResolvedValue(createdItem);
    const response = {
      status: jest.fn(),
    };

    await expect(
      controller.upsert({ sub: 'user-1' }, body, response as never),
    ).resolves.toEqual({ id: 'created-item' });

    expect(response.status).toHaveBeenCalledWith(201);
  });

  it('delegates getWeek', async () => {
    const query = { startDate: '2024-01-01' };
    (checklistServiceMock.getWeek as jest.Mock).mockResolvedValue([
      { id: 'w1' },
    ]);

    await expect(controller.getWeek({ sub: 'user-1' }, query)).resolves.toEqual(
      [{ id: 'w1' }],
    );
    expect(checklistServiceMock.getWeek).toHaveBeenCalledWith('user-1', query);
  });
});
