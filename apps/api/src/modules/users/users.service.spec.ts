import { NotFoundException } from '@nestjs/common';

import type { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    exerciseTemplate: {
      updateMany: jest.fn(),
    },
    workoutTemplate: {
      updateMany: jest.fn(),
    },
    workoutSession: {
      updateMany: jest.fn(),
    },
    refreshToken: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  const service = new UsersService(prismaMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns selected profile for getMe', async () => {
    (prismaMock.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'u1@example.com',
    });

    await expect(service.getMe('u1')).resolves.toEqual({
      id: 'u1',
      email: 'u1@example.com',
    });
  });

  it('throws not found when user does not exist', async () => {
    (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.getMe('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates profile fields for updateMe', async () => {
    (prismaMock.user.update as jest.Mock).mockResolvedValue({
      id: 'u1',
      name: 'Name',
    });

    await expect(service.updateMe('u1', { name: 'Name' })).resolves.toEqual({
      id: 'u1',
      name: 'Name',
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: { name: 'Name' },
      }),
    );
  });

  it('soft deletes user-related records in a transaction', async () => {
    (prismaMock.user.update as jest.Mock).mockReturnValue('user-update');
    (prismaMock.exerciseTemplate.updateMany as jest.Mock).mockReturnValue(
      'exercise-update-many',
    );
    (prismaMock.workoutTemplate.updateMany as jest.Mock).mockReturnValue(
      'workout-template-update-many',
    );
    (prismaMock.workoutSession.updateMany as jest.Mock).mockReturnValue(
      'workout-session-update-many',
    );
    (prismaMock.refreshToken.updateMany as jest.Mock).mockReturnValue(
      'refresh-token-update-many',
    );
    (prismaMock.$transaction as jest.Mock).mockResolvedValue([]);

    await expect(service.deleteMe('u1')).resolves.toEqual({ success: true });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect((prismaMock.$transaction as jest.Mock).mock.calls[0][0]).toEqual([
      'user-update',
      'exercise-update-many',
      'workout-template-update-many',
      'workout-session-update-many',
      'refresh-token-update-many',
    ]);

    const userDeleteDate = (prismaMock.user.update as jest.Mock).mock
      .calls[0][0].data.deletedAt as Date;
    expect(userDeleteDate).toBeInstanceOf(Date);
    expect(
      (prismaMock.exerciseTemplate.updateMany as jest.Mock).mock.calls[0][0]
        .data.deletedAt,
    ).toBe(userDeleteDate);
    expect(
      (prismaMock.workoutTemplate.updateMany as jest.Mock).mock.calls[0][0].data
        .deletedAt,
    ).toBe(userDeleteDate);
    expect(
      (prismaMock.workoutSession.updateMany as jest.Mock).mock.calls[0][0].data
        .deletedAt,
    ).toBe(userDeleteDate);
    expect(
      (prismaMock.refreshToken.updateMany as jest.Mock).mock.calls[0][0].data
        .revokedAt,
    ).toBe(userDeleteDate);
  });
});
