import { ExerciseNotesModal } from '../components/workout/ExerciseNotesModal';
import { ExerciseOverflowModal } from '../components/workout/ExerciseOverflowModal';
import { IncompleteWarningModal } from '../components/workout/IncompleteWarningModal';
import { ReorderModal } from '../components/workout/ReorderModal';
import { SupersetModal } from '../components/workout/SupersetModal';
import { useActiveWorkoutPageData } from '../lib/web-data';

export function ActiveWorkoutPage() {
  const data = useActiveWorkoutPageData();

  if (data.state === 'IDLE') {
    return (
      <div className="card">
        <h1>Active Workout</h1>
        <p className="meta">No active session</p>
        {data.errorMessage ? <p className="meta">{data.errorMessage}</p> : null}
        <button onClick={data.onIdleAction}>{data.idleActionLabel}</button>
      </div>
    );
  }

  return (
    <div className="grid">
      <section className="card">
        <h1>Active Workout</h1>
        <p className="meta">
          Completed sets: {data.totals.completed} / {data.totals.total}
        </p>
        {data.errorMessage ? <p className="meta">{data.errorMessage}</p> : null}
        <p className="badge">Rest Timer: {data.restTimerSeconds}s</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            className="secondary"
            onClick={() => data.openOverflow(data.exercises[0]?.id)}
          >
            Overflow
          </button>
          <button className="secondary" onClick={data.openReorder}>
            Reorder
          </button>
          <button className="secondary" onClick={data.openSuperset}>
            Superset
          </button>
        </div>
      </section>

      {data.exercises.map((exercise) => (
        <section key={exercise.id} className="card">
          <h3>{exercise.name}</h3>
          <div className="grid">
            {exercise.sets.map((set) => (
              <button
                key={set.id}
                className={set.isCompleted ? 'secondary' : undefined}
                onClick={() =>
                  data.onToggleSet(exercise.id, set.id, !set.isCompleted)
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
        <button onClick={data.onFinishWorkout}>Finish Workout</button>
      </section>

      <ExerciseOverflowModal
        open={data.overflow.open}
        exerciseName={data.overflow.exerciseName}
        onClose={data.overflow.onClose}
        onEditNotes={data.overflow.onEditNotes}
        onSwapExercise={data.overflow.onSwapExercise}
        onDeleteExercise={data.overflow.onDeleteExercise}
      />
      <ExerciseNotesModal
        open={data.notes.open}
        exerciseName={data.notes.exerciseName}
        errorMessage={data.notes.errorMessage}
        isSaving={data.notes.isSaving}
        notes={data.notes.notes}
        onChange={data.notes.onChange}
        onClose={data.notes.onClose}
        onSave={data.notes.onSave}
      />
      <ReorderModal
        open={data.reorder.open}
        exercises={data.reorder.exercises}
        onClose={data.reorder.onClose}
        onMoveUp={data.reorder.onMoveUp}
        onMoveDown={data.reorder.onMoveDown}
        onApply={data.reorder.onApply}
      />
      <SupersetModal
        open={data.superset.open}
        exercises={data.superset.exercises}
        selectedExerciseIds={data.superset.selectedExerciseIds}
        onClose={data.superset.onClose}
        onToggleExercise={data.superset.onToggleExercise}
        onApply={data.superset.onApply}
      />
      <IncompleteWarningModal
        open={data.incomplete.open}
        onClose={data.incomplete.onClose}
        onConfirm={data.incomplete.onConfirm}
      />
    </div>
  );
}
