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
    workoutTemplateExercise: {
      deleteMany: jest.fn(),
    },
    workoutTemplate: {
      deleteMany: jest.fn(),
    },
    exerciseVideo: {
      deleteMany: jest.fn(),
    },
    exerciseTemplateEquipment: {
      deleteMany: jest.fn(),
    },
    exerciseTemplateSecondaryMuscle: {
      deleteMany: jest.fn(),
    },
    exerciseTemplate: {
      deleteMany: jest.fn(),
    },
    set: {
      deleteMany: jest.fn(),
    },
    sessionExercise: {
      deleteMany: jest.fn(),
    },
    exerciseNote: {
      deleteMany: jest.fn(),
    },
    sessionNote: {
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

  it('uses unique default emails even when multiple users are created in the same millisecond', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_746_000_000_000);
    (prismaMock.user.create as jest.Mock)
      .mockResolvedValueOnce({ id: 'u1' })
      .mockResolvedValueOnce({ id: 'u2' });

    await createTestUser(prismaMock as never);
    await createTestUser(prismaMock as never);

    const firstCall = (prismaMock.user.create as jest.Mock).mock.calls[0][0]
      .data.email;
    const secondCall = (prismaMock.user.create as jest.Mock).mock.calls[1][0]
      .data.email;

    expect(firstCall).not.toBe(secondCall);
    expect(firstCall).toContain('@example.com');
    expect(secondCall).toContain('@example.com');
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
    (
      prismaMock.workoutTemplateExercise.deleteMany as jest.Mock
    ).mockReturnValue('delete-workout-template-exercises');
    (prismaMock.workoutTemplate.deleteMany as jest.Mock).mockReturnValue(
      'delete-workout-templates',
    );
    (prismaMock.exerciseVideo.deleteMany as jest.Mock).mockReturnValue(
      'delete-exercise-videos',
    );
    (
      prismaMock.exerciseTemplateEquipment.deleteMany as jest.Mock
    ).mockReturnValue('delete-exercise-template-equipment');
    (
      prismaMock.exerciseTemplateSecondaryMuscle.deleteMany as jest.Mock
    ).mockReturnValue('delete-exercise-template-secondary-muscles');
    (prismaMock.exerciseTemplate.deleteMany as jest.Mock).mockReturnValue(
      'delete-exercise-templates',
    );
    (prismaMock.set.deleteMany as jest.Mock).mockReturnValue('delete-sets');
    (prismaMock.sessionExercise.deleteMany as jest.Mock).mockReturnValue(
      'delete-session-exercises',
    );
    (prismaMock.workoutSession.deleteMany as jest.Mock).mockReturnValue(
      'delete-workout-sessions',
    );
    (prismaMock.exerciseNote.deleteMany as jest.Mock).mockReturnValue(
      'delete-exercise-notes',
    );
    (prismaMock.sessionNote.deleteMany as jest.Mock).mockReturnValue(
      'delete-session-notes',
    );
    (prismaMock.pRRecord.deleteMany as jest.Mock).mockReturnValue(
      'delete-pr-records',
    );
    (prismaMock.userStreak.deleteMany as jest.Mock).mockReturnValue(
      'delete-user-streaks',
    );
    (prismaMock.checklistItem.deleteMany as jest.Mock).mockReturnValue(
      'delete-checklist-items',
    );
    (prismaMock.refreshToken.deleteMany as jest.Mock).mockReturnValue(
      'delete-refresh-tokens',
    );
    (prismaMock.user.deleteMany as jest.Mock).mockReturnValue('delete-users');
    (prismaMock.$transaction as jest.Mock).mockResolvedValue([]);

    await cleanup(prismaMock as never, ['u1', 'u2']);

    expect(prismaMock.$transaction).toHaveBeenCalledWith([
      'delete-workout-template-exercises',
      'delete-workout-templates',
      'delete-exercise-videos',
      'delete-exercise-template-equipment',
      'delete-exercise-template-secondary-muscles',
      'delete-exercise-templates',
      'delete-sets',
      'delete-session-exercises',
      'delete-workout-sessions',
      'delete-exercise-notes',
      'delete-session-notes',
      'delete-pr-records',
      'delete-user-streaks',
      'delete-checklist-items',
      'delete-refresh-tokens',
      'delete-users',
    ]);
    expect(prismaMock.user.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['u1', 'u2'] } },
    });
  });
});
