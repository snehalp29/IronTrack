import { focusInitialModalTarget, handleModalKeyDown } from './modal-focus';

interface Props {
  open: boolean;
  exercises: Array<{
    id: string;
    name: string;
  }>;
  selectedExerciseIds: string[];
  onClose: () => void;
  onToggleExercise: (exerciseId: string) => void;
  onApply: () => void;
}

export function SupersetModal({
  open,
  exercises,
  selectedExerciseIds,
  onClose,
  onToggleExercise,
  onApply,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="card modal modal--accent"
      role="dialog"
      aria-modal="true"
      aria-labelledby="superset-modal-title"
      ref={focusInitialModalTarget}
      tabIndex={-1}
      onKeyDown={(event) => handleModalKeyDown(event, onClose)}
    >
      <h3 id="superset-modal-title">Superset Builder</h3>
      <p className="meta">Link A/B exercises into one superset group.</p>
      <div className="grid">
        {exercises.map((exercise) => {
          const selected = selectedExerciseIds.includes(exercise.id);
          return (
            <button
              key={exercise.id}
              type="button"
              className={selected ? undefined : 'secondary'}
              onClick={() => onToggleExercise(exercise.id)}
            >
              Select {exercise.name}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={onApply}>
          Apply Superset
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
