import { UsersController } from './users.controller';
import type { UsersService } from './users.service';

describe('UsersController', () => {
  const usersServiceMock = {
    getMe: jest.fn(),
    updateMe: jest.fn(),
    deleteMe: jest.fn(),
  } as unknown as UsersService;

  const controller = new UsersController(usersServiceMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates getMe', async () => {
    (usersServiceMock.getMe as jest.Mock).mockResolvedValue({ id: 'user-1' });

    await expect(controller.getMe({ sub: 'user-1' })).resolves.toEqual({
      id: 'user-1',
    });
    expect(usersServiceMock.getMe).toHaveBeenCalledWith('user-1');
  });

  it('delegates updateMe', async () => {
    const body = { name: 'Updated' };
    (usersServiceMock.updateMe as jest.Mock).mockResolvedValue({
      id: 'user-1',
    });

    await expect(controller.updateMe({ sub: 'user-1' }, body)).resolves.toEqual(
      {
        id: 'user-1',
      },
    );
    expect(usersServiceMock.updateMe).toHaveBeenCalledWith('user-1', body);
  });

  it('delegates deleteMe', async () => {
    (usersServiceMock.deleteMe as jest.Mock).mockResolvedValue({
      success: true,
    });

    await expect(controller.deleteMe({ sub: 'user-1' })).resolves.toEqual({
      success: true,
    });
    expect(usersServiceMock.deleteMe).toHaveBeenCalledWith('user-1');
  });
});
