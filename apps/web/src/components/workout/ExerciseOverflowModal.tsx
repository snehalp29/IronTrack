import { focusInitialModalTarget, handleModalKeyDown } from './modal-focus';

interface Props {
  open: boolean;
  exerciseName?: string;
  onClose: () => void;
  onEditNotes: () => void;
  onSwapExercise: () => void;
  onDeleteExercise: () => void;
}

export function ExerciseOverflowModal({
  open,
  exerciseName,
  onClose,
  onEditNotes,
  onSwapExercise,
  onDeleteExercise,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="card modal modal--accent"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exercise-overflow-title"
      ref={focusInitialModalTarget}
      tabIndex={-1}
      onKeyDown={(event) => handleModalKeyDown(event, onClose)}
    >
      <h3 id="exercise-overflow-title">Exercise Actions</h3>
      {exerciseName ? <p className="meta">{exerciseName}</p> : null}
      <div className="grid">
        <button type="button" className="secondary" onClick={onEditNotes}>
          Edit Notes
        </button>
        <button type="button" className="secondary" onClick={onSwapExercise}>
          Swap Exercise
        </button>
        <button type="button" className="danger" onClick={onDeleteExercise}>
          Delete Exercise
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
