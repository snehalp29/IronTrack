import { useMemo, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { ExerciseOverflowModal } from '../components/workout/ExerciseOverflowModal';
import { IncompleteWarningModal } from '../components/workout/IncompleteWarningModal';
import { ReorderModal } from '../components/workout/ReorderModal';
import { SupersetModal } from '../components/workout/SupersetModal';
import { useRestTimer } from '../hooks/useRestTimer';
import { useActiveWorkoutStore } from '../stores/activeWorkoutStore';
import type { SessionExercise } from '../stores/activeWorkoutStore';

const seedExercises: SessionExercise[] = [
  {
    id: 'se-1',
    exerciseTemplateId: 'ex-1',
    name: 'Barbell Bench Press',
    orderIndex: 0,
    sets: [
      { id: 's-1', orderIndex: 0, reps: 8, weight: 100, isCompleted: false },
      { id: 's-2', orderIndex: 1, reps: 8, weight: 100, isCompleted: false },
    ],
  },
  {
    id: 'se-2',
    exerciseTemplateId: 'ex-2',
    name: 'Incline Dumbbell Press',
    orderIndex: 1,
    sets: [
      { id: 's-3', orderIndex: 0, reps: 10, weight: 32.5, isCompleted: false },
    ],
  },
];

export function ActiveWorkoutPage() {
  useRestTimer();
  const navigate = useNavigate();

  const state = useActiveWorkoutStore((store) => store.state);
  const start = useActiveWorkoutStore((store) => store.start);
  const exercises = useActiveWorkoutStore((store) => store.exercises);
  const updateSet = useActiveWorkoutStore((store) => store.updateSet);
  const finish = useActiveWorkoutStore((store) => store.finish);
  const restTimerSeconds = useActiveWorkoutStore(
    (store) => store.restTimerSeconds,
  );

  const [showOverflow, setShowOverflow] = useState(false);
  const [showReorder, setShowReorder] = useState(false);
  const [showSuperset, setShowSuperset] = useState(false);
  const [showIncomplete, setShowIncomplete] = useState(false);
  const totals = useMemo(() => {
    const allSets = exercises.flatMap((exercise) => exercise.sets);
    const completed = allSets.filter((set) => set.isCompleted).length;
    const total = allSets.length;
    return { completed, total };
  }, [exercises]);

  function finalizeWorkout() {
    finish({ totalVolume: 12450, durationSeconds: 3120, prs: 2 });
    setShowIncomplete(false);
    navigate('/workout/complete');
  }

  if (state === 'IDLE') {
    return (
      <div className="card">
        <h1>Active Workout</h1>
        <p className="meta">No active session</p>
        <button onClick={() => start('session-local-1', seedExercises)}>
          Start Session
        </button>
      </div>
    );
  }

  return (
    <div className="grid">
      <section className="card">
        <h1>Active Workout</h1>
        <p className="meta">
          Completed sets: {totals.completed} / {totals.total}
        </p>
        <p className="badge">Rest Timer: {restTimerSeconds}s</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="secondary" onClick={() => setShowOverflow(true)}>
            Overflow
          </button>
          <button className="secondary" onClick={() => setShowReorder(true)}>
            Reorder
          </button>
          <button className="secondary" onClick={() => setShowSuperset(true)}>
            Superset
          </button>
        </div>
      </section>

      {exercises.map((exercise) => (
        <section key={exercise.id} className="card">
          <h3>{exercise.name}</h3>
          <div className="grid">
            {exercise.sets.map((set) => (
              <button
                key={set.id}
                className={set.isCompleted ? 'secondary' : undefined}
                onClick={() =>
                  updateSet(exercise.id, set.id, {
                    isCompleted: !set.isCompleted,
                  })
                }
              >
                Set {set.orderIndex + 1}: {set.weight} x {set.reps}{' '}
                {set.isCompleted ? '(done)' : '(tap to complete)'}
              </button>
            ))}
          </div>
        </section>
      ))}

      <section className="card">
        <button
          onClick={() => {
            if (totals.completed < totals.total) {
              setShowIncomplete(true);
              return;
            }
            finalizeWorkout();
          }}
        >
          Finish Workout
        </button>
      </section>

      <ExerciseOverflowModal
        open={showOverflow}
        onClose={() => setShowOverflow(false)}
      />
      <ReorderModal open={showReorder} onClose={() => setShowReorder(false)} />
      <SupersetModal
        open={showSuperset}
        onClose={() => setShowSuperset(false)}
      />
      <IncompleteWarningModal
        open={showIncomplete}
        onClose={() => setShowIncomplete(false)}
        onConfirm={finalizeWorkout}
      />
    </div>
  );
}
