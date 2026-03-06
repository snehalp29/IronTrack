import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const createService = () => {
    const tx = {
      user: {
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      exerciseTemplate: {
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
      workoutTemplate: {
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
      workoutSession: {
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
      refreshToken: {
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
      exerciseNote: {
        deleteMany: jest.fn(async () => ({ count: 0 })),
      },
      pRRecord: {
        deleteMany: jest.fn(async () => ({ count: 0 })),
      },
      userStreak: {
        deleteMany: jest.fn(async () => ({ count: 0 })),
      },
      checklistItem: {
        deleteMany: jest.fn(async () => ({ count: 0 })),
      },
      sessionNote: {
        deleteMany: jest.fn(async () => ({ count: 0 })),
      },
    };

    const prismaMock = {
      user: {
        findFirst: jest.fn(),
        updateMany: jest.fn(async () => ({ count: 1 })),
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
      exerciseNote: {
        deleteMany: jest.fn(),
      },
      pRRecord: {
        deleteMany: jest.fn(),
      },
      userStreak: {
        deleteMany: jest.fn(),
      },
      checklistItem: {
        deleteMany: jest.fn(),
      },
      sessionNote: {
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(async (arg: unknown) => {
        if (typeof arg === 'function') {
          return (arg as (client: typeof tx) => unknown)(tx);
        }
        return Promise.all(arg as Promise<unknown>[]);
      }),
    } as unknown as PrismaService;

    return {
      service: new UsersService(prismaMock),
      prismaMock,
      tx,
    };
  };

  beforeEach(() => jest.clearAllMocks());

  it('returns selected profile for getMe', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.user.findFirst as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'u1@example.com',
    });

    await expect(service.getMe('u1')).resolves.toEqual({
      id: 'u1',
      email: 'u1@example.com',
    });
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1', deletedAt: null },
      }),
    );
  });

  it('throws not found when user does not exist', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.user.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.getMe('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates profile fields for updateMe', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.user.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'u1',
      name: 'Name',
    });

    await expect(service.updateMe('u1', { name: 'Name' })).resolves.toEqual({
      id: 'u1',
      name: 'Name',
    });
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', deletedAt: null },
      data: { name: 'Name' },
    });
  });

  it('throws not found when updating a deleted user', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    await expect(
      service.updateMe('u1', { name: 'Name' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });

  it('maps concurrent user deletion during updateMe back to USER_NOT_FOUND', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.user.findFirst as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      service.updateMe('u1', { name: 'Name' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects invalid timezone values during profile updates', async () => {
    const { service, prismaMock } = createService();

    await expect(
      service.updateMe('u1', { timezone: 'Mars/Olympus' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
  });

  it('soft deletes active user-related records in a transaction', async () => {
    const { service, prismaMock, tx } = createService();

    await expect(service.deleteMe('u1')).resolves.toEqual({ success: true });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const userDeleteDate = (tx.user.updateMany as jest.Mock).mock.calls[0][0]
      .data.deletedAt as Date;
    expect(userDeleteDate).toBeInstanceOf(Date);
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', deletedAt: null },
      data: { deletedAt: userDeleteDate },
    });
    expect(
      (tx.exerciseTemplate.updateMany as jest.Mock).mock.calls[0][0].data
        .deletedAt,
    ).toBe(userDeleteDate);
    expect(
      (tx.workoutTemplate.updateMany as jest.Mock).mock.calls[0][0].data
        .deletedAt,
    ).toBe(userDeleteDate);
    expect(
      (tx.workoutSession.updateMany as jest.Mock).mock.calls[0][0].data
        .deletedAt,
    ).toBe(userDeleteDate);
    expect(
      (tx.refreshToken.updateMany as jest.Mock).mock.calls[0][0].data.revokedAt,
    ).toBe(userDeleteDate);
    expect(tx.exerciseNote.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
    expect(tx.pRRecord.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
    expect(tx.userStreak.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
    expect(tx.checklistItem.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
    expect(tx.sessionNote.deleteMany).toHaveBeenCalledWith({
      where: {
        session: {
          userId: 'u1',
        },
      },
    });
  });

  it('throws not found when deleting an already deleted user', async () => {
    const { service, tx } = createService();
    (tx.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    await expect(service.deleteMe('u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.exerciseTemplate.updateMany).not.toHaveBeenCalled();
    expect(tx.workoutTemplate.updateMany).not.toHaveBeenCalled();
    expect(tx.workoutSession.updateMany).not.toHaveBeenCalled();
    expect(tx.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(tx.exerciseNote.deleteMany).not.toHaveBeenCalled();
    expect(tx.pRRecord.deleteMany).not.toHaveBeenCalled();
    expect(tx.userStreak.deleteMany).not.toHaveBeenCalled();
    expect(tx.checklistItem.deleteMany).not.toHaveBeenCalled();
    expect(tx.sessionNote.deleteMany).not.toHaveBeenCalled();
  });
});
