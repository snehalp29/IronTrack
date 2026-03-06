import { focusInitialModalTarget, handleModalKeyDown } from './modal-focus';

interface Props {
  open: boolean;
  exercises: Array<{
    id: string;
    name: string;
    orderIndex: number;
  }>;
  onClose: () => void;
  onMoveUp: (exerciseId: string) => void;
  onMoveDown: (exerciseId: string) => void;
  onApply: () => void;
}

export function ReorderModal({
  open,
  exercises,
  onClose,
  onMoveUp,
  onMoveDown,
  onApply,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="card modal modal--accent"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reorder-modal-title"
      ref={focusInitialModalTarget}
      tabIndex={-1}
      onKeyDown={(event) => handleModalKeyDown(event, onClose)}
    >
      <h3 id="reorder-modal-title">Reorder Exercises</h3>
      <div className="grid">
        {exercises.map((exercise) => (
          <div key={exercise.id} className="card">
            <p>{exercise.name}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => onMoveUp(exercise.id)}>
                Move Up
              </button>
              <button type="button" onClick={() => onMoveDown(exercise.id)}>
                Move Down
              </button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={onApply}>
          Apply Order
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
