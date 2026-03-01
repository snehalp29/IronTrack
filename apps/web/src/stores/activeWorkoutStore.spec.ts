import { describe, expect, it } from 'vitest';

import { useActiveWorkoutStore } from './activeWorkoutStore';
import type { SessionExercise } from './activeWorkoutStore';

describe('activeWorkoutStore', () => {
  it('supports start -> complete flow', () => {
    const { start, finish, clear } = useActiveWorkoutStore.getState();
    const sessionExercises: SessionExercise[] = [
      {
        id: 'se-1',
        exerciseTemplateId: 'ex-1',
        name: 'Bench Press',
        orderIndex: 0,
        sets: [
          {
            id: 'set-1',
            orderIndex: 0,
            reps: 8,
            weight: 100,
            isCompleted: false,
          },
        ],
      },
    ];

    clear();
    start('session-1', sessionExercises);

    expect(useActiveWorkoutStore.getState().state).toBe('IN_PROGRESS');

    finish({ totalVolume: 1000, durationSeconds: 1200, prs: 1 });
    expect(useActiveWorkoutStore.getState().state).toBe('COMPLETED');

    clear();
    expect(useActiveWorkoutStore.getState().state).toBe('IDLE');
  });
});
