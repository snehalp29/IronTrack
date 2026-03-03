import { cleanup, createTestSession, createTestUser } from './test-utils';

describe('testing utilities', () => {
  const prismaMock = {
    user: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    workoutSession: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    set: {
      deleteMany: jest.fn(),
    },
    sessionExercise: {
      deleteMany: jest.fn(),
    },
    refreshToken: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates test user with defaults and overrides', async () => {
    (prismaMock.user.create as jest.Mock).mockResolvedValue({ id: 'u1' });

    await expect(createTestUser(prismaMock as never)).resolves.toEqual({
      id: 'u1',
    });
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        passwordHash: 'hashed-password',
        name: 'Test User',
      }),
    });

    await createTestUser(prismaMock as never, {
      email: 'custom@example.com',
      name: 'Custom',
    });
    expect(prismaMock.user.create).toHaveBeenLastCalledWith({
      data: {
        email: 'custom@example.com',
        passwordHash: 'hashed-password',
        name: 'Custom',
      },
    });
  });

  it('creates test session with defaults and overrides', async () => {
    (prismaMock.workoutSession.create as jest.Mock).mockResolvedValue({
      id: 's1',
    });

    await expect(createTestSession(prismaMock as never, 'u1')).resolves.toEqual(
      {
        id: 's1',
      },
    );
    expect(prismaMock.workoutSession.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        notes: 'test session',
      },
    });

    await createTestSession(prismaMock as never, 'u1', { notes: 'custom' });
    expect(prismaMock.workoutSession.create).toHaveBeenLastCalledWith({
      data: {
        userId: 'u1',
        notes: 'custom',
      },
    });
  });

  it('cleans up user-scoped entities in one transaction', async () => {
    (prismaMock.set.deleteMany as jest.Mock).mockReturnValue('delete-sets');
    (prismaMock.sessionExercise.deleteMany as jest.Mock).mockReturnValue(
      'delete-session-exercises',
    );
    (prismaMock.workoutSession.deleteMany as jest.Mock).mockReturnValue(
      'delete-workout-sessions',
    );
    (prismaMock.refreshToken.deleteMany as jest.Mock).mockReturnValue(
      'delete-refresh-tokens',
    );
    (prismaMock.user.deleteMany as jest.Mock).mockReturnValue('delete-users');
    (prismaMock.$transaction as jest.Mock).mockResolvedValue([]);

    await cleanup(prismaMock as never, ['u1', 'u2']);

    expect(prismaMock.$transaction).toHaveBeenCalledWith([
      'delete-sets',
      'delete-session-exercises',
      'delete-workout-sessions',
      'delete-refresh-tokens',
      'delete-users',
    ]);
    expect(prismaMock.user.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['u1', 'u2'] } },
    });
  });
});
